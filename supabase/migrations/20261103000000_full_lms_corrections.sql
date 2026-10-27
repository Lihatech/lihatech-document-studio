-- LihaTech LMS consolidated corrections
-- Includes:
--   1. Admin-controlled interview duration, default 35 minutes
--   2. Students may belong to multiple batches
--   3. Excel imports merge existing students and do not fail on duplicates
begin;

/* 1. Interview duration */
insert into public.company_settings (id, settings)
values (true, jsonb_build_object('mock_interview_duration_minutes', 35))
on conflict (id) do update
set settings = case
  when public.company_settings.settings ? 'mock_interview_duration_minutes'
    then public.company_settings.settings
  else public.company_settings.settings || jsonb_build_object('mock_interview_duration_minutes', 35)
end;

drop policy if exists admin_full_access_company_settings on public.company_settings;
create policy admin_manage_interview_settings on public.company_settings
  for all to authenticated
  using (exists (select 1 from public.admin_profiles where id=auth.uid() and is_active and role in ('owner','admin')))
  with check (exists (select 1 from public.admin_profiles where id=auth.uid() and is_active and role in ('owner','admin')));

create or replace function public.lms_mock_interview_duration()
returns integer
language sql stable security definer set search_path=public
as $$
  select greatest(5, least(180, coalesce((settings->>'mock_interview_duration_minutes')::integer, 35)))
  from public.company_settings where id=true;
$$;
grant execute on function public.lms_mock_interview_duration() to authenticated;

drop function if exists public.lms_request_mock_time(text,timestamptz,integer,integer,text);
create function public.lms_request_mock_time(
  p_uid text, p_starts_at timestamptz, p_first_hour integer, p_last_hour integer, p_prepared_topics text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  sid uuid; sl public.mock_interview_slots; bid uuid;
  local_time timestamp := p_starts_at at time zone 'Asia/Colombo';
  duration_minutes integer := public.lms_mock_interview_duration();
  finishes_at timestamptz := p_starts_at + make_interval(mins => duration_minutes);
begin
  if auth.role() <> 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
  if p_starts_at <= now() or p_starts_at > now() + interval '60 days'
    or mod(extract(minute from local_time)::integer,15) <> 0
    or extract(second from local_time) <> 0
    or extract(hour from local_time)*60 + extract(minute from local_time) + duration_minutes > p_last_hour*60
    or extract(hour from local_time) < p_first_hour
    or p_first_hour < 0 or p_last_hour > 24 or p_first_hour >= p_last_hour
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

/* 2. Allow one student in multiple batches */
drop index if exists public.batch_students_one_current_batch;

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
    new.starts_at:=b.start_date::timestamp at time zone 'Asia/Kolkata';
    new.expires_at:=null;
  end if;
  return new;
end $$;

create or replace function public.lms_create_student_in_batch(p_email text,p_batch uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid; existing public.students; em text:=lower(btrim(p_email));
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if em is null or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid student email.'; end if;
  if not exists(select 1 from public.batches where id=p_batch) then raise exception 'The selected batch was not found.'; end if;
  select * into existing from public.students where lower(trim(email))=em for update;
  if found then
    sid:=existing.id;
    if exists(select 1 from public.batch_students where student_id=sid and batch_id=p_batch and status in ('active','suspended') and left_at is null) then
      raise exception 'Student % (% / %) is already in this batch.', em, coalesce(existing.student_code,'no student ID'), coalesce(existing.full_name,'unnamed');
    end if;
    insert into public.batch_students(student_id,batch_id,status) values(sid,p_batch,'active')
      on conflict(batch_id,student_id) do update set status='active',left_at=null;
    update public.students set status='active',updated_at=now() where id=sid;
    return sid;
  end if;
  insert into public.students(email,full_name) values(em,em) returning id into sid;
  insert into public.batch_students(student_id,batch_id,status) values(sid,p_batch,'active');
  return sid;
end $$;

create or replace function public.lms_assign_student_to_batch(p_student uuid,p_batch uuid,p_status text default 'active') returns void
language plpgsql security definer set search_path=public as $$
declare s public.students;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_status not in ('active','suspended') then raise exception 'Choose active or suspended access.'; end if;
  select * into s from public.students where id=p_student;
  if not found then raise exception 'Student not found.'; end if;
  if exists(select 1 from public.batch_students where student_id=p_student and batch_id=p_batch and status in ('active','suspended') and left_at is null) then
    raise exception 'Student % (% / %) is already in this batch.', s.email, coalesce(s.student_code,'no student ID'), coalesce(s.full_name,'unnamed');
  end if;
  insert into public.batch_students(student_id,batch_id,status) values(p_student,p_batch,p_status)
    on conflict(batch_id,student_id) do update set status=excluded.status,left_at=null;
end $$;

create or replace function public.lms_admin_save_student(p_id uuid,p_email text,p_batch uuid,p_access text default 'active') returns void
language plpgsql security definer set search_path=public as $$
declare s public.students; email_value text:=lower(btrim(p_email));
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if email_value is null or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_batch is null
    or p_access not in ('active','suspended','revoked') then raise exception 'Check the email, batch and access.'; end if;
  select * into s from public.students where id=p_id for update;
  if not found then raise exception 'Student not found.'; end if;
  if exists(select 1 from public.students other where lower(trim(other.email))=email_value and other.id<>p_id) then
    raise exception 'Email % already belongs to another student. Use that student record to add the batch.', email_value;
  end if;
  update public.students set email=email_value, firebase_uid=case when email is distinct from email_value then null else firebase_uid end,
    status=case when p_access='active' then 'active' else status end,updated_at=now() where id=p_id;
  if p_access='revoked' then
    update public.batch_students set status='revoked',left_at=now() where student_id=p_id and batch_id=p_batch;
    if not found then raise exception 'This student has no access to the selected batch.'; end if;
  elsif not exists(select 1 from public.batch_students where student_id=p_id and batch_id=p_batch and status=p_access and left_at is null) then
    perform public.lms_assign_student_to_batch(p_id,p_batch,p_access);
  end if;
end $$;

/* 3. Merge duplicate students during Excel import */
create or replace function public.lms_import_students_to_batch(p_rows jsonb,p_batch uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare r jsonb; total integer:=0; em text; existing public.students;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Student rows are required.'; end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Import 1 to 1000 students at a time.'; end if;
  if not exists(select 1 from public.batches where id=p_batch) then raise exception 'The selected batch was not found.'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    em:=lower(btrim(r->>'email'));
    if em is null or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Enter a valid student email: %.', coalesce(r->>'email','(blank)');
    end if;
    select * into existing from public.students where lower(trim(email))=em for update;
    if found then
      insert into public.batch_students(student_id,batch_id,status) values(existing.id,p_batch,'active')
        on conflict(batch_id,student_id) do update set status='active',left_at=null;
      update public.students set status='active',updated_at=now() where id=existing.id;
    else
      perform public.lms_create_student_in_batch(em,p_batch);
    end if;
    total:=total+1;
  end loop;
  return total;
end $$;

revoke all on function public.lms_create_student_in_batch(text,uuid),public.lms_assign_student_to_batch(uuid,uuid,text),public.lms_import_students_to_batch(jsonb,uuid) from public;
grant execute on function public.lms_create_student_in_batch(text,uuid),public.lms_assign_student_to_batch(uuid,uuid,text),public.lms_import_students_to_batch(jsonb,uuid) to anon,authenticated;
revoke all on function public.lms_admin_save_student(uuid,text,uuid,text) from public;
grant execute on function public.lms_admin_save_student(uuid,text,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
