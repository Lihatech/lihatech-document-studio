-- Per-request durations; new interviews always default to 35 minutes.
-- Apply after 20261103000000_full_lms_corrections.sql.
begin;
create or replace function public.lms_mock_interview_duration() returns integer
language sql stable security definer set search_path=public as $$ select 35; $$;

create or replace function public.lms_admin_set_mock_duration(
  p_booking uuid, p_minutes integer, p_proposal boolean default false
) returns void language plpgsql security definer set search_path=public as $$
declare b public.mock_interview_bookings; s public.mock_interview_slots;
  begins timestamptz; finishes timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Server access required.' using errcode='42501';
  end if;
  if p_minutes is null or p_minutes not between 5 and 180 then raise exception 'Choose 5 to 180 minutes.'; end if;
  perform pg_advisory_xact_lock(61014002);
  select * into b from public.mock_interview_bookings where id=p_booking for update;
  if not found then raise exception 'Interview not found.'; end if;
  select * into s from public.mock_interview_slots where id=b.slot_id for update;
  if not found or s.status<>'open' then raise exception 'Interview slot is no longer open.'; end if;
  if p_proposal then
    if b.status<>'booked' or b.reschedule_starts_at is null then raise exception 'No pending reschedule.'; end if;
    begins:=b.reschedule_starts_at;
  else
    if b.status<>'requested' or b.calendar_event_id is not null then raise exception 'Only pending requests can be edited.'; end if;
    begins:=s.starts_at;
  end if;
  if begins<=now() then raise exception 'This time has passed.'; end if;
  finishes:=begins+make_interval(mins=>p_minutes);
  if exists(select 1 from public.mock_interview_slots other
    where other.id<>s.id and other.status in ('open','full')
      and other.starts_at<finishes and other.ends_at>begins) then
    raise exception 'This duration overlaps another interview.';
  end if;
  if p_proposal then
    update public.mock_interview_bookings set reschedule_ends_at=finishes where id=p_booking;
  else
    update public.mock_interview_slots set ends_at=finishes where id=s.id;
    -- A student may have proposed another time while the initial request was pending.
    update public.mock_interview_bookings
      set reschedule_ends_at=case when reschedule_starts_at is not null
        then reschedule_starts_at+make_interval(mins=>p_minutes) else null end,
        updated_at=now()
      where id=p_booking;
  end if;
end $$;
revoke all on function public.lms_admin_set_mock_duration(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.lms_admin_set_mock_duration(uuid,integer,boolean) to service_role;


-- Exact ends of occupied periods can be offered as new starts, such as 15:05.
create or replace function public.lms_request_mock_time(
  p_uid text, p_starts_at timestamptz, p_first_hour integer, p_last_hour integer, p_prepared_topics text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  sid uuid; sl public.mock_interview_slots; bid uuid;
  local_time timestamp := p_starts_at at time zone 'Asia/Colombo';
  finishes_at timestamptz := p_starts_at + interval '35 minutes';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
  if p_starts_at is null or p_first_hour is null or p_last_hour is null
    or p_starts_at<=now() or p_starts_at>now()+interval '60 days'
    or extract(second from local_time)<>0
    or extract(hour from local_time)*60+extract(minute from local_time)+35>p_last_hour*60
    or extract(hour from local_time)<p_first_hour
    or p_first_hour<0 or p_last_hour>24 or p_first_hour>=p_last_hour
    then raise exception 'This interview time is unavailable.'; end if;
  if p_prepared_topics is null or length(btrim(p_prepared_topics)) not between 1 and 2000 then
    raise exception 'Enter the topics you have prepared (up to 2000 characters).';
  end if;
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
  insert into public.mock_interview_bookings(slot_id,student_id,status,prepared_topics)
    values(sl.id,sid,'requested',btrim(p_prepared_topics))
    on conflict(slot_id,student_id) do update set prepared_topics=excluded.prepared_topics,status='requested',feedback=null,score=null,internal_notes=null,
      meeting_url=null,calendar_event_id=null,calendar_error=null returning id into bid;
  return bid;
end $$;
revoke all on function public.lms_request_mock_time(text,timestamptz,integer,integer,text) from public,anon,authenticated;
grant execute on function public.lms_request_mock_time(text,timestamptz,integer,integer,text) to service_role;

notify pgrst,'reload schema';
commit;
