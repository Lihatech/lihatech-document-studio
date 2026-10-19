-- Drafts, explicit publication, immutable issued copies, and owner-only access. No retained data.
begin;
create function pg_temp.delivery_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.admin_profiles(full_name,email,firebase_uid,role) values('Delivery Admin','delivery-admin@example.invalid','delivery-admin','admin');
insert into public.students(id,full_name,email,firebase_uid,profile_completed_at) values
 ('23000000-0000-4000-8000-000000000001','Delivery Student','delivery-student@example.invalid','delivery-student',now()),
 ('23000000-0000-4000-8000-000000000002','Other Student','delivery-other@example.invalid','delivery-other',now());
insert into public.batches(id,name,code,start_date,end_date,status,course_name) values
 ('23000000-0000-4000-8000-000000000011','Delivery batch','DELIVERY-TEST',current_date-7,current_date+7,'active','Official programme');
insert into public.batch_students(student_id,batch_id) values('23000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000011');
insert into public.student_document_requests(id,student_id,batch_id,kind,candidate_name,program_name,certificate_type,offer_type,designation,department,start_date,end_date)
 values('23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000011',
 'offer_letter','Delivery Student','Official programme','Course Completion','Internship Offer','Developer Intern','Engineering',current_date-7,current_date+7);
insert into public.company_settings(id,settings) values(true,'{}') on conflict(id) do nothing;
update public.company_settings set settings=settings||'{"bankName":"PRIVATE BANK","signatureUrl":"TEST SIGNATURE"}'::jsonb where id=true;
set local role anon;
do $$ declare rid uuid; payload jsonb; rows jsonb; result jsonb; denied boolean; begin
 perform pg_temp.delivery_claims('delivery-student');
 result:=public.lms_document_preview_settings();
 if result?'bankName' or result?'signatureUrl' then raise exception 'Draft branding leaked private/signing settings'; end if;
 rid:=public.lms_request_document('{"kind":"certificate"}');
 payload:=jsonb_build_object('id','delivery-document','requestId',rid,'certificateId','DELIVERY-CERT-001','candidateName','Delivery Student',
   'programName','Official programme','certificateType','Course Completion','startDate',(current_date-7)::text,'endDate',(current_date+7)::text);
 perform pg_temp.delivery_claims('delivery-admin');denied:=false;
 begin perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','certificate','record_id','delivery-document','data',payload,'expected_version',0,'archived',false)));
 exception when others then denied:=true; end;
 if not denied then raise exception 'Saving auto-approved a pending request'; end if;
 perform public.lms_review_document_request(rid,'approved','');denied:=false;
 begin perform public.lms_review_document_request(rid,'fulfilled',''); exception when others then denied:=true; end;
 if not denied then raise exception 'Published without a saved document'; end if;
 perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','certificate','record_id','delivery-document','data',payload,'expected_version',0,'archived',false)));
 select value into result from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=rid::text;
 if result->>'status'<>'approved' or result->>'studio_record_id'<>'delivery-document' or not (result->>'draft_available')::boolean or result->>'published_at' is not null then raise exception 'Studio save did not remain an attached draft'; end if;
 perform pg_temp.delivery_claims('delivery-student');denied:=false;
 begin perform public.lms_request_document_content(rid); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Student accessed an unpublished draft'; end if;
 denied:=false;begin perform public.lms_review_document_request(rid,'fulfilled','');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Student published own document'; end if;
 perform pg_temp.delivery_claims('delivery-admin');
 perform public.lms_review_document_request(rid,'fulfilled','Ready for download.');
 perform pg_temp.delivery_claims('delivery-student');
 result:=public.lms_request_document_content(rid);
 if result->>'draft'<>'false' or result->'document'->>'candidateName'<>'Delivery Student' then raise exception 'Published content unavailable'; end if;
 if result->'settings'?'bankName' then raise exception 'Private company settings leaked'; end if;
 if result->'settings'->>'signatureUrl'<>'TEST SIGNATURE' then raise exception 'Issued branding snapshot missing'; end if;
 rows:=public.lms_student_document_requests();
 if rows->0?'published_document' or rows->0?'published_settings' then raise exception 'History fetched full document/signing payload'; end if;
 perform pg_temp.delivery_claims('delivery-other');denied:=false;
 begin perform public.lms_request_document_content(rid); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Another student accessed a published document'; end if;
 perform pg_temp.delivery_claims('delivery-admin');
 payload:=payload||'{"candidateName":"Corrected Final Name"}'::jsonb;
 perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','certificate','record_id','delivery-document','data',payload,'expected_version',1,'archived',false)));
 perform pg_temp.delivery_claims('delivery-student');
 if public.lms_request_document_content(rid)->'document'->>'candidateName'<>'Delivery Student' then raise exception 'Unpublished edit changed issued copy'; end if;
 perform pg_temp.delivery_claims('delivery-admin');
 perform public.lms_review_document_request(rid,'fulfilled','Corrected copy ready.');
 perform pg_temp.delivery_claims('delivery-student');
 if public.lms_request_document_content(rid)->'document'->>'candidateName'<>'Corrected Final Name' then raise exception 'Explicit republish did not update copy'; end if;
 perform pg_temp.delivery_claims('delivery-admin');
 perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','certificate','record_id','delivery-document','data',payload,'expected_version',2,'archived',true)));
 perform pg_temp.delivery_claims('delivery-student');
 if public.lms_request_document_content(rid)->'document'->>'candidateName'<>'Corrected Final Name' then raise exception 'Archiving Studio record removed issued copy'; end if;
 perform pg_temp.delivery_claims('delivery-admin');
 update public.batches set offer_type='Internship Offer',designation='Developer Intern',document_department='Engineering' where code='DELIVERY-TEST';
 perform pg_temp.delivery_claims('delivery-student');
 rid:='23000000-0000-4000-8000-000000000021';
 perform pg_temp.delivery_claims('delivery-admin');
 perform public.lms_review_document_request(rid,'approved','');
 payload:=jsonb_build_object('id','delivery-offer','requestId',rid,'candidateName','Delivery Student','letterType','Internship Offer',
   'designation','Developer Intern','department','Engineering','startDate',(current_date-7)::text,'endDate',(current_date+7)::text);
 denied:=false;begin perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','certificate','record_id','delivery-offer','data',payload,'expected_version',0,'archived',false)));exception when others then denied:=true;end;
 if not denied then raise exception 'Certificate was linked to an offer-letter request'; end if;
 perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object('kind','letter','record_id','delivery-offer','data',payload,'expected_version',0,'archived',false)));
 perform public.lms_review_document_request(rid,'fulfilled','Offer ready.');
 perform pg_temp.delivery_claims('delivery-student');
 result:=public.lms_request_document_content(rid);
 if result->>'kind'<>'offer_letter' or result->'document'->>'letterType'<>'Internship Offer' then raise exception 'Offer delivery failed'; end if;
end $$;
reset role;
rollback;
