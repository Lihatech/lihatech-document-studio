-- Students can complete their own optional profile without gaining direct table write access.
alter table public.students add column if not exists address text;
alter table public.students add column if not exists profile_type text check (profile_type in ('student','working'));
alter table public.students add column if not exists office_name text;
alter table public.students add column if not exists job_title text;
alter table public.students add column if not exists college_location text;
alter table public.students add column if not exists office_location text;
alter table public.students add column if not exists profile_completed_at timestamptz;

create or replace function public.lms_save_student_profile(p_profile jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare role_value text := nullif(btrim(p_profile->>'profile_type'),'');
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object'
    or length(btrim(coalesce(p_profile->>'full_name',''))) not between 1 and 120
    or (role_value is not null and role_value not in ('student','working'))
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

revoke all on function public.lms_save_student_profile(jsonb) from public;
grant execute on function public.lms_save_student_profile(jsonb) to anon,authenticated;

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
    'batch_id',b.id,'name',b.name,'code',b.code,'batch_status',b.status,'batch_end_date',b.end_date,
    'status',e.status,'starts_at',e.starts_at,'individual_expires_at',e.expires_at,
    'expires_at',case when b.end_date is null then e.expires_at when e.expires_at is null then (b.end_date + 1)::timestamp at time zone 'Asia/Kolkata'
      else least(e.expires_at,(b.end_date + 1)::timestamp at time zone 'Asia/Kolkata') end,'left_at',e.left_at,
    'accessible',public.lms_has_enrollment(b.id))) from public.batch_students e join public.batches b on b.id=e.batch_id where e.student_id=s.id),'[]'::jsonb));
  if s.status <> 'active' then return result || jsonb_build_object('materials','[]'::jsonb,'slots','[]'::jsonb,'bookings','[]'::jsonb); end if;
  return result || jsonb_build_object(
    'materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'module_name',m.module_name,'kind',m.kind,
      'batch_id',bm.batch_id,'course_id',m.course_id,'available_from',bm.available_from,'expires_at',bm.expires_at,
      'accessible',public.lms_can_read_material(m.id) and bm.available_from<=now() and (bm.expires_at is null or now()<bm.expires_at),
      'completed',exists(select 1 from public.material_progress pr where pr.student_id=s.id and pr.material_id=m.id)) order by m.position,m.title)
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
