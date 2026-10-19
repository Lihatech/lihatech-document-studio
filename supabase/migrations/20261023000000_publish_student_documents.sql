-- Studio saves remain drafts. Only an explicit publish exposes a frozen document to its owner.
begin;
alter table public.student_document_requests
  add column studio_record_id text,
  add column published_document jsonb,
  add column published_settings jsonb,
  add column published_version integer,
  add column published_at timestamptz;

create function public.lms_document_branding(p_signing boolean) returns jsonb
language sql stable security definer set search_path=public as $$
  select coalesce((select jsonb_object_agg(key,value) from public.company_settings c,
    lateral jsonb_each(c.settings) where c.id=true and (key=any(array[
      'name','tagline','address','email','phone','website','logoUrl','certTemplate',
      'directorName','directorDesignation','defaultCertText'])
      or (p_signing and key=any(array['signatureUrl','stampUrl'])))),'{}'::jsonb);
$$;
revoke all on function public.lms_document_branding(boolean) from public,anon,authenticated;

create function public.lms_document_preview_settings() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_admin_access() and (not public.lms_verified_user() or not exists(
    select 1 from public.students where firebase_uid=auth.jwt()->>'sub')) then
    raise exception 'Registered access is required.' using errcode='42501';
  end if;
  return public.lms_document_branding(false);
end $$;

create function public.lms_link_request_document() returns trigger
language plpgsql security definer set search_path=public as $$
declare request_id uuid; r public.student_document_requests; registry_kind text;
begin
  if new.kind not in ('certificate','letter') then return new; end if;
  if TG_OP='UPDATE' and nullif(old.data->>'requestId','') is not null
    and (new.data->>'requestId') is distinct from (old.data->>'requestId') then
    raise exception 'A request document cannot be reassigned. Create a separate document.';
  end if;
  if nullif(new.data->>'requestId','') is null then return new; end if;
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  request_id:=(new.data->>'requestId')::uuid;
  select * into r from public.student_document_requests where id=request_id for update;
  if not found or r.status not in ('approved','fulfilled') then
    raise exception 'Approve the request before saving its document.';
  end if;
  registry_kind:=case when r.kind='certificate' then 'certificate' else 'letter' end;
  if new.kind<>registry_kind or (new.kind='letter' and new.data->>'letterType' is distinct from r.offer_type) then
    raise exception 'This document does not match the request type.';
  end if;
  if new.archived then
    if r.status='approved' and r.studio_record_id=new.record_id then
      update public.student_document_requests set studio_record_id=null,updated_at=now() where id=r.id;
    end if;
    return new;
  end if;
  if r.studio_record_id is not null and r.studio_record_id<>new.record_id and exists(
    select 1 from public.document_studio_records where kind=registry_kind and record_id=r.studio_record_id and not archived) then
    raise exception 'This request already has a saved document. Open that document to edit it.';
  end if;
  update public.student_document_requests set studio_record_id=new.record_id,updated_at=now() where id=r.id;
  return new;
end $$;
create trigger link_request_document after insert or update on public.document_studio_records
for each row execute function public.lms_link_request_document();
revoke all on function public.lms_link_request_document() from public,anon,authenticated;

create or replace function public.lms_review_document_request(p_id uuid,p_status text,p_note text default '') returns void
language plpgsql security definer set search_path=public as $$
declare r public.student_document_requests; saved public.document_studio_records; registry_kind text;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_status is null or p_status not in ('approved','declined','fulfilled') or length(coalesce(p_note,''))>1000
    or (p_status='declined' and length(btrim(coalesce(p_note,'')))=0) then raise exception 'Please check the review details.'; end if;
  -- Lock the document before the request, matching the Studio save trigger's lock order.
  if p_status='fulfilled' then
    select d.* into saved from public.document_studio_records d join public.student_document_requests q
      on d.record_id=q.studio_record_id and d.kind=case when q.kind='certificate' then 'certificate' else 'letter' end
      where q.id=p_id and not d.archived for update of d;
    if not found then raise exception 'Save the document in Studio before publishing it to the student.'; end if;
  end if;
  select * into r from public.student_document_requests where id=p_id for update;
  if not found or not ((r.status='pending' and p_status in ('approved','declined'))
    or (r.status='approved' and p_status in ('fulfilled','declined')) or (r.status='fulfilled' and p_status='fulfilled')) then
    raise exception 'This request has changed. Refresh the queue.';
  end if;
  if p_status='fulfilled' then
    if saved.record_id is distinct from r.studio_record_id or saved.data->>'requestId' is distinct from r.id::text
      or length(btrim(coalesce(saved.data->>'candidateName','')))=0
      or coalesce(saved.data->>'startDate','')='' or coalesce(saved.data->>'endDate','')=''
      or (r.kind='certificate' and (coalesce(saved.data->>'certificateId','')='' or coalesce(saved.data->>'programName','')=''))
      or (r.kind='offer_letter' and (coalesce(saved.data->>'designation','')='' or coalesce(saved.data->>'department','')='')) then
      raise exception 'Complete the saved document details before publishing.';
    end if;
    update public.student_document_requests set published_document=saved.data,published_settings=public.lms_document_branding(true),
      published_version=saved.version,published_at=now() where id=r.id;
  end if;
  update public.student_document_requests set status=p_status,admin_note=btrim(coalesce(p_note,'')),
    reviewed_by=auth.jwt()->>'sub',reviewed_at=now(),updated_at=now() where id=r.id;
end $$;

create function public.lms_request_document_content(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare r public.student_document_requests; saved public.document_studio_records; admin_access boolean:=public.has_admin_access();
begin
  if not admin_access and not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select q.* into r from public.student_document_requests q where q.id=p_id and (admin_access or exists(
    select 1 from public.students s where s.id=q.student_id and s.firebase_uid=auth.jwt()->>'sub'));
  if not found then raise exception 'This document is not available.' using errcode='42501'; end if;
  if admin_access then
    select * into saved from public.document_studio_records where record_id=r.studio_record_id
      and kind=case when r.kind='certificate' then 'certificate' else 'letter' end and not archived;
    if found and r.published_version is distinct from saved.version then
      return jsonb_build_object('kind',r.kind,'document',saved.data,'settings',public.lms_document_branding(true),'draft',true);
    end if;
  end if;
  if r.status<>'fulfilled' or r.published_at is null or r.published_document is null then
    raise exception 'Admin has not published this document yet.' using errcode='42501';
  end if;
  return jsonb_build_object('kind',r.kind,'document',r.published_document,'settings',r.published_settings,'draft',false);
end $$;

create or replace function public.lms_student_document_requests() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare student uuid;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select id into student from public.students where firebase_uid=auth.jwt()->>'sub';
  if student is null then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r)-'student_id'-'reviewed_by'-'published_document'-'published_settings' order by r.created_at desc)
    from public.student_document_requests r where r.student_id=student),'[]'::jsonb);
end $$;

create or replace function public.lms_admin_document_requests() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r)-'published_document'-'published_settings'||jsonb_build_object('student_email',s.email,
    'student_phone',coalesce(r.profile_snapshot->>'phone',s.phone),'college_name',coalesce(r.profile_snapshot->>'college_name',s.college_name),
    'student_department',coalesce(r.profile_snapshot->>'department',s.department),'batch_name',b.name,
    'draft_available',d.record_id is not null,'studio_version',d.version) order by r.created_at desc)
    from public.student_document_requests r join public.students s on s.id=r.student_id left join public.batches b on b.id=r.batch_id
    left join public.document_studio_records d on d.record_id=r.studio_record_id and d.kind=case when r.kind='certificate' then 'certificate' else 'letter' end and not d.archived),'[]'::jsonb);
end $$;
revoke all on function public.lms_document_preview_settings(),public.lms_request_document_content(uuid) from public;
grant execute on function public.lms_document_preview_settings(),public.lms_request_document_content(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
