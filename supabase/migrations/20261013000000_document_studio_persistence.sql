-- Separate from LMS records: keep existing document payloads and layouts intact.
create table public.document_studio_records (
  kind text not null check (kind in ('invoice','certificate','letter','payslip','client','course','employee','activity')),
  record_id text not null check (length(record_id) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object')
    check (coalesce(data->>case when kind = 'employee' then 'employeeId' else 'id' end,'') = record_id),
  version integer not null default 1,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (kind, record_id)
);
-- A stale browser must not issue another invoice/certificate with the same number.
create unique index studio_invoice_number on public.document_studio_records ((data->>'invoiceNumber'))
  where kind = 'invoice' and coalesce(data->>'invoiceNumber','') <> '';
create unique index studio_certificate_number on public.document_studio_records ((data->>'certificateId'))
  where kind = 'certificate' and coalesce(data->>'certificateId','') <> '';
alter table public.document_studio_records enable row level security;
create policy studio_staff_access on public.document_studio_records
  for all to anon, authenticated
  using (public.has_admin_access()) with check (public.has_admin_access());
grant select, insert, update on public.document_studio_records to anon, authenticated;

create function public.save_document_studio_records(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  change jsonb;
  saved_version integer;
  result jsonb := '[]'::jsonb;
begin
  if not public.has_admin_access() then raise exception 'Active staff access is required.' using errcode = '42501'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 2000 then
    raise exception 'Invalid document batch.' using errcode = '22023';
  end if;
  -- All changes and their activity entry commit together or roll back together.
  for change in select value from jsonb_array_elements(p_changes) order by value->>'kind', value->>'record_id' loop
    if coalesce((change->>'expected_version')::integer, -1) < 0 then
      raise exception 'Invalid record version.' using errcode = '22023';
    end if;
    if (change->>'expected_version')::integer = 0 then
      insert into public.document_studio_records (kind,record_id,data,archived)
      values (change->>'kind',change->>'record_id',change->'data',(change->>'archived')::boolean)
      returning version into saved_version;
    else
      update public.document_studio_records
        set data = change->'data', archived = (change->>'archived')::boolean,
            version = version + 1, updated_at = now()
        where kind = change->>'kind' and record_id = change->>'record_id'
          and version = (change->>'expected_version')::integer
        returning version into saved_version;
      if not found then raise exception 'Record changed on another device. Reload before saving.' using errcode = '40001'; end if;
    end if;
    result := result || jsonb_build_array(jsonb_build_object('kind',change->>'kind','record_id',change->>'record_id','version',saved_version));
  end loop;
  return result;
end;
$$;
revoke all on function public.save_document_studio_records(jsonb) from public;
grant execute on function public.save_document_studio_records(jsonb) to anon, authenticated;

create function public.add_certificate_option(p_kind text, p_name text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare current_settings jsonb; option_field text; options jsonb; new_option jsonb;
begin
  if not public.has_admin_access() then raise exception 'Active staff access is required.' using errcode = '42501'; end if;
  p_name := trim(p_name);
  if p_name = '' or length(p_name) > 120 or p_kind not in ('category','partner') then
    raise exception 'Enter a name between 1 and 120 characters.' using errcode = '22023';
  end if;
  insert into public.company_settings (id,settings) values (true,'{}') on conflict (id) do nothing;
  select settings into current_settings from public.company_settings where id = true for update;
  option_field := case when p_kind = 'category' then 'certificateCategories' else 'certificatePartners' end;
  options := coalesce(current_settings->option_field, '[]'::jsonb);
  if p_kind = 'category' then
    if not exists (select 1 from jsonb_array_elements_text(options) v where lower(v) = lower(p_name)) then
      options := options || jsonb_build_array(p_name);
    end if;
  else
    if not exists (select 1 from jsonb_array_elements(options) v where lower(v->>'name') = lower(p_name)) then
      new_option := jsonb_build_object('id',gen_random_uuid()::text,'name',p_name,'tagline','');
      options := options || jsonb_build_array(new_option);
    end if;
  end if;
  current_settings := jsonb_set(current_settings, array[option_field], options);
  update public.company_settings set settings = current_settings where id = true;
  return current_settings;
end;
$$;
revoke all on function public.add_certificate_option(text,text) from public;
grant execute on function public.add_certificate_option(text,text) to anon, authenticated;

create function public.save_studio_company_settings(p_settings jsonb, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved public.company_settings;
begin
  if not public.has_admin_access() then raise exception 'Active staff access is required.' using errcode = '42501'; end if;
  if jsonb_typeof(p_settings) <> 'object' then raise exception 'Invalid settings.' using errcode = '22023'; end if;
  if p_expected_updated_at is null then
    insert into public.company_settings (id,settings) values (true,p_settings) on conflict (id) do nothing returning * into saved;
  else
    update public.company_settings set settings = p_settings
      where id = true and updated_at = p_expected_updated_at returning * into saved;
  end if;
  if saved.id is null then raise exception 'Settings changed on another device.' using errcode = '40001'; end if;
  return jsonb_build_object('settings',saved.settings,'updated_at',saved.updated_at);
end;
$$;
revoke all on function public.save_studio_company_settings(jsonb,timestamptz) from public;
grant execute on function public.save_studio_company_settings(jsonb,timestamptz) to anon, authenticated;

create table public.document_studio_drafts (
  firebase_uid text not null,
  kind text not null check (kind = 'invoice'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (firebase_uid,kind)
);
alter table public.document_studio_drafts enable row level security;
create policy studio_own_drafts on public.document_studio_drafts for all to anon, authenticated
  using (public.has_admin_access() and firebase_uid = auth.jwt()->>'sub')
  with check (public.has_admin_access() and firebase_uid = auth.jwt()->>'sub');
grant select,insert,update,delete on public.document_studio_drafts to anon, authenticated;
