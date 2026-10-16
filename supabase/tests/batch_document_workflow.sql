-- Run after 20261021000000_batch_document_workflow.sql. No fixture data is retained.
begin;
create function pg_temp.workflow_claims(uid text) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
    'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.admin_profiles(full_name,email,firebase_uid,role) values('Workflow Admin','workflow-admin@example.invalid','workflow-admin','admin');
insert into public.students(id,full_name,email,firebase_uid,profile_completed_at) values
 ('21000000-0000-4000-8000-000000000001','Official Student','workflow-student@example.invalid','workflow-student',now()),
 ('21000000-0000-4000-8000-000000000002','Other Student','workflow-other@example.invalid','workflow-other',now());
insert into public.batches(id,name,code,start_date,end_date,status,course_name,offer_type,designation,document_department) values
 ('21000000-0000-4000-8000-000000000011','Current batch','WORKFLOW-CURRENT',(now() at time zone 'Asia/Kolkata')::date-7,(now() at time zone 'Asia/Kolkata')::date+7,'planned','Official Programme','Internship Offer','Developer Intern','Engineering'),
 ('21000000-0000-4000-8000-000000000012','Future batch','WORKFLOW-FUTURE',(now() at time zone 'Asia/Kolkata')::date+2,(now() at time zone 'Asia/Kolkata')::date+14,'planned','Future Programme',null,'',''),
 ('21000000-0000-4000-8000-000000000013','Closed batch','WORKFLOW-CLOSED',(now() at time zone 'Asia/Kolkata')::date-20,(now() at time zone 'Asia/Kolkata')::date-7,'active','Old Programme',null,'','');
insert into public.learning_materials(id,title,position,kind,url,status) values
 ('21000000-0000-4000-8000-000000000021','Zeta resource',0,'link','https://example.invalid/zeta','published'),
 ('21000000-0000-4000-8000-000000000022','Alpha resource',99,'link','https://example.invalid/alpha','published');
insert into public.batch_materials(batch_id,material_id,available_from)
 select '21000000-0000-4000-8000-000000000011',id,now()-interval '1 day' from public.learning_materials
 where id in ('21000000-0000-4000-8000-000000000021','21000000-0000-4000-8000-000000000022');
set local role anon;
do $$ declare sid uuid:='21000000-0000-4000-8000-000000000001'; denied boolean:=false; rid uuid; result jsonb; begin
  perform pg_temp.workflow_claims('workflow-admin');
  perform public.lms_assign_student_to_batch(sid,'21000000-0000-4000-8000-000000000011');
  perform public.lms_assign_student_to_batch(sid,'21000000-0000-4000-8000-000000000012');
  if (select count(*) from public.batch_students where student_id=sid and left_at is null and status in ('active','suspended'))<>1 then raise exception 'Multiple current batches'; end if;
  if not exists(select 1 from public.batch_students where student_id=sid and batch_id='21000000-0000-4000-8000-000000000011' and status='revoked' and left_at is not null) then raise exception 'Old batch history was not preserved'; end if;
  perform pg_temp.workflow_claims('workflow-student');
  if public.lms_has_enrollment('21000000-0000-4000-8000-000000000012') then raise exception 'Future batch leaked early access'; end if;
  perform pg_temp.workflow_claims('workflow-admin');
  -- Reassigning to a previously used batch must restore its membership, not fail on its primary key.
  perform public.lms_assign_student_to_batch(sid,'21000000-0000-4000-8000-000000000011');
  begin perform public.lms_create_student_in_batch('closed-test@example.invalid','21000000-0000-4000-8000-000000000013');
    exception when others then denied:=true; end;
  if not denied or exists(select 1 from public.students where email='closed-test@example.invalid') then raise exception 'Invalid student creation did not roll back atomically'; end if;
  perform pg_temp.workflow_claims('workflow-student');
  if not public.lms_has_enrollment('21000000-0000-4000-8000-000000000011') then raise exception 'Scheduled batch did not open automatically'; end if;
  result:=public.lms_student_home();
  if result->'materials'->0->>'title'<>'Alpha resource' then raise exception 'Obsolete material display order is still used'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'enrollments') e where e->>'course_name'='Official Programme' and e->>'batch_start_date' is not null) then raise exception 'Document defaults missing from student home'; end if;
  rid:=public.lms_request_document('{"kind":"certificate","candidate_name":"Forged Name","program_name":"Forged Programme","start_date":"1900-01-01","end_date":"2999-01-01"}');
  result:=public.lms_student_document_requests()->0;
  if result->>'candidate_name'<>'Official Student' or result->>'program_name'<>'Official Programme' or result->>'start_date'='1900-01-01' then raise exception 'Client changed official document details'; end if;
  perform public.lms_suggest_document_correction(rid,'Please check the spelling.');
  result:=public.lms_student_document_requests()->0;
  if result->>'candidate_name'<>'Official Student' or result->>'details'<>'Please check the spelling.' then raise exception 'Suggestion modified official fields'; end if;
  denied:=false;
  begin perform public.lms_admin_update_document_request(rid,'{"candidate_name":"Unauthorized"}'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Student edited an official request'; end if;
  perform pg_temp.workflow_claims('workflow-other'); denied:=false;
  begin perform public.lms_suggest_document_correction(rid,'Not my request'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Student edited another student suggestion'; end if;
  perform pg_temp.workflow_claims('workflow-admin');
  perform public.lms_admin_update_document_request(rid,'{"candidate_name":"Corrected Official Name"}');
  perform pg_temp.workflow_claims('workflow-student');
  if public.lms_student_document_requests()->0->>'candidate_name'<>'Corrected Official Name' then raise exception 'Admin correction not visible to student'; end if;
end $$;
reset role;
-- The start date and explicit pauses must override any older per-student timestamps.
update public.batches set start_date=(now() at time zone 'Asia/Kolkata')::date+1 where code='WORKFLOW-CURRENT';
set local role anon;
select pg_temp.workflow_claims('workflow-student');
do $$ begin
  if public.lms_has_enrollment('21000000-0000-4000-8000-000000000011') then raise exception 'Changed batch start date did not remove early access'; end if;
  if public.lms_can_read_material('21000000-0000-4000-8000-000000000021') then raise exception 'Material visible before batch start'; end if;
end $$;
reset role;
update public.batches set start_date=(now() at time zone 'Asia/Kolkata')::date-1,end_date=(now() at time zone 'Asia/Kolkata')::date,status='planned' where code='WORKFLOW-CURRENT';
set local role anon;
select pg_temp.workflow_claims('workflow-student');
do $$ begin
  if not public.lms_has_enrollment('21000000-0000-4000-8000-000000000011') then raise exception 'Inclusive last-day access failed'; end if;
end $$;
reset role;
update public.batches set status='paused' where code='WORKFLOW-CURRENT';
set local role anon;
select pg_temp.workflow_claims('workflow-student');
do $$ begin
  if public.lms_has_enrollment('21000000-0000-4000-8000-000000000011') then raise exception 'Paused batch still grants access'; end if;
end $$;
reset role;
update public.batches set status='active',start_date=(now() at time zone 'Asia/Kolkata')::date-2,end_date=(now() at time zone 'Asia/Kolkata')::date-1 where code='WORKFLOW-CURRENT';
set local role anon;
select pg_temp.workflow_claims('workflow-student');
do $$ begin
  if public.lms_can_read_material('21000000-0000-4000-8000-000000000021') then raise exception 'Material visible after batch end'; end if;
end $$;
rollback;
