-- Run against a database with the student-profile migration applied. All fixture data rolls back.
begin;
create function pg_temp.claims(uid text,email text,verified boolean default true) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',email,'email_verified',verified,
    'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.students(full_name,email,firebase_uid) values
  ('Profile Test A','profile-test-a@example.invalid','profile-test-a'),
  ('Profile Test B','profile-test-b@example.invalid','profile-test-b');
set local role anon;
do $$ declare home jsonb; begin
  perform pg_temp.claims('profile-test-a','profile-test-a@example.invalid');
  perform public.lms_save_student_profile(jsonb_build_object('full_name','Updated Student','profile_type','working',
    'office_name','Example Office','office_location','Kolhapur','email','other@example.invalid','firebase_uid','profile-test-b'));
  home := public.lms_student_home();
  if home->'student'->>'full_name' <> 'Updated Student'
    or home->'student'->>'office_name' <> 'Example Office'
    or home->'student'->>'office_location' <> 'Kolhapur'
    or home->'student'->>'profile_completed_at' is null then raise exception 'Profile was not saved to the student home.'; end if;
  if (select email from public.students where firebase_uid='profile-test-a') is not null then
    raise exception 'Student gained direct table access.';
  end if;
  perform pg_temp.claims('profile-test-b','profile-test-b@example.invalid');
  if public.lms_student_home()->'student'->>'full_name' <> 'Profile Test B' then
    raise exception 'One student changed another student profile.';
  end if;
  perform pg_temp.claims('profile-test-a','profile-test-a@example.invalid',false);
  begin
    perform public.lms_save_student_profile(jsonb_build_object('full_name','Unverified'));
    raise exception 'Unverified account updated a profile.';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if (select email from public.students where firebase_uid='profile-test-a') <> 'profile-test-a@example.invalid'
    or (select full_name from public.students where firebase_uid='profile-test-b') <> 'Profile Test B' then
    raise exception 'Profile update touched protected fields or another student.';
  end if;
end $$;
rollback;
