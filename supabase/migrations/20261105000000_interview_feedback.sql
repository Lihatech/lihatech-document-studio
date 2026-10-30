-- Drafts stay on the admin-only booking row; student home exposes only published fields.
alter table public.mock_interview_bookings add column feedback_draft jsonb;

create function public.lms_admin_save_interview_feedback(p_booking uuid, p_status text, p_feedback text,
  p_score integer default null, p_internal_notes text default '', p_publish boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare booking public.mock_interview_bookings;
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into booking from public.mock_interview_bookings where id=p_booking for update;
  if not found then raise exception 'Interview not found'; end if;
  if booking.status not in ('booked','completed','no_show') then raise exception 'This interview cannot receive feedback'; end if;
  if p_status is null or p_status not in ('completed','no_show') then raise exception 'Choose completed or no show'; end if;
  if p_score is not null and (p_score<0 or p_score>100) then raise exception 'Score must be between 0 and 100'; end if;
  if length(coalesce(p_feedback,''))>5000 or length(coalesce(p_internal_notes,''))>5000 then raise exception 'Feedback and notes must be 5,000 characters or fewer'; end if;
  if coalesce(p_publish,false) then
    if nullif(btrim(p_feedback),'') is null then raise exception 'Add feedback before publishing'; end if;
    update public.mock_interview_bookings set status=p_status,feedback=btrim(p_feedback),score=p_score,
      internal_notes=btrim(coalesce(p_internal_notes,'')),feedback_draft=null where id=p_booking;
  else
    update public.mock_interview_bookings set feedback_draft=jsonb_build_object('status',p_status,'feedback',coalesce(p_feedback,''),
      'score',p_score,'internal_notes',coalesce(p_internal_notes,'')) where id=p_booking;
  end if;
end $$;
revoke all on function public.lms_admin_save_interview_feedback(uuid,text,text,integer,text,boolean) from public;
grant execute on function public.lms_admin_save_interview_feedback(uuid,text,text,integer,text,boolean) to anon,authenticated;

-- Status changes already notify students. Also notify when published feedback changes later.
create function public.lms_notify_feedback_update() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status=old.status and new.status in ('completed','no_show') and nullif(btrim(new.feedback),'') is not null
    and (new.feedback is distinct from old.feedback or new.score is distinct from old.score) then
    insert into public.portal_notifications(student_id,category,title,body,source_id,event_key)
      values(new.student_id,'mocks','Interview feedback updated','Open Mock interviews to review your feedback.',new.id,
        'interview-feedback:'||new.id||':'||gen_random_uuid());
  end if;
  return new;
end $$;
revoke all on function public.lms_notify_feedback_update() from public,anon,authenticated;
create trigger notify_feedback_update after update on public.mock_interview_bookings
  for each row execute function public.lms_notify_feedback_update();
notify pgrst,'reload schema';
