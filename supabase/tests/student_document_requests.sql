-- Run after 20261021000000_batch_document_workflow.sql; fixture data rolls back.
begin;
create function pg_temp.claims(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',email,'email_verified',true,
    'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.students(full_name,email,firebase_uid,profile_completed_at) values
  ('Request Student A','request-student-a@example.invalid','request-student-a',now()),
  ('Request Student B','request-student-b@example.invalid','request-student-b',now());
insert into public.admin_profiles(full_name,email,firebase_uid,role) values
  ('Request Admin','request-admin@example.invalid','request-admin','admin');
insert into public.batches(name,code,start_date,end_date,status,course_name) values
 ('Request test batch','REQUEST-TEST',(now() at time zone 'Asia/Kolkata')::date-1,(now() at time zone 'Asia/Kolkata')::date+30,'active','AI Internship');
insert into public.batch_students(batch_id,student_id)
 select b.id,s.id from public.batches b cross join public.students s where b.code='REQUEST-TEST' and s.firebase_uid='request-student-a';
set local role anon;
do $$ declare rid uuid; rows jsonb; begin
  perform pg_temp.claims('request-student-a','request-student-a@example.invalid');
  rid := public.lms_request_document(jsonb_build_object('kind','certificate','candidate_name','Student A',
    'program_name','AI Internship','certificate_type','Internship','student_id',gen_random_uuid()));
  rows := public.lms_student_document_requests();
  if jsonb_array_length(rows) <> 1 or rows->0->>'id' <> rid::text then raise exception 'Student request was not saved.'; end if;
  begin
    perform public.lms_review_document_request(rid,'approved','');
    raise exception 'Student reviewed own request.';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.claims('request-student-b','request-student-b@example.invalid');
  if jsonb_array_length(public.lms_student_document_requests()) <> 0 then raise exception 'Student B can read student A requests.'; end if;
  perform pg_temp.claims('request-admin','request-admin@example.invalid');
  rows := public.lms_admin_document_requests();
  if jsonb_array_length(rows) <> 1 or rows->0->>'student_email' <> 'request-student-a@example.invalid' then
    raise exception 'Admin queue is missing the request or accepted a forged student id.';
  end if;
  perform public.lms_review_document_request(rid,'approved','We can prepare this.');
  perform public.lms_review_document_request(rid,'fulfilled','Shared with student.');
  perform pg_temp.claims('request-student-a','request-student-a@example.invalid');
  rows := public.lms_student_document_requests();
  if rows->0->>'status' <> 'fulfilled' or rows->0->>'admin_note' <> 'Shared with student.' then
    raise exception 'Student cannot see the review result.';
  end if;
end $$;
rollback;
