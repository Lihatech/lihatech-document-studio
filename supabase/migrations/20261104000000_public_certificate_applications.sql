begin;
create table public.certificate_applicants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  student_code text not null unique default ('LT-CERT-STU-' || nextval('public.student_code_sequence')::text)
);
create table public.certificate_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.certificate_applicants(id),
  full_name text not null check(length(btrim(full_name)) between 1 and 120),
  course_name text not null check(length(btrim(course_name)) between 1 and 180),
  status text not null default 'pending' check(status in ('pending','approved','declined')),
  admin_note text not null default '',
  document jsonb,
  pdf_base64 text,
  email_status text not null default 'not_sent' check(email_status in ('not_sent','sending','sent','failed')),
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index certificate_applications_created on public.certificate_applications(created_at desc);
create unique index certificate_applications_certificate_number on public.certificate_applications((document->>'certificateId')) where status='approved';
alter table public.certificate_applicants enable row level security;
alter table public.certificate_applications enable row level security;
revoke all on public.certificate_applicants, public.certificate_applications from anon, authenticated;
grant all on public.certificate_applicants, public.certificate_applications to service_role;

create function public.submit_public_certificate_application(p_name text,p_email text,p_course text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare applicant public.certificate_applicants; application_id uuid;
begin
  p_name:=btrim(p_name); p_email:=lower(btrim(p_email)); p_course:=btrim(p_course);
  if length(p_name) not between 1 and 120 or length(p_course) not between 1 and 180
    or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Check your name, email and course.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email,0));
  insert into public.certificate_applicants(email) values(p_email) on conflict(email) do nothing;
  select * into applicant from public.certificate_applicants where email=p_email;
  if (select count(*) from public.certificate_applications where applicant_id=applicant.id and created_at>now()-interval '1 day')>=5 then
    raise exception 'Too many applications. Please try again tomorrow.';
  end if;
  if exists(select 1 from public.certificate_applications where applicant_id=applicant.id
    and lower(course_name)=lower(p_course) and status in ('pending','approved')) then
    raise exception 'An application for this email and course already exists. Contact LihaTech for assistance.';
  end if;
  insert into public.certificate_applications(applicant_id,full_name,course_name)
    values(applicant.id,p_name,p_course) returning id into application_id;
  return jsonb_build_object('id',application_id,'student_code',applicant.student_code);
end $$;
revoke all on function public.submit_public_certificate_application(text,text,text) from public,anon,authenticated;
grant execute on function public.submit_public_certificate_application(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
