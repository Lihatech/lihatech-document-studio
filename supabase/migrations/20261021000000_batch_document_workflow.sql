-- Batch dates own access; profile and batch data own document request details.
begin;
alter table public.batches
  add column course_name text not null default '',
  add column certificate_type text not null default 'Course Completion',
  add column offer_type text check (offer_type in ('Internship Offer','Job Offer')),
  add column designation text not null default '',
  add column document_department text not null default '';
alter table public.batches add constraint batch_document_lengths check (
  length(course_name)<=180 and length(certificate_type) between 1 and 80
  and length(designation)<=120 and length(document_department)<=120);
alter table public.batches add constraint batch_offer_details check (
  offer_type is null or (length(btrim(designation))>0 and length(btrim(document_department))>0));

-- Preserve older memberships as history; retain one current assignment per student.
with ranked as (
  select e.student_id,e.batch_id,row_number() over (partition by e.student_id order by
    (b.status in ('active','planned') and b.end_date>= (now() at time zone 'Asia/Kolkata')::date) desc,
    (b.start_date<=(now() at time zone 'Asia/Kolkata')::date) desc,
    b.start_date desc nulls last,e.starts_at desc,e.batch_id) as rank
  from public.batch_students e join public.batches b on b.id=e.batch_id
  where e.status in ('active','suspended') and e.left_at is null
)
update public.batch_students e set status='revoked',left_at=now()
from ranked r where r.student_id=e.student_id and r.batch_id=e.batch_id and r.rank>1;
update public.batch_students e set starts_at=b.start_date::timestamp at time zone 'Asia/Kolkata',expires_at=null
from public.batches b where b.id=e.batch_id and b.start_date is not null
and e.left_at is null and e.status in ('active','suspended');
create unique index batch_students_one_current_batch on public.batch_students(student_id)
  where status in ('active','suspended') and left_at is null;

create or replace function public.lms_batch_enrollment_dates() returns trigger
language plpgsql security definer set search_path=public as $$
declare b public.batches;
begin
  if new.status in ('active','suspended') and new.left_at is null then
    perform 1 from public.students where id=new.student_id for update;
    select * into b from public.batches where id=new.batch_id;
    if b.start_date is null or b.end_date is null then raise exception 'Set the batch start and end dates first.'; end if;
    if TG_OP='INSERT' or (TG_OP='UPDATE' and (old.batch_id<>new.batch_id or old.status='revoked' or old.left_at is not null)) then
      if b.status not in ('planned','active') or now()>=(b.end_date+1)::timestamp at time zone 'Asia/Kolkata'
        then raise exception 'Choose an upcoming or active batch.'; end if;
    end if;
    update public.batch_students set status='revoked',left_at=now()
      where student_id=new.student_id and batch_id<>new.batch_id
      and status in ('active','suspended') and left_at is null;
    new.starts_at:=b.start_date::timestamp at time zone 'Asia/Kolkata';
    new.expires_at:=null;
  end if;
  return new;
end $$;
create trigger batch_enrollment_dates before insert or update on public.batch_students
for each row execute function public.lms_batch_enrollment_dates();

create or replace function public.lms_sync_batch_dates() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then
    update public.batch_students set starts_at=new.start_date::timestamp at time zone 'Asia/Kolkata',expires_at=null
      where batch_id=new.id and status in ('active','suspended') and left_at is null;
  end if;
  return new;
end $$;
create trigger sync_batch_dates after update of start_date,end_date on public.batches
for each row execute function public.lms_sync_batch_dates();

create or replace function public.lms_has_enrollment(p_batch uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
    where e.student_id=public.lms_student_id() and e.batch_id=p_batch and e.status='active' and e.left_at is null
    and b.status in ('planned','active')
    and now()>=b.start_date::timestamp at time zone 'Asia/Kolkata'
    and now()<(b.end_date+1)::timestamp at time zone 'Asia/Kolkata');
$$;

create or replace function public.lms_create_student_in_batch(p_email text,p_batch uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid; em text:=lower(btrim(p_email));
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if em is null or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid student email.'; end if;
  insert into public.students(email,full_name) values(em,em) returning id into sid;
  insert into public.batch_students(student_id,batch_id,status) values(sid,p_batch,'active');
  return sid;
end $$;
create or replace function public.lms_assign_student_to_batch(p_student uuid,p_batch uuid,p_status text default 'active') returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_status is null or p_status not in ('active','suspended') then raise exception 'Choose active or suspended access.'; end if;
  insert into public.batch_students(student_id,batch_id,status) values(p_student,p_batch,p_status)
    on conflict(batch_id,student_id) do update set status=excluded.status,left_at=null;
end $$;
create or replace function public.lms_import_students_to_batch(p_rows jsonb,p_batch uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare r jsonb; total integer:=0;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Student rows are required.'; end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Import 1 to 1000 students at a time.'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    perform public.lms_create_student_in_batch(r->>'email',p_batch);
    total:=total+1;
  end loop;
  return total;
end $$;

alter table public.student_document_requests
  add column batch_id uuid references public.batches(id) on delete set null,
  add column profile_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.lms_request_document(p_request jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid:=public.lms_student_id(); s public.students; b public.batches; rid uuid; k text:=p_request->>'kind';
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  if p_request is null or jsonb_typeof(p_request)<>'object' or k is null or k not in ('certificate','offer_letter')
    or length(coalesce(p_request->>'details',''))>1000 then raise exception 'Please check your request.'; end if;
  -- Ignore all client-supplied official fields, including candidate name and dates.
  select * into s from public.students where id=sid for update;
  if s.profile_completed_at is null then raise exception 'Complete your profile first.'; end if;
  select batch.* into b from public.batch_students e join public.batches batch on batch.id=e.batch_id
    where e.student_id=sid and e.status in ('active','suspended') and e.left_at is null and batch.status<>'cancelled'
    order by batch.start_date desc nulls last limit 1;
  if not found then raise exception 'Ask admin to assign your batch first.'; end if;
  if btrim(b.course_name)='' or b.start_date is null or b.end_date is null then
    raise exception 'Ask admin to complete the batch course name and dates first.'; end if;
  if k='offer_letter' and (b.offer_type is null or btrim(b.designation)='' or btrim(b.document_department)='') then
    raise exception 'Ask admin to configure this batch offer type, role and department first.'; end if;
  if exists(select 1 from public.student_document_requests where student_id=sid and batch_id=b.id
    and kind=k and status in ('pending','approved')) then raise exception 'You already have an open request for this document.'; end if;
  insert into public.student_document_requests(student_id,batch_id,kind,candidate_name,program_name,certificate_type,
    offer_type,designation,department,start_date,end_date,details,profile_snapshot)
  values(sid,b.id,k,s.full_name,b.course_name,b.certificate_type,case when k='offer_letter' then b.offer_type end,
    case when k='offer_letter' then b.designation else '' end,case when k='offer_letter' then b.document_department else '' end,
    b.start_date,b.end_date,btrim(coalesce(p_request->>'details','')),jsonb_build_object('email',s.email,'phone',s.phone,
    'college_name',s.college_name,'department',s.department,'address',s.address)) returning id into rid;
  return rid;
end $$;

create or replace function public.lms_admin_document_requests() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('student_email',s.email,
    'student_phone',coalesce(r.profile_snapshot->>'phone',s.phone),'college_name',coalesce(r.profile_snapshot->>'college_name',s.college_name),
    'student_department',coalesce(r.profile_snapshot->>'department',s.department),'batch_name',b.name) order by r.created_at desc)
    from public.student_document_requests r join public.students s on s.id=r.student_id left join public.batches b on b.id=r.batch_id),'[]'::jsonb);
end $$;

create or replace function public.lms_admin_update_document_request(p_id uuid,p_fields jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare r public.student_document_requests; k text;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  select * into r from public.student_document_requests where id=p_id and status in ('pending','approved') for update;
  if not found then raise exception 'This request is closed or was changed. Refresh the queue.'; end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object' then raise exception 'Document details are required.'; end if;
  foreach k in array array['candidate_name','program_name','certificate_type','designation','department'] loop
    if p_fields?k then r:=jsonb_populate_record(r,jsonb_build_object(k,btrim(p_fields->>k))); end if;
  end loop;
  if p_fields?'offer_type' then r.offer_type:=p_fields->>'offer_type'; end if;
  if p_fields?'start_date' then r.start_date:=nullif(p_fields->>'start_date','')::date; end if;
  if p_fields?'end_date' then r.end_date:=nullif(p_fields->>'end_date','')::date; end if;
  if length(coalesce(r.candidate_name,'')) not between 1 and 120 or length(r.program_name)>180
    or length(r.certificate_type) not between 1 and 80 or length(r.designation)>120 or length(r.department)>120
    or r.start_date is null or r.end_date is null or r.end_date<r.start_date
    or (r.kind='certificate' and btrim(r.program_name)='')
    or (r.kind='offer_letter' and (r.offer_type is null or r.offer_type not in ('Internship Offer','Job Offer')
      or btrim(r.designation)='' or btrim(r.department)='')) then raise exception 'Check the required document details and dates.'; end if;
  update public.student_document_requests set candidate_name=r.candidate_name,program_name=r.program_name,
    certificate_type=r.certificate_type,offer_type=r.offer_type,designation=r.designation,department=r.department,
    start_date=r.start_date,end_date=r.end_date,updated_at=now(),reviewed_by=auth.jwt()->>'sub' where id=p_id;
end $$;

revoke all on function public.lms_batch_enrollment_dates(),public.lms_sync_batch_dates() from public,anon,authenticated;
revoke all on function public.lms_create_student_in_batch(text,uuid),public.lms_assign_student_to_batch(uuid,uuid,text),public.lms_import_students_to_batch(jsonb,uuid),
  public.lms_admin_update_document_request(uuid,jsonb) from public;
grant execute on function public.lms_create_student_in_batch(text,uuid),public.lms_assign_student_to_batch(uuid,uuid,text),public.lms_import_students_to_batch(jsonb,uuid),
  public.lms_admin_update_document_request(uuid,jsonb) to anon,authenticated;

create or replace function public.lms_suggest_document_correction(p_id uuid,p_suggestion text) returns void
language plpgsql security definer set search_path=public as $$
declare sid uuid:=public.lms_student_id();
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_suggestion,''))) not between 1 and 1000 then raise exception 'Enter a suggestion of up to 1000 characters.'; end if;
  update public.student_document_requests set details=btrim(p_suggestion),updated_at=now()
    where id=p_id and student_id=sid and status in ('pending','approved');
  if not found then raise exception 'This request is closed or is not yours.' using errcode='42501'; end if;
end $$;
revoke all on function public.lms_suggest_document_correction(uuid,text) from public;
grant execute on function public.lms_suggest_document_correction(uuid,text) to anon,authenticated;

-- Student home projection includes batch document defaults.
create or replace function public.lms_student_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.students; result jsonb;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  result := jsonb_build_object('student',jsonb_build_object('id',s.id,'full_name',s.full_name,'email',s.email,'status',s.status,
    'phone',s.phone,'address',s.address,'profile_type',s.profile_type,'college_name',s.college_name,
    'department',s.department,'college_location',s.college_location,'office_name',s.office_name,
    'job_title',s.job_title,'office_location',s.office_location,
    'profile_completed_at',s.profile_completed_at), 'server_time',now());
  result := result || jsonb_build_object('enrollments',coalesce((select jsonb_agg(jsonb_build_object(
    'batch_id',b.id,'name',b.name,'code',b.code,'batch_status',b.status,'batch_start_date',b.start_date,'batch_end_date',b.end_date,
    'course_name',b.course_name,'certificate_type',b.certificate_type,'offer_type',b.offer_type,'designation',b.designation,'document_department',b.document_department,
    'status',e.status,'starts_at',b.start_date::timestamp at time zone 'Asia/Kolkata','individual_expires_at',e.expires_at,
    'expires_at',case when b.end_date is null then e.expires_at when e.expires_at is null then (b.end_date + 1)::timestamp at time zone 'Asia/Kolkata'
      else least(e.expires_at,(b.end_date + 1)::timestamp at time zone 'Asia/Kolkata') end,'left_at',e.left_at,
    'accessible',public.lms_has_enrollment(b.id))) from public.batch_students e join public.batches b on b.id=e.batch_id where e.student_id=s.id),'[]'::jsonb));
  if s.status <> 'active' then return result || jsonb_build_object('materials','[]'::jsonb,'slots','[]'::jsonb,'bookings','[]'::jsonb); end if;
  return result || jsonb_build_object(
    'materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'module_name',m.module_name,'kind',m.kind,
      'batch_id',bm.batch_id,'course_id',m.course_id,'available_from',bm.available_from,'expires_at',bm.expires_at,
      'accessible',public.lms_can_read_material(m.id) and bm.available_from<=now() and (bm.expires_at is null or now()<bm.expires_at),
      'completed',exists(select 1 from public.material_progress pr where pr.student_id=s.id and pr.material_id=m.id)) order by m.title,m.id)
      from public.learning_materials m join public.batch_materials bm on bm.material_id=m.id where m.status='published' and public.lms_has_enrollment(bm.batch_id)
      and (m.course_id is null or exists(select 1 from public.batch_courses bc where bc.batch_id=bm.batch_id and bc.course_id=m.course_id))), '[]'::jsonb),
    'slots',coalesce((select jsonb_agg(jsonb_build_object('id',sl.id,'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,
      'booking_deadline',sl.booking_deadline,'remaining',1) order by sl.starts_at)
      from public.mock_interview_slots sl where sl.batch_id is null and sl.status='open' and sl.starts_at>now()
      and (sl.booking_deadline is null or sl.booking_deadline>now())
      and not exists(select 1 from public.mock_interview_bookings bk where bk.slot_id=sl.id
        and bk.status in ('requested','approving','booked','completed','no_show'))), '[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',bk.id,'slot_id',sl.id,'status',bk.status,'feedback',bk.feedback,'score',bk.score,
      'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,'slot_status',sl.status,
      'meeting_url',case when bk.status='booked' and sl.status<>'cancelled' then coalesce(bk.meeting_url,sl.meeting_url) else null end) order by sl.starts_at desc)
      from public.mock_interview_bookings bk join public.mock_interview_slots sl on sl.id=bk.slot_id where bk.student_id=s.id), '[]'::jsonb));
end $$;


notify pgrst, 'reload schema';
commit;
