-- Reviewing, saving and issuing a request is one atomic admin action.
begin;
create function public.lms_approve_document_request(
  p_id uuid, p_document jsonb, p_expected_updated_at timestamptz,
  p_expected_version integer default 0, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.student_document_requests; saved public.document_studio_records;
  registry_kind text; fields jsonb; result jsonb;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  -- Same lock order as registry saves and publication: document, then request.
  select d.* into saved from public.document_studio_records d join public.student_document_requests q
    on d.record_id=q.studio_record_id and d.kind=case when q.kind='certificate' then 'certificate' else 'letter' end
    where q.id=p_id and not d.archived for update of d;
  select * into r from public.student_document_requests where id=p_id for update;
  if not found or r.status not in ('pending','approved') or p_expected_updated_at is null
    or r.updated_at is distinct from p_expected_updated_at
    or coalesce(saved.version,0) is distinct from p_expected_version then
    raise exception 'This request changed. Close it and refresh before approving.' using errcode='40001';
  end if;
  if p_document is null or jsonb_typeof(p_document)<>'object'
    or length(coalesce(p_document->>'id','')) not between 1 and 200
    or (saved.record_id is not null and saved.record_id is distinct from p_document->>'id')
    or coalesce(p_document->>'issueDate','')='' or length(coalesce(p_note,''))>1000 then
    raise exception 'Check the document details before approving.';
  end if;
  perform (p_document->>'issueDate')::date;
  registry_kind:=case when r.kind='certificate' then 'certificate' else 'letter' end;
  fields:=jsonb_build_object('candidate_name',p_document->>'candidateName',
    'start_date',p_document->>'startDate','end_date',p_document->>'endDate');
  if r.kind='certificate' then
    if length(btrim(coalesce(p_document->>'certificateId','')))=0 then raise exception 'Certificate number is required.'; end if;
    fields:=fields||jsonb_build_object('program_name',p_document->>'programName','certificate_type',p_document->>'certificateType');
  else
    if p_document->>'letterType' is distinct from r.offer_type then raise exception 'The offer type must match this request.'; end if;
    if not (r.offer_type='Internship Offer' and coalesce((p_document->>'noStipend')::boolean,false))
      and btrim(coalesce(p_document->>'stipend',''))='' then raise exception 'Confirm the agreed compensation before approving.'; end if;
    fields:=fields||jsonb_build_object('designation',p_document->>'designation','department',p_document->>'department');
  end if;
  perform public.lms_admin_update_document_request(p_id,fields);
  update public.student_document_requests set status='approved' where id=p_id;
  p_document:=p_document||jsonb_build_object('requestId',p_id);
  perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object(
    'kind',registry_kind,'record_id',p_document->>'id','data',p_document,
    'expected_version',p_expected_version,'archived',false)));
  perform public.lms_review_document_request(p_id,'fulfilled',p_note);
  select to_jsonb(d) into result from public.document_studio_records d
    where d.kind=registry_kind and d.record_id=p_document->>'id';
  return jsonb_build_object('record',result,'request',(select value from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=p_id::text));
end $$;
revoke all on function public.lms_approve_document_request(uuid,jsonb,timestamptz,integer,text) from public;
grant execute on function public.lms_approve_document_request(uuid,jsonb,timestamptz,integer,text) to anon,authenticated;

-- Opening an issued request always shows the copy actually delivered, even if
-- someone later edits its separate registry record.
create or replace function public.lms_request_document_content(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare r public.student_document_requests; saved public.document_studio_records; admin_access boolean:=public.has_admin_access();
begin
  if not admin_access and not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select q.* into r from public.student_document_requests q where q.id=p_id and (admin_access or exists(
    select 1 from public.students s where s.id=q.student_id and s.firebase_uid=auth.jwt()->>'sub'));
  if not found then raise exception 'This document is not available.' using errcode='42501'; end if;
  if r.status='fulfilled' and r.published_at is not null and r.published_document is not null then
    return jsonb_build_object('kind',r.kind,'document',r.published_document,'settings',r.published_settings,'draft',false);
  end if;
  if admin_access then
    select * into saved from public.document_studio_records where record_id=r.studio_record_id
      and kind=case when r.kind='certificate' then 'certificate' else 'letter' end and not archived;
    if found then return jsonb_build_object('kind',r.kind,'document',saved.data,'settings',public.lms_document_branding(true),'draft',true); end if;
  end if;
  raise exception 'The document will be available after admin approval.' using errcode='42501';
end $$;
notify pgrst,'reload schema';
commit;
