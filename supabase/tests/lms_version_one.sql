-- Fixtures and schema changes are rolled back by tests/lms_db_check.py.
create temporary table fixture_ids(name text primary key,id uuid);
grant select on fixture_ids to anon,authenticated;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Assertion failed: %',msg; end if; end $$;
create function pg_temp.claims(uid text,email text,verified boolean default true) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',email,'email_verified',verified,
    'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
-- Use an existing approved admin for the admin checks; never create a privileged test account permanently.
do $$ declare r record; id uuid; begin
  select firebase_uid,email into r from public.admin_profiles where is_active and role in ('owner','admin') limit 1;
  if r.firebase_uid is null then raise exception 'An existing active admin is required.'; end if;
  perform pg_temp.claims(r.firebase_uid,r.email);
  insert into public.students(full_name,email) values('LMS Test A','lms-test-a@example.invalid') returning students.id into id;
  insert into fixture_ids values('student-a',id);
  insert into public.students(full_name,email,firebase_uid) values('LMS Test B','lms-test-b@example.invalid','lms-test-b') returning students.id into id;
  insert into fixture_ids values('student-b',id);
  insert into public.batches(name,code,status) values('Test A','LMS-TEST-A','active') returning batches.id into id;
  insert into fixture_ids values('batch-a',id);
  insert into public.batches(name,code,status) values('Test B','LMS-TEST-B','active') returning batches.id into id;
  insert into fixture_ids values('batch-b',id);
  insert into public.courses(name) values('LMS Test Course') returning courses.id into id;
  insert into fixture_ids values('course',id);
  insert into public.batch_courses(batch_id,course_id) values((select f.id from fixture_ids f where name='batch-a'),id);
  insert into public.batch_students(batch_id,student_id,starts_at,expires_at)
    values((select f.id from fixture_ids f where name='batch-a'),(select f.id from fixture_ids f where name='student-a'),now()-interval '1 day',now()+interval '1 day');
  insert into public.batch_students(batch_id,student_id,starts_at,expires_at)
    values((select f.id from fixture_ids f where name='batch-a'),(select f.id from fixture_ids f where name='student-b'),now()-interval '1 day',now()+interval '1 day');
  insert into public.learning_materials(title,url,status,course_id) values('Released','https://drive.google.com/test','published',(select f.id from fixture_ids f where name='course')) returning learning_materials.id into id;
  insert into fixture_ids values('material',id);
  insert into public.batch_materials(batch_id,material_id,available_from) values((select f.id from fixture_ids f where name='batch-a'),id,now()-interval '1 hour');
  insert into public.learning_materials(title,url,status) values('Other batch','https://drive.google.com/private','published') returning learning_materials.id into id;
  insert into fixture_ids values('other-material',id);
  insert into public.batch_materials(batch_id,material_id,available_from) values((select f.id from fixture_ids f where name='batch-b'),id,now()-interval '1 hour');
  insert into public.mock_interview_slots(batch_id,mentor_name,starts_at,ends_at,capacity,meeting_url)
    values((select f.id from fixture_ids f where name='batch-a'),'Admin interviewer',now()+interval '2 hours',now()+interval '3 hours',1,'https://meet.google.com/test') returning mock_interview_slots.id into id;
  insert into fixture_ids values('slot',id);
end $$;
set local role anon;
do $$ declare account jsonb; home jsonb; booking uuid; begin
  perform pg_temp.assert_true(public.has_admin_access(),'admin full access');
  perform public.lms_invite_admin('Test admin','lms-version-one-test@lihatech.com');
  perform pg_temp.assert_true(exists(select 1 from public.students where email='lms-test-a@example.invalid'),'admin sees students');
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  account:=public.lms_session();
  perform pg_temp.assert_true(account->>'role'='student','personal email routes to student');
  perform pg_temp.assert_true(not public.has_admin_access(),'student cannot access admin');
  perform pg_temp.assert_true(not exists(select 1 from public.students),'student cannot read staff student table or internal notes');
  perform pg_temp.assert_true(not exists(select 1 from public.document_studio_records),'student cannot read Document Studio');
  perform pg_temp.assert_true(not exists(select 1 from public.learning_materials),'student cannot read material URLs directly');
  perform pg_temp.assert_true(not exists(select 1 from storage.objects where bucket_id='lms-materials'),'student cannot mint storage URLs');
  home:=public.lms_student_home();
  perform pg_temp.assert_true(jsonb_array_length(home->'enrollments')=1,'only own enrollment');
  perform pg_temp.assert_true(jsonb_array_length(home->'materials')=1,'only own batch materials');
  perform pg_temp.assert_true(not (home->'materials'->0 ? 'url'),'listing does not reveal material URL');
  perform pg_temp.assert_true(public.lms_can_read_material((select f.id from fixture_ids f where name='material')),'released material allowed');
  begin perform public.lms_open_material((select f.id from fixture_ids f where name='other-material')); raise exception 'Cross-batch material allowed'; exception when insufficient_privilege then null; end;
  begin perform public.lms_private_file('lms-test-b',(select f.id from fixture_ids f where name='material')); raise exception 'Student impersonation allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.students(full_name,email) values('Unauthorized','unauthorized@example.invalid'); raise exception 'Student created account'; exception when insufficient_privilege then null; end;
  perform public.lms_complete_material((select f.id from fixture_ids f where name='material'));
  perform pg_temp.assert_true((public.lms_student_home()->'materials'->0->>'completed')::boolean,'completion belongs to student');
  booking:=public.lms_book_mock((select f.id from fixture_ids f where name='slot'));
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'bookings')=1,'own booking returned');
  perform pg_temp.claims('lms-test-b','lms-test-b@example.invalid');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'bookings')=0,'other student booking hidden');
  begin perform public.lms_book_mock((select f.id from fixture_ids f where name='slot')); raise exception 'Overbooked'; exception when raise_exception then if sqlerrm='Overbooked' then raise; end if; end;
  begin perform public.lms_cancel_mock(booking); raise exception 'Cancelled another student booking'; exception when insufficient_privilege then null; end;
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform public.lms_cancel_mock(booking);
  perform pg_temp.claims('lms-test-b','lms-test-b@example.invalid');
  perform public.lms_book_mock((select f.id from fixture_ids f where name='slot'));
end $$;
reset role;
-- Admin publishes a scheduled link to a batch atomically; students see metadata, not its URL, before release.
do $$ declare a record; mid uuid; fid uuid; begin
  select firebase_uid,email into a from public.admin_profiles where is_active and role in ('owner','admin') limit 1;
  perform pg_temp.claims(a.firebase_uid,a.email);
  mid:=public.lms_publish_material(jsonb_build_object('title','Scheduled LMS link','url','https://drive.google.com/test-scheduled'),
    (select f.id from fixture_ids f where name='batch-a'),now()+interval '1 hour');
  insert into fixture_ids values('scheduled-material',mid);
  perform pg_temp.assert_true(exists(select 1 from public.learning_materials where id=mid and status='published'),'material published');
  perform pg_temp.assert_true(exists(select 1 from public.batch_materials where material_id=mid),'batch release created');
  insert into public.learning_materials(title,kind,storage_path,status) values('Private test file','file','test/private.pdf','draft') returning id into fid;
  perform public.lms_publish_material(jsonb_build_object('id',fid,'description','Private lesson'),
    (select f.id from fixture_ids f where name='batch-a'),now()+interval '2 hours');
  perform pg_temp.assert_true(exists(select 1 from public.learning_materials where id=fid and status='published' and description='Private lesson'),'draft file published');
end $$;
set local role anon;
do $$ declare mid uuid := (select f.id from fixture_ids f where name='scheduled-material'); begin
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.lms_student_home()->'materials') m
    where m->>'id'=mid::text and (m->>'accessible')::boolean=false),'scheduled material listed but locked');
  begin perform public.lms_open_material(mid); raise exception 'Scheduled URL opened early'; exception when insufficient_privilege then null; end;
  begin perform public.lms_publish_material(jsonb_build_object('id',mid),(select f.id from fixture_ids f where name='batch-a'),now());
    raise exception 'Student published material'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare a record; begin
  select firebase_uid,email into a from public.admin_profiles where is_active and role in ('owner','admin') limit 1;
  perform pg_temp.claims(a.firebase_uid,a.email);
  perform public.lms_publish_material(jsonb_build_object('id',(select f.id from fixture_ids f where name='scheduled-material')),
    (select f.id from fixture_ids f where name='batch-a'),now()-interval '1 hour');
end $$;
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform pg_temp.assert_true(public.lms_can_read_material((select f.id from fixture_ids f where name='scheduled-material')),'released material opens');
end $$;
reset role;
-- Deferred staff cannot inherit the earlier broad staff policies.
insert into public.admin_profiles(firebase_uid,email,full_name,role,is_active)
  values('lms-test-instructor','lms-test-instructor@lihatech.com','Deferred instructor','instructor',true);
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-instructor','lms-test-instructor@lihatech.com');
  perform pg_temp.assert_true(not public.has_admin_access(),'instructor access deferred');
  perform pg_temp.assert_true(not exists(select 1 from public.students),'instructor cannot read student records');
  begin perform public.lms_session(); raise exception 'Instructor login allowed'; exception when insufficient_privilege then null; end;
  begin perform public.lms_invite_admin('Unauthorized','unauthorized@lihatech.com'); raise exception 'Instructor invited admin'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- A batch transfer/remove preserves history but removes further content access.
update public.batch_students set left_at=now(),status='revoked' where student_id=(select f.id from fixture_ids f where name='student-b');
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-b','lms-test-b@example.invalid');
  perform pg_temp.assert_true(not public.lms_has_enrollment((select f.id from fixture_ids f where name='batch-a')),'removed membership blocked');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'enrollments')=1,'membership history preserved');
end $$;
reset role;
update public.batch_materials set available_from=now()+interval '1 hour' where material_id=(select f.id from fixture_ids f where name='material');
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform pg_temp.assert_true(not public.lms_can_read_material((select f.id from fixture_ids f where name='material')),'future material blocked');
end $$;
reset role;
update public.batch_materials set available_from=now()-interval '2 hours', expires_at=now()-interval '1 hour' where material_id=(select f.id from fixture_ids f where name='material');
set local role anon;
do $$ begin perform pg_temp.assert_true(not public.lms_can_read_material((select f.id from fixture_ids f where name='material')),'expired material blocked'); end $$;
reset role;
update public.batch_materials set expires_at=null where material_id=(select f.id from fixture_ids f where name='material');
insert into public.student_course_access(student_id,course_id,status) values((select f.id from fixture_ids f where name='student-a'),(select f.id from fixture_ids f where name='course'),'suspended');
set local role anon;
do $$ begin perform pg_temp.assert_true(not public.lms_can_read_material((select f.id from fixture_ids f where name='material')),'explicit restriction wins'); end $$;
reset role;
delete from public.student_course_access where student_id=(select f.id from fixture_ids f where name='student-a');
update public.batches set start_date=current_date-interval '10 days',end_date=current_date-interval '1 day' where id=(select f.id from fixture_ids f where name='batch-a');
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform pg_temp.assert_true(not public.lms_has_enrollment((select f.id from fixture_ids f where name='batch-a')),'batch end blocks access');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'materials')=0,'batch end hides materials');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'slots')=0,'batch end hides interviews');
end $$;
reset role;
update public.batches set end_date=current_date+interval '10 days' where id=(select f.id from fixture_ids f where name='batch-a');
with slot as (insert into public.mock_interview_slots(batch_id,mentor_name,starts_at,ends_at,capacity)
  values((select f.id from fixture_ids f where name='batch-a'),'After batch',now()+interval '11 days',now()+interval '11 days 1 hour',1)
  returning id) insert into fixture_ids select 'late-slot',id from slot;
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform pg_temp.assert_true(public.lms_has_enrollment((select f.id from fixture_ids f where name='batch-a')),'extending batch restores access');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'slots')=1,'interview beyond batch end hidden');
  begin perform public.lms_book_mock((select f.id from fixture_ids f where name='late-slot')); raise exception 'Late interview booked'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.batch_students set expires_at=now() where student_id=(select f.id from fixture_ids f where name='student-a');
set local role anon;
do $$ begin
  perform pg_temp.assert_true(not public.lms_has_enrollment((select f.id from fixture_ids f where name='batch-a')),'expiry boundary blocked');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'materials')=0,'expired enrollment hides learning');
  perform pg_temp.claims('unregistered','unregistered@example.invalid');
  begin perform public.lms_session(); raise exception 'Unregistered login allowed'; exception when insufficient_privilege then null; end;
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid',false);
  begin perform public.lms_session(); raise exception 'Unverified login allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.students set status='suspended' where id=(select f.id from fixture_ids f where name='student-a');
set local role anon;
do $$ begin
  perform pg_temp.claims('lms-test-a','lms-test-a@example.invalid');
  perform pg_temp.assert_true(public.lms_student_id() is null,'suspension immediate');
  perform pg_temp.assert_true(jsonb_array_length(public.lms_student_home()->'materials')=0,'suspended account sees status only');
end $$;
reset role;
