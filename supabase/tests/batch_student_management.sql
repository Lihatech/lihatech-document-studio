-- Identity, provisional dates, atomic editing and multi-batch publication. No retained fixtures.
begin;
create function pg_temp.management_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.admin_profiles(full_name,email,firebase_uid,role) values('Management Admin','management-admin@example.invalid','management-admin','admin');
insert into public.students(id,full_name,email,firebase_uid,profile_completed_at) values
 ('26000000-0000-4000-8000-000000000001','Management Student','management-student@example.invalid','management-student',now());
insert into public.batches(id,name,code,start_date,end_date,status,course_name) values
 ('26000000-0000-4000-8000-000000000011','Management A','MANAGEMENT-A',current_date-7,current_date+45,'active','Official programme'),
 ('26000000-0000-4000-8000-000000000012','Management B','MANAGEMENT-B',current_date-7,current_date+45,'active','Official programme'),
 ('26000000-0000-4000-8000-000000000013','Management C','MANAGEMENT-C',current_date-7,current_date+45,'active','Official programme');
insert into public.batch_students(student_id,batch_id) values('26000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000011');
insert into public.learning_materials(id,title,kind,url) values
 ('26000000-0000-4000-8000-000000000031','Resource A','link','https://example.invalid/a'),
 ('26000000-0000-4000-8000-000000000032','Resource B','link','https://example.invalid/b'),
 ('26000000-0000-4000-8000-000000000033','Resource C','link','https://example.invalid/c');
set local role anon;
do $$ declare rid uuid; sid uuid; student_code_value text; before_code text; row jsonb; result jsonb; denied boolean; bad_date text; begin
 perform pg_temp.management_claims('management-admin');
 sid:=public.lms_create_student_in_batch('new-management@example.invalid','26000000-0000-4000-8000-000000000011');
 select student_code into before_code from public.students where id=sid;
 if before_code !~ '^LT-STU-[0-9]+$' then raise exception 'Student ID was not generated'; end if;
 perform public.lms_import_students_to_batch('[{"email":"bulk-management@example.invalid"}]','26000000-0000-4000-8000-000000000011');
 if not exists(select 1 from public.students where email='bulk-management@example.invalid' and student_code is not null and student_code<>before_code) then raise exception 'Bulk student ID missing or reused';end if;
 perform public.lms_admin_save_student(sid,'corrected-management@example.invalid','26000000-0000-4000-8000-000000000012','active');
 if not exists(select 1 from public.batch_students where student_id=sid and batch_id='26000000-0000-4000-8000-000000000012' and status='active' and left_at is null) then raise exception 'Batch change did not take effect';end if;
 if not exists(select 1 from public.students where id=sid and email='corrected-management@example.invalid' and student_code=before_code) then raise exception 'Editing changed the student identity';end if;
 denied:=false;begin perform public.lms_admin_save_student(sid,'failed-update@example.invalid','26000000-0000-4000-8000-000000000099','active');exception when others then denied:=true;end;
 if not denied or exists(select 1 from public.students where id=sid and email='failed-update@example.invalid') then raise exception 'Failed assignment partially saved the email';end if;
 perform public.lms_admin_save_student(sid,'corrected-management@example.invalid','26000000-0000-4000-8000-000000000012','revoked');
 if not exists(select 1 from public.students where id=sid) or not exists(select 1 from public.batch_students where student_id=sid and batch_id='26000000-0000-4000-8000-000000000012' and status='revoked' and left_at is not null) then raise exception 'Remove access deleted the student or did not revoke membership';end if;
 update public.students set status='suspended' where id=sid;
 perform public.lms_admin_save_student(sid,'corrected-management@example.invalid','26000000-0000-4000-8000-000000000012','revoked');
 if not exists(select 1 from public.students where id=sid and status='suspended') then raise exception 'Removing batch access reactivated a suspended account';end if;
 denied:=false;begin update public.students set student_code='FORGED' where id=sid;exception when others then denied:=true;end;
 if not denied then raise exception 'Student ID was editable';end if;
 perform pg_temp.management_claims('management-student');
 denied:=false;begin perform public.lms_admin_save_student(sid,'forged@example.invalid','26000000-0000-4000-8000-000000000012','active');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Student changed admin-controlled access';end if;
 denied:=false;begin perform public.lms_request_document('{"kind":"offer_letter"}');exception when others then denied:=true;end;
 if not denied then raise exception 'New offer request was accepted';end if;
 denied:=false;begin perform public.lms_request_document('{"kind":"certificate","certificate_type":"Other"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Unsupported completion type accepted';end if;
 denied:=false;begin perform public.lms_request_document('{"kind":"certificate","certificate_type":"Internship Completion"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Internship request without role accepted';end if;
 foreach bad_date in array array['infinity','-infinity','10000-01-01','0001-01-01 BC'] loop
  denied:=false;begin perform public.lms_request_document(jsonb_build_object('kind','certificate','requested_start_date',bad_date,'requested_end_date',bad_date));exception when others then denied:=true;end;
  if not denied then raise exception 'Unrenderable certificate dates accepted';end if;
 end loop;
 rid:=public.lms_request_document(jsonb_build_object('kind','certificate','certificate_type','Internship Completion','designation','Developer Intern',
   'requested_start_date',(current_date-14)::text,'requested_end_date',(current_date+3)::text,'student_code','FORGED',
   'profile',jsonb_build_object('salutation','Ms.','full_name','jane smith')));
 row:=public.lms_student_document_requests()->0;
 if row->>'start_date'<>(current_date-7)::text or row->>'requested_start_date'<>(current_date-14)::text or row->>'designation'<>'Developer Intern' then raise exception 'Requested dates or role incorrect';end if;
 student_code_value:=public.lms_student_home()->'student'->>'student_code';
 if row->>'student_code' is distinct from student_code_value then raise exception 'Student ID snapshot missing or forged';end if;
 denied:=false;begin perform public.lms_publish_resources('[{"id":"26000000-0000-4000-8000-000000000031"}]',array['26000000-0000-4000-8000-000000000011'::uuid],now());exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Student published a resource';end if;
 perform pg_temp.management_claims('management-admin');
 select value into row from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=rid::text;
 result:=public.lms_approve_document_request(rid,jsonb_build_object('id','management-certificate','certificateId','MANAGEMENT-CERT-001',
 'candidateName','Ms. Jane Smith','certificateType','Internship Completion','programName','Developer Intern','studentId','FORGED',
 'startDate',(current_date-14)::text,'endDate',(current_date+3)::text,'issueDate',current_date::text),(row->>'updated_at')::timestamptz);
 if result->'record'->'data'->>'studentId' is distinct from student_code_value then raise exception 'Approval did not force the canonical student ID';end if;
 perform public.lms_publish_resources('[{"id":"26000000-0000-4000-8000-000000000031"},{"id":"26000000-0000-4000-8000-000000000032"},{"id":"26000000-0000-4000-8000-000000000033"}]',array['26000000-0000-4000-8000-000000000011'::uuid,'26000000-0000-4000-8000-000000000012'::uuid],now());
 if (select count(*) from public.batch_materials where batch_id in ('26000000-0000-4000-8000-000000000011','26000000-0000-4000-8000-000000000012'))<>6 then raise exception 'Multi-batch publication missing assignments';end if;
 denied:=false;begin perform public.lms_publish_resources('[{"id":"26000000-0000-4000-8000-000000000031"},{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}]',array['26000000-0000-4000-8000-000000000013'::uuid],now());exception when others then denied:=true;end;
 if not denied or exists(select 1 from public.batch_materials where batch_id='26000000-0000-4000-8000-000000000013') then raise exception 'Failed bulk publication partially saved access';end if;
end $$;
reset role;
rollback;
