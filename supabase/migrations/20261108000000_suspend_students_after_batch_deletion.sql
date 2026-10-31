-- Block portal access when a deleted batch was a student's final assignment.
create function public.lms_suspend_students_before_batch_delete() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  -- Serialize changes affecting the same students before evaluating remaining assignments.
  perform 1 from public.students s
    where exists(select 1 from public.batch_students e where e.batch_id=old.id and e.student_id=s.id
      and e.status in ('active','suspended') and e.left_at is null)
    order by s.id for update;
  update public.students s set status='suspended',updated_at=now()
    where s.status='active'
      and exists(select 1 from public.batch_students e where e.batch_id=old.id and e.student_id=s.id
        and e.status in ('active','suspended') and e.left_at is null)
      and not exists(select 1 from public.batch_students e where e.student_id=s.id and e.batch_id<>old.id
        and e.status in ('active','suspended') and e.left_at is null);
  return old;
end $$;
revoke all on function public.lms_suspend_students_before_batch_delete() from public,anon,authenticated;
create trigger suspend_students_before_batch_delete before delete on public.batches
  for each row execute function public.lms_suspend_students_before_batch_delete();

-- Profile updates must enforce the same suspension rule as materials, documents and interviews.
create or replace function public.lms_save_student_profile(p_profile jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare role_value text := nullif(btrim(p_profile->>'profile_type'),'');
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  if public.lms_student_id() is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
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
  where firebase_uid = auth.jwt()->>'sub' and status='active';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
end $$;
notify pgrst,'reload schema';
