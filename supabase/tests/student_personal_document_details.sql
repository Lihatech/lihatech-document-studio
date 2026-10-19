-- Run after 20261022000000. Fixtures and all profile/request changes are rolled back.
begin;
insert into public.students(id,full_name,email,firebase_uid,phone,college_name,profile_completed_at) values
 ('22000000-0000-4000-8000-000000000001','Original Student','personal-student@example.invalid','personal-student','Saved phone','Saved College',now());
insert into public.batches(id,name,code,start_date,end_date,status,course_name) values
 ('22000000-0000-4000-8000-000000000011','Personal details test','PERSONAL-DETAILS-TEST',current_date-7,current_date+7,'active','Official programme');
insert into public.batch_students(student_id,batch_id) values
 ('22000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000011');
set local role anon;
select set_config('request.jwt.claims',jsonb_build_object('sub','personal-student','email','personal-student@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true);
do $$ declare rid uuid; r jsonb; denied boolean:=false; begin
  rid:=public.lms_request_document(jsonb_build_object('kind','certificate','candidate_name','Forged name','program_name','Forged programme',
    'start_date','1900-01-01','end_date','2999-01-01','profile',jsonb_build_object('full_name','  ms. jane   o''neill  ',
    'salutation','Ms.','phone',' 12345 ','profile_type','student','college_name','Corrected College',
    'email','forged@example.invalid','course_name','Forged programme','start_date','1900-01-01')));
  r:=public.lms_student_document_requests()->0;
  if r->>'candidate_name'<>'Ms. Jane O''Neill' then raise exception 'Title or name cleanup failed: %',r->>'candidate_name'; end if;
  if r->>'program_name'<>'Official programme' or r->>'start_date'<>(current_date-7)::text or r->>'end_date'<>(current_date+7)::text then raise exception 'Student changed protected batch details'; end if;
  if r->'profile_snapshot'->>'college_name'<>'Saved College' or r->'profile_snapshot'->>'phone'<>'Saved phone' then raise exception 'Request overwrote unrelated profile details'; end if;
  r:=public.lms_student_home()->'student';
  if r->>'full_name'<>'Jane O''Neill' or r->>'salutation'<>'Ms.' or r->>'email'<>'personal-student@example.invalid' then raise exception 'Profile update or email protection failed'; end if;
  if r->>'college_name'<>'Saved College' or r->>'phone'<>'Saved phone' then raise exception 'Request changed profile fields outside the name and title'; end if;
  begin perform public.lms_request_document('{"kind":"certificate","profile":{"full_name":"Changed by failed request","salutation":"Mr."}}');
    exception when others then denied:=true; end;
  if not denied then raise exception 'Duplicate document request was accepted'; end if;
  if public.lms_student_home()->'student'->>'full_name'<>'Jane O''Neill' then raise exception 'Failed request partially saved profile corrections'; end if;
  denied:=false;
  begin perform public.lms_save_student_profile('{"full_name":"Changed by invalid title","salutation":"Invalid"}');
    exception when others then denied:=true; end;
  if not denied then raise exception 'Invalid title was accepted'; end if;
  perform public.lms_save_student_profile('{"full_name":"McDonald Li","salutation":""}');
  if public.lms_student_home()->'student'->>'full_name'<>'McDonald Li' then raise exception 'Intentional mixed-case spelling changed'; end if;
end $$;
reset role;
rollback;
