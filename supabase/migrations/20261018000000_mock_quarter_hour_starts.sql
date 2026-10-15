-- Keep each mock interview one hour while allowing starts every 15 minutes.
create or replace function public.lms_request_mock_time(
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
    or mod(extract(minute from local_time)::integer, 15) <> 0 or extract(second from local_time) <> 0
    or extract(hour from local_time) * 60 + extract(minute from local_time) > (p_last_hour - 1) * 60
    or extract(hour from local_time) < p_first_hour
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
