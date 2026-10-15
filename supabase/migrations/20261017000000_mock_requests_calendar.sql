-- Mock interviews are available to every active student, independent of batches.
-- Keep the old batch_id nullable so historical slots remain intact.
alter table public.mock_interview_slots alter column batch_id drop not null;
alter table public.mock_interview_bookings drop constraint if exists mock_interview_bookings_status_check;
alter table public.mock_interview_bookings add constraint mock_interview_bookings_status_check
  check (status in ('requested','approving','booked','rejected','cancelled','completed','no_show'));
alter table public.mock_interview_bookings add column calendar_event_id text unique;
alter table public.mock_interview_bookings add column meeting_url text;
alter table public.mock_interview_bookings add column calendar_error text;
alter table public.mock_interview_bookings add constraint mock_booking_meet_https
  check (meeting_url is null or meeting_url ~ '^https://meet[.]google[.]com/');

-- One interviewer in version 1: reject overlapping new/edited open slots.
create function public.lms_mock_slot_window() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(61014002);
  if new.status='open' and exists(select 1 from public.mock_interview_slots other
    where other.id<>new.id and other.status='open' and other.starts_at<new.ends_at and other.ends_at>new.starts_at)
    then raise exception 'This time overlaps another mock interview slot.'; end if;
  return new;
end $$;
create trigger mock_slot_window before insert or update of starts_at,ends_at,status on public.mock_interview_slots
  for each row execute function public.lms_mock_slot_window();

-- One interview per slot. The row lock serializes concurrent student requests.
create or replace function public.lms_enforce_mock_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.mock_interview_slots where id=new.slot_id for update;
  if new.status in ('requested','approving','booked','completed','no_show') and exists(
    select 1 from public.mock_interview_bookings b where b.slot_id=new.slot_id and b.id<>new.id
      and b.status in ('requested','approving','booked','completed','no_show')
  ) then raise exception 'This interview slot is already reserved.'; end if;
  return new;
end $$;

create or replace function public.lms_student_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.students; result jsonb;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  result := jsonb_build_object('student',jsonb_build_object('id',s.id,'full_name',s.full_name,'email',s.email,'status',s.status), 'server_time',now());
  result := result || jsonb_build_object('enrollments',coalesce((select jsonb_agg(jsonb_build_object(
    'batch_id',b.id,'name',b.name,'code',b.code,'batch_status',b.status,'batch_end_date',b.end_date,
    'status',e.status,'starts_at',e.starts_at,'individual_expires_at',e.expires_at,
    'expires_at',case when b.end_date is null then e.expires_at when e.expires_at is null then (b.end_date + 1)::timestamp at time zone 'Asia/Colombo'
      else least(e.expires_at,(b.end_date + 1)::timestamp at time zone 'Asia/Colombo') end,'left_at',e.left_at,
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

create or replace function public.lms_book_mock(p_slot uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sl public.mock_interview_slots; sid uuid := public.lms_student_id(); bid uuid;
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  perform 1 from public.students where id=sid for update;
  select * into sl from public.mock_interview_slots where id=p_slot for update;
  if not found or sl.batch_id is not null or sl.status<>'open' or sl.starts_at<=now()
    or (sl.booking_deadline is not null and sl.booking_deadline<=now())
    then raise exception 'This slot is unavailable.' using errcode='42501'; end if;
  if exists(select 1 from public.mock_interview_bookings b join public.mock_interview_slots x on x.id=b.slot_id
    where b.student_id=sid and b.status in ('requested','approving','booked') and x.status<>'cancelled'
      and x.starts_at<sl.ends_at and x.ends_at>sl.starts_at)
    then raise exception 'You already have an interview request at this time.'; end if;
  if exists(select 1 from public.mock_interview_bookings where slot_id=p_slot
    and status in ('requested','approving','booked','completed','no_show'))
    then raise exception 'This slot has already been requested.'; end if;
  insert into public.mock_interview_bookings(slot_id,student_id,status)
    values(p_slot,sid,'requested')
    on conflict(slot_id,student_id) do update set status='requested',feedback=null,score=null,internal_notes=null,
      meeting_url=null,calendar_event_id=null,calendar_error=null returning id into bid;
  return bid;
end $$;

-- A student may withdraw a pending request. Confirmed events are cancelled through the
-- authenticated API, which also removes the Google Calendar invitation.
create or replace function public.lms_cancel_mock(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.mock_interview_bookings; sl public.mock_interview_slots;
begin
  select * into b from public.mock_interview_bookings where id=p_booking and student_id=public.lms_student_id() for update;
  if not found then raise exception 'Your request was not found.' using errcode='42501'; end if;
  select * into sl from public.mock_interview_slots where id=b.slot_id for update;
  if sl.starts_at<=now() or b.status<>'requested' then raise exception 'This request cannot be withdrawn here.'; end if;
  update public.mock_interview_bookings set status='cancelled' where id=b.id;
end $$;

create index mock_requests_slot_status_idx on public.mock_interview_bookings(slot_id,status);

-- The API checks Google free/busy, then this transaction reserves the hour.
-- Only the server's service role may choose a student UID.
create function public.lms_request_mock_time(
  p_uid text, p_starts_at timestamptz, p_first_hour integer, p_last_hour integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; sl public.mock_interview_slots; bid uuid;
  local_time timestamp := p_starts_at at time zone 'Asia/Colombo';
  finishes_at timestamptz := p_starts_at + interval '1 hour';
begin
  if auth.role() <> 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
  if p_starts_at <= now() or p_starts_at > now() + interval '60 days'
    or extract(minute from local_time) <> 0 or extract(second from local_time) <> 0
    or extract(hour from local_time) < p_first_hour or extract(hour from local_time) >= p_last_hour
    or p_first_hour < 0 or p_last_hour > 24 or p_first_hour >= p_last_hour
    then raise exception 'This interview time is unavailable.'; end if;
  select id into sid from public.students where firebase_uid=p_uid and status='active' for update;
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(61014002);
  select * into sl from public.mock_interview_slots
    where status in ('open','full') and starts_at<finishes_at and ends_at>p_starts_at
    order by starts_at limit 1 for update;
  if found then
    if sl.status<>'open' or sl.batch_id is not null or sl.starts_at<>p_starts_at or sl.ends_at<>finishes_at
      or (sl.booking_deadline is not null and sl.booking_deadline<=now())
      then raise exception 'This interview time is unavailable.'; end if;
  else
    insert into public.mock_interview_slots(batch_id,mentor_name,starts_at,ends_at,capacity,status)
      values(null,'LihaTech interviewer',p_starts_at,finishes_at,1,'open') returning * into sl;
  end if;
  if exists(select 1 from public.mock_interview_bookings b join public.mock_interview_slots x on x.id=b.slot_id
    where b.student_id=sid and b.status in ('requested','approving','booked')
      and x.status<>'cancelled' and x.starts_at<finishes_at and x.ends_at>p_starts_at)
    then raise exception 'You already have an interview request at this time.'; end if;
  if exists(select 1 from public.mock_interview_bookings
    where slot_id=sl.id and status in ('requested','approving','booked','completed','no_show'))
    then raise exception 'This interview time was just taken.'; end if;
  insert into public.mock_interview_bookings(slot_id,student_id,status)
    values(sl.id,sid,'requested')
    on conflict(slot_id,student_id) do update set status='requested',feedback=null,score=null,internal_notes=null,
      meeting_url=null,calendar_event_id=null,calendar_error=null returning id into bid;
  return bid;
end $$;
revoke all on function public.lms_request_mock_time(text,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.lms_request_mock_time(text,timestamptz,integer,integer) to service_role;
