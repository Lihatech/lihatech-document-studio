-- Personal details may be corrected during a document request; programme fields stay admin-owned.
begin;
alter table public.student_document_requests drop constraint student_document_requests_candidate_name_check;
alter table public.student_document_requests add constraint student_document_requests_candidate_name_check check (length(btrim(candidate_name)) between 1 and 126);
alter table public.students add column salutation text not null default ''
  check (salutation in ('','Mr.','Ms.','Mrs.','Mx.','Dr.'));

create or replace function public.lms_normalize_name(p_name text) returns text
language plpgsql immutable set search_path=public as $$
declare n text:=btrim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g')); i integer;
begin
  n:=regexp_replace(n,'^((mr|mrs|ms|mx|dr)\.?[[:space:]]+)+','','i');
  if n=lower(n) or n=upper(n) then
    n:=lower(n);
    for i in 1..char_length(n) loop
      if i=1 or substr(n,i-1,1) in (' ','''','’','-') then
        n:=overlay(n placing upper(substr(n,i,1)) from i for 1);
      end if;
    end loop;
  end if;
  return n;
end $$;

create or replace function public.lms_normalize_student_name() returns trigger
language plpgsql set search_path=public as $$
declare prefix text:=lower(substring(btrim(regexp_replace(new.full_name,'[[:space:]]+',' ','g')) from '(?i)^(mr|mrs|ms|mx|dr)\.?[[:space:]]'));
begin
  if position('@' in new.full_name)=0 then
    if new.salutation='' and prefix is not null then new.salutation:=initcap(prefix)||'.'; end if;
    new.full_name:=public.lms_normalize_name(new.full_name);
  end if;
  return new;
end $$;
create trigger normalize_student_name before insert or update of full_name,salutation on public.students
for each row execute function public.lms_normalize_student_name();
revoke all on function public.lms_normalize_student_name() from public,anon,authenticated;

create or replace function public.lms_save_student_profile(p_profile jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare role_value text := nullif(btrim(p_profile->>'profile_type'),'');
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object'
    or length(public.lms_normalize_name(p_profile->>'full_name')) not between 1 and 120
    or (role_value is not null and role_value not in ('student','working'))
    or (p_profile ? 'salutation' and coalesce(p_profile->>'salutation','') not in ('','Mr.','Ms.','Mrs.','Mx.','Dr.'))
    or length(coalesce(p_profile->>'phone','')) > 40
    or length(coalesce(p_profile->>'address','')) > 500
    or length(coalesce(p_profile->>'college_name','')) > 160
    or length(coalesce(p_profile->>'department','')) > 160
    or length(coalesce(p_profile->>'office_name','')) > 160
    or length(coalesce(p_profile->>'job_title','')) > 120
    or length(coalesce(p_profile->>'college_location','')) > 160
    or length(coalesce(p_profile->>'office_location','')) > 160
    then raise exception 'Please check the profile details and try again.'; end if;
  update public.students set
    full_name = btrim(p_profile->>'full_name'),
    salutation = coalesce(p_profile->>'salutation',salutation),
    phone = nullif(btrim(p_profile->>'phone'),''),
    address = nullif(btrim(p_profile->>'address'),''),
    profile_type = role_value,
    college_name = case when role_value='student' then nullif(btrim(p_profile->>'college_name'),'') else null end,
    department = case when role_value='student' then nullif(btrim(p_profile->>'department'),'') else null end,
    college_location = case when role_value='student' then nullif(btrim(p_profile->>'college_location'),'') else null end,
    office_name = case when role_value='working' then nullif(btrim(p_profile->>'office_name'),'') else null end,
    job_title = case when role_value='working' then nullif(btrim(p_profile->>'job_title'),'') else null end,
    office_location = case when role_value='working' then nullif(btrim(p_profile->>'office_location'),'') else null end,
    profile_completed_at = coalesce(profile_completed_at,now()),
    updated_at = now()
  where firebase_uid = auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
end $$;

create or replace function public.lms_request_document(p_request jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid:=public.lms_student_id(); s public.students; b public.batches; rid uuid; k text:=p_request->>'kind';
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  if p_request is null or jsonb_typeof(p_request)<>'object' or k is null or k not in ('certificate','offer_letter')
    or length(coalesce(p_request->>'details',''))>1000 then raise exception 'Please check your request.'; end if;
  -- Only personal profile fields are editable; batch fields always come from the database.
  if p_request ? 'profile' then perform public.lms_save_student_profile(p_request->'profile'); end if;
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
  values(sid,b.id,k,concat_ws(' ',nullif(s.salutation,''),s.full_name),b.course_name,b.certificate_type,case when k='offer_letter' then b.offer_type end,
    case when k='offer_letter' then b.designation else '' end,case when k='offer_letter' then b.document_department else '' end,
    b.start_date,b.end_date,btrim(coalesce(p_request->>'details','')),jsonb_build_object('salutation',s.salutation,'full_name',s.full_name,'email',s.email,'phone',s.phone,
    'college_name',s.college_name,'department',s.department,'address',s.address)) returning id into rid;
  return rid;
end $$;

create or replace function public.lms_student_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.students; result jsonb;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  result := jsonb_build_object('student',jsonb_build_object('id',s.id,'full_name',s.full_name,'salutation',s.salutation,'email',s.email,'status',s.status,
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
  if length(coalesce(r.candidate_name,'')) not between 1 and 126 or length(r.program_name)>180
    or length(r.certificate_type) not between 1 and 80 or length(r.designation)>120 or length(r.department)>120
    or r.start_date is null or r.end_date is null or r.end_date<r.start_date
    or (r.kind='certificate' and btrim(r.program_name)='')
    or (r.kind='offer_letter' and (r.offer_type is null or r.offer_type not in ('Internship Offer','Job Offer')
      or btrim(r.designation)='' or btrim(r.department)='')) then raise exception 'Check the required document details and dates.'; end if;
  update public.student_document_requests set candidate_name=r.candidate_name,program_name=r.program_name,
    certificate_type=r.certificate_type,offer_type=r.offer_type,designation=r.designation,department=r.department,
    start_date=r.start_date,end_date=r.end_date,updated_at=now(),reviewed_by=auth.jwt()->>'sub' where id=p_id;
end $$;
notify pgrst, 'reload schema';
commit;
