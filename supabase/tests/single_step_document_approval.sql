-- One approval issues the reviewed copy; failures leave the request untouched.
begin;
create function pg_temp.approval_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.admin_profiles(full_name,email,firebase_uid,role) values('Approval Admin','approval-admin@example.invalid','approval-admin','admin');
insert into public.students(id,full_name,email,firebase_uid,profile_completed_at) values
 ('24000000-0000-4000-8000-000000000001','Approval Student','approval-student@example.invalid','approval-student',now()),
 ('24000000-0000-4000-8000-000000000002','Other Student','approval-other@example.invalid','approval-other',now());
insert into public.batches(id,name,code,start_date,end_date,status,course_name,offer_type,designation,document_department) values
 ('24000000-0000-4000-8000-000000000011','Approval batch','APPROVAL-TEST',current_date-7,current_date+7,'active','Official programme','Internship Offer','Developer Intern','Engineering');
insert into public.batch_students(student_id,batch_id) values('24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000011');
insert into public.student_document_requests(id,student_id,batch_id,kind,candidate_name,program_name,certificate_type,offer_type,designation,department,start_date,end_date)
 values('24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000011',
 'offer_letter','Approval Student','Official programme','Course Completion','Internship Offer','Developer Intern','Engineering',current_date-7,current_date+7);
set local role anon;
do $$ declare rid uuid; other_rid uuid; payload jsonb; row jsonb; result jsonb; denied boolean; doc_kind text; begin
 foreach doc_kind in array array['certificate','offer_letter'] loop
  perform pg_temp.approval_claims('approval-student');
  if doc_kind='certificate' then rid:=public.lms_request_document(jsonb_build_object('kind',doc_kind));
  else rid:='24000000-0000-4000-8000-000000000021'; end if;
  payload:=jsonb_build_object('id','approval-'||doc_kind,'requestId',rid,'certificateId','APPROVAL-CERT-001',
   'candidateName','Corrected Student','programName','Official programme','certificateType','Course Completion',
   'startDate',(current_date-7)::text,'endDate',(current_date+7)::text,'issueDate',current_date::text,
   'letterType','Internship Offer','designation','Developer Intern','department','Engineering','noStipend',true);
  denied:=false;
  begin perform public.lms_approve_document_request(rid,payload,now(),0,'');exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Student approved own document';end if;
  perform pg_temp.approval_claims('approval-admin');
  select value into row from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=rid::text;
  denied:=false;
  begin perform public.lms_approve_document_request(rid,payload,now()-interval '1 day',0,'');exception when serialization_failure then denied:=true;end;
  if not denied then raise exception 'Stale request was approved';end if;
  denied:=false;
  begin perform public.lms_approve_document_request(rid,payload||'{"endDate":""}',(row->>'updated_at')::timestamptz,0,'');exception when others then denied:=true;end;
  if not denied then raise exception 'Incomplete document approved';end if;
  select value into result from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=rid::text;
  if result->>'status'<>'pending' or result->>'studio_record_id' is not null or result->>'published_at' is not null then raise exception 'Failed approval was not atomic';end if;
  result:=public.lms_approve_document_request(rid,payload,(row->>'updated_at')::timestamptz,0,'Ready to download.');
  if result->'request'->>'status'<>'fulfilled' or result->'request'->>'published_at' is null or result->'record'->>'version'<>'1' then raise exception 'Approval did not issue in one step';end if;
  perform pg_temp.approval_claims('approval-student');
  result:=public.lms_request_document_content(rid);
  if result->>'draft'<>'false' or result->'document'->>'candidateName'<>'Corrected Student' then raise exception 'Approved copy unavailable or does not match preview';end if;
  if result->'settings'?'bankName' then raise exception 'Private settings exposed';end if;
  perform pg_temp.approval_claims('approval-other');denied:=false;
  begin perform public.lms_request_document_content(rid);exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Another student accessed issued document';end if;
  perform pg_temp.approval_claims('approval-admin');denied:=false;
  begin perform public.lms_approve_document_request(rid,payload,(row->>'updated_at')::timestamptz,0,'');exception when serialization_failure then denied:=true;end;
  if not denied then raise exception 'Approval replay issued twice';end if;
  if doc_kind='certificate' then
   perform pg_temp.approval_claims('approval-student');
   other_rid:=public.lms_request_document('{"kind":"certificate"}');
   perform pg_temp.approval_claims('approval-admin');
   select value into row from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=other_rid::text;
   denied:=false;
   begin perform public.lms_approve_document_request(other_rid,payload||'{"id":"approval-collision"}',(row->>'updated_at')::timestamptz,0,'');exception when unique_violation then denied:=true;end;
   if not denied then raise exception 'Duplicate certificate number was accepted';end if;
   select value into result from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=other_rid::text;
   if result->>'status'<>'pending' or result->>'studio_record_id' is not null or result->>'published_at' is not null then raise exception 'Registry save failure partially approved the request';end if;
  end if;
 end loop;
end $$;
reset role;
rollback;
