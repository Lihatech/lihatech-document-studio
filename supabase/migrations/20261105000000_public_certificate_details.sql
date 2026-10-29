begin;
alter table public.certificate_applications
  add column certificate_type text not null default 'Course Completion' check(certificate_type in ('Course Completion','Internship Completion')),
  add column designation text not null default '' check(length(designation)<=120),
  add column requested_start_date date,
  add column requested_end_date date,
  add constraint public_certificate_dates check((requested_start_date is null and requested_end_date is null) or (requested_start_date is not null and requested_end_date is not null and requested_end_date>=requested_start_date));

create function public.submit_public_certificate_application_details(
  p_name text,p_email text,p_course text,p_type text,p_domain text,p_start date,p_end date
) returns jsonb language plpgsql security definer set search_path=public as $$
declare applicant public.certificate_applicants; application_id uuid;
begin
  p_name:=btrim(p_name); p_email:=lower(btrim(p_email)); p_course:=btrim(p_course);
  p_domain:=case when p_type='Internship Completion' then btrim(coalesce(p_domain,'')) else '' end;
  if p_name is null or length(p_name) not between 1 and 120 or p_course is null or length(p_course) not between 1 and 180
    or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Check your name, email and course.';
  end if;
  if p_type is null or p_type not in ('Course Completion','Internship Completion') then
    raise exception 'Choose course completion or internship completion.';
  end if;
  if p_type='Internship Completion' and length(p_domain) not between 1 and 120 then
    raise exception 'Enter your internship domain or role.';
  end if;
  if p_start is null or p_end is null or p_end<p_start then raise exception 'Check your requested certificate dates.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email,0));
  insert into public.certificate_applicants(email) values(p_email) on conflict(email) do nothing;
  select * into applicant from public.certificate_applicants where email=p_email;
  if (select count(*) from public.certificate_applications where applicant_id=applicant.id and created_at>now()-interval '1 day')>=5 then
    raise exception 'Too many applications. Please try again tomorrow.';
  end if;
  if exists(select 1 from public.certificate_applications where applicant_id=applicant.id
    and lower(course_name)=lower(p_course) and certificate_type=p_type and status in ('pending','approved')) then
    raise exception 'An application for this email, course and certificate type already exists. Contact LihaTech for assistance.';
  end if;
  insert into public.certificate_applications(applicant_id,full_name,course_name,certificate_type,designation,requested_start_date,requested_end_date)
    values(applicant.id,p_name,p_course,p_type,p_domain,p_start,p_end) returning id into application_id;
  return jsonb_build_object('id',application_id,'student_code',applicant.student_code);
end $$;
revoke all on function public.submit_public_certificate_application_details(text,text,text,text,text,date,date) from public,anon,authenticated;
grant execute on function public.submit_public_certificate_application_details(text,text,text,text,text,date,date) to service_role;
notify pgrst,'reload schema';
commit;
