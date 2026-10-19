-- Rollback-only booking checks; no calendar events or real invitations.
begin;
insert into public.students(id,full_name,email,firebase_uid)
values('27000000-0000-4000-8000-000000000001','Topics Test','topics-test@example.invalid','topics-test');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$ declare chosen timestamptz; bid uuid; denied boolean; topics text; begin
  select d into chosen from generate_series(
    ((current_date+30)::timestamp+time '09:00') at time zone 'Asia/Colombo',
    ((current_date+50)::timestamp+time '09:00') at time zone 'Asia/Colombo',interval '1 day') d
  where not exists(select 1 from public.mock_interview_slots s where s.status in ('open','full')
    and s.starts_at<d+interval '1 hour' and s.ends_at>d) limit 1;
  if chosen is null then raise exception 'No isolated test time available'; end if;
  foreach topics in array array['','   ',repeat('x',2001)] loop
    denied:=false;
    begin perform public.lms_request_mock_time('topics-test',chosen,9,18,topics);
    exception when others then denied:=true; end;
    if not denied then raise exception 'Invalid topics accepted'; end if;
  end loop;
  bid:=public.lms_request_mock_time('topics-test',chosen,9,18,'  SQL joins, Java OOP  ');
  if not exists(select 1 from public.mock_interview_bookings where id=bid and prepared_topics='SQL joins, Java OOP') then
    raise exception 'Preparation was not saved atomically'; end if;
  update public.mock_interview_bookings set status='cancelled' where id=bid;
  perform public.lms_request_mock_time('topics-test',chosen,9,18,'React hooks');
  if not exists(select 1 from public.mock_interview_bookings where id=bid and prepared_topics='React hooks' and status='requested') then
    raise exception 'Re-request kept stale topics'; end if;
end $$;
reset role;
rollback;
