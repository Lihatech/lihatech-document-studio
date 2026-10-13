-- Reject missing input and the UI sentinel before saving reusable options.
create or replace function public.save_document_studio_records(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  change jsonb;
  saved_version integer;
  result jsonb := '[]'::jsonb;
begin
  if not public.has_admin_access() then raise exception 'Active staff access is required.' using errcode = '42501'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 2000 then
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

create or replace function public.add_certificate_option(p_kind text, p_name text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare current_settings jsonb; option_field text; options jsonb; new_option jsonb;
begin
  if not public.has_admin_access() then raise exception 'Active staff access is required.' using errcode = '42501'; end if;
  p_name := trim(p_name);
  if p_name is null or p_kind is null or p_name = '__add_option__' or p_name = '' or length(p_name) > 120 or p_kind not in ('category','partner') then
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
