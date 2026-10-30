-- Send plain feedback immediately, without changing the interview outcome.
create function public.lms_admin_send_interview_feedback(p_booking uuid,p_feedback text) returns void
language plpgsql security definer set search_path=public as $$
declare booking public.mock_interview_bookings;
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  if nullif(btrim(p_feedback),'') is null then raise exception 'Write feedback before sending'; end if;
  if length(p_feedback)>5000 then raise exception 'Feedback must be 5,000 characters or fewer'; end if;
  select * into booking from public.mock_interview_bookings where id=p_booking for update;
  if not found then raise exception 'Interview not found'; end if;
  if booking.status not in ('booked','completed','no_show') then raise exception 'This interview cannot receive feedback'; end if;
  update public.mock_interview_bookings set feedback=btrim(p_feedback),feedback_draft=null where id=p_booking;
end $$;
revoke all on function public.lms_admin_send_interview_feedback(uuid,text) from public;
grant execute on function public.lms_admin_send_interview_feedback(uuid,text) to anon,authenticated;

create or replace function public.lms_notify_feedback_update() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status=old.status and nullif(btrim(new.feedback),'') is not null
    and (new.feedback is distinct from old.feedback or new.score is distinct from old.score) then
    insert into public.portal_notifications(student_id,category,title,body,source_id,event_key)
      values(new.student_id,'mocks',case when nullif(btrim(old.feedback),'') is null then 'Interview feedback received' else 'Interview feedback updated' end,
        'Open Mock interviews to read your feedback.',new.id,'interview-feedback:'||new.id||':'||gen_random_uuid());
  end if;
  return new;
end $$;
notify pgrst,'reload schema';
