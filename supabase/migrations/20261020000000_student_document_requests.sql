-- Students request documents; staff review them before using Document Studio.
create table public.student_document_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('certificate', 'offer_letter')),
  candidate_name text not null check (length(btrim(candidate_name)) between 1 and 120),
  program_name text not null default '',
  certificate_type text not null default '',
  offer_type text,
  designation text not null default '',
  department text not null default '',
  start_date date,
  end_date date,
  details text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'fulfilled')),
  admin_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check ((kind = 'certificate' and length(btrim(program_name)) > 0 and offer_type is null)
    or (kind = 'offer_letter' and offer_type in ('Internship Offer', 'Job Offer') and length(btrim(designation)) > 0))
);
create index student_document_requests_student_created on public.student_document_requests(student_id, created_at desc);
create index student_document_requests_status_created on public.student_document_requests(status, created_at desc);
alter table public.student_document_requests enable row level security;
revoke all on public.student_document_requests from public, anon, authenticated;

create or replace function public.lms_request_document(p_request jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  student uuid := public.lms_student_id();
  request_id uuid;
  requested_kind text := p_request->>'kind';
  offered_type text := p_request->>'offer_type';
  starts date;
  ends date;
begin
  if student is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  if p_request is null or jsonb_typeof(p_request) <> 'object'
    or requested_kind not in ('certificate','offer_letter')
    or length(btrim(coalesce(p_request->>'candidate_name',''))) not between 1 and 120
    or length(coalesce(p_request->>'program_name','')) > 180
    or length(coalesce(p_request->>'certificate_type','')) > 80
    or length(coalesce(p_request->>'designation','')) > 120
    or length(coalesce(p_request->>'department','')) > 120
    or length(coalesce(p_request->>'details','')) > 1000
    or (requested_kind='certificate' and length(btrim(coalesce(p_request->>'program_name',''))) = 0)
    or (requested_kind='offer_letter' and (offered_type not in ('Internship Offer','Job Offer') or length(btrim(coalesce(p_request->>'designation',''))) = 0))
  then raise exception 'Please check your request details.'; end if;
  begin
    starts := nullif(p_request->>'start_date','')::date;
    ends := nullif(p_request->>'end_date','')::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Please enter valid dates.';
  end;
  if starts is not null and ends is not null and ends < starts then raise exception 'End date cannot be before start date.'; end if;
  insert into public.student_document_requests(student_id,kind,candidate_name,program_name,certificate_type,offer_type,designation,department,start_date,end_date,details)
  values (student,requested_kind,btrim(p_request->>'candidate_name'),btrim(coalesce(p_request->>'program_name','')),
    btrim(coalesce(p_request->>'certificate_type','')),case when requested_kind='offer_letter' then offered_type else null end,
    btrim(coalesce(p_request->>'designation','')),btrim(coalesce(p_request->>'department','')),starts,ends,btrim(coalesce(p_request->>'details','')))
  returning id into request_id;
  return request_id;
end $$;

create or replace function public.lms_student_document_requests() returns jsonb
language plpgsql security definer set search_path = public as $$
declare student uuid;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select id into student from public.students where firebase_uid=auth.jwt()->>'sub';
  if student is null then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) - 'student_id' - 'reviewed_by' order by r.created_at desc)
    from public.student_document_requests r where r.student_id=student),'[]'::jsonb);
end $$;

create or replace function public.lms_admin_document_requests() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('student_email',s.email,'student_phone',s.phone,
      'college_name',s.college_name,'student_department',s.department) order by r.created_at desc)
    from public.student_document_requests r join public.students s on s.id=r.student_id),'[]'::jsonb);
end $$;

create or replace function public.lms_review_document_request(p_id uuid, p_status text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_status not in ('approved','declined','fulfilled') or length(coalesce(p_note,'')) > 1000
    or (p_status='declined' and length(btrim(coalesce(p_note,'')))=0)
  then raise exception 'Please check the review details.'; end if;
  update public.student_document_requests set status=p_status,admin_note=btrim(coalesce(p_note,'')),
    reviewed_by=auth.jwt()->>'sub',reviewed_at=now(),updated_at=now()
  where id=p_id and ((status='pending' and p_status in ('approved','declined'))
    or (status='approved' and p_status in ('fulfilled','declined')));
  if not found then raise exception 'This request has already changed. Refresh the queue.'; end if;
end $$;

revoke all on function public.lms_request_document(jsonb) from public;
revoke all on function public.lms_student_document_requests() from public;
revoke all on function public.lms_admin_document_requests() from public;
revoke all on function public.lms_review_document_request(uuid,text,text) from public;
grant execute on function public.lms_request_document(jsonb) to anon,authenticated;
grant execute on function public.lms_student_document_requests() to anon,authenticated;
grant execute on function public.lms_admin_document_requests() to anon,authenticated;
grant execute on function public.lms_review_document_request(uuid,text,text) to anon,authenticated;
notify pgrst, 'reload schema';
