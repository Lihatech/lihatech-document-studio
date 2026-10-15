-- Run against the migrated database as its owner. Every fixture is rolled back.
begin;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  if exists (select 1 from public.document_studio_records) then raise exception 'Unauthenticated registry access'; end if;
  begin
    perform public.save_document_studio_records('[]');
    raise exception 'Unauthenticated save was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.add_certificate_option('category','Unauthorized');
    raise exception 'Unauthenticated category was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
declare staff_uid text;
begin
  select firebase_uid into staff_uid from public.admin_profiles where is_active and role = 'owner' and firebase_uid is not null limit 1;
  if staff_uid is null then raise exception 'Provision an owner before running the authenticated checks'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_uid,'email_verified',true,'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true);
end;
$$;
set local role anon;
do $$
declare
  fixture text := 'test-' || gen_random_uuid()::text;
  invoice_id text; letter_id text; payload jsonb; before_settings public.company_settings; settings_result jsonb;
begin
  invoice_id := fixture || '-invoice'; letter_id := fixture || '-letter';
  perform public.save_document_studio_records(jsonb_build_array(
    jsonb_build_object('kind','invoice','record_id',invoice_id,'expected_version',0,'archived',false,'data',jsonb_build_object('id',invoice_id,'invoiceNumber',fixture,'clientName','Test client','totalAmount',0)),
    jsonb_build_object('kind','letter','record_id',letter_id,'expected_version',0,'archived',false,'data',jsonb_build_object('id',letter_id,'candidateName','Test candidate'))
  ));
  if (select count(*) from public.document_studio_records where record_id in (invoice_id,letter_id) and version = 1) <> 2 then raise exception 'Registry insert failed'; end if;
  -- A later conflict rolls back earlier successful changes in this batch.
  begin
    perform public.save_document_studio_records(jsonb_build_array(
      jsonb_build_object('kind','invoice','record_id',invoice_id,'expected_version',1,'archived',false,'data',jsonb_build_object('id',invoice_id,'invoiceNumber',fixture,'clientName','Should roll back','totalAmount',99)),
      jsonb_build_object('kind','letter','record_id',letter_id,'expected_version',999,'archived',true,'data',jsonb_build_object('id',letter_id))
    ));
    raise exception 'Stale version was accepted';
  exception when serialization_failure then null;
  end;
  if (select data->>'clientName' from public.document_studio_records where kind = 'invoice' and record_id = invoice_id) <> 'Test client' then raise exception 'Batch was not atomic'; end if;
  begin
    perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','invoice','record_id',fixture || '-duplicate','expected_version',0,'archived',false,'data',jsonb_build_object('id',fixture || '-duplicate','invoiceNumber',fixture))));
    raise exception 'Duplicate invoice number was accepted';
  exception when unique_violation then null;
  end;
  select data into payload from public.document_studio_records where kind = 'invoice' and record_id = invoice_id;
  perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','invoice','record_id',invoice_id,'expected_version',1,'archived',true,'data',payload)));
  if not (select archived and version = 2 and data = payload from public.document_studio_records where kind = 'invoice' and record_id = invoice_id) then raise exception 'Archive changed document contents'; end if;
  select * into before_settings from public.company_settings where id = true;
  begin
    perform public.add_certificate_option('category',null);
    raise exception 'Missing option name was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_document_studio_records(null);
    raise exception 'Missing document batch was accepted';
  exception when invalid_parameter_value then null;
  end;
  settings_result := public.add_certificate_option('category',fixture);
  settings_result := public.add_certificate_option('category',' ' || upper(fixture) || ' ');
  if (select count(*) from jsonb_array_elements_text(settings_result->'certificateCategories') v where lower(v) = fixture) <> 1 then raise exception 'Duplicate category was stored'; end if;
  settings_result := public.add_certificate_option('partner',fixture);
  settings_result := public.add_certificate_option('partner',upper(fixture));
  if (select count(*) from jsonb_array_elements(settings_result->'certificatePartners') v where lower(v->>'name') = fixture) <> 1 then raise exception 'Duplicate partner was stored'; end if;
  if before_settings.id is not null then
    begin
      perform public.save_studio_company_settings(before_settings.settings,before_settings.updated_at);
      raise exception 'Stale settings were accepted';
    exception when serialization_failure then null;
    end;
  end if;
  insert into public.document_studio_drafts(firebase_uid,kind,data) values (auth.jwt()->>'sub','invoice','{"clientName":"Draft test"}') on conflict(firebase_uid,kind) do update set data = excluded.data;
  begin
    insert into public.document_studio_drafts(firebase_uid,kind,data) values ('another-user','invoice','{}');
    raise exception 'Another user draft was writable';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
