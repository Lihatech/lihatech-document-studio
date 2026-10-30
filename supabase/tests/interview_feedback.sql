-- Run after migrations; fixtures and feedback are rolled back.
begin;
insert into public.admin_profiles(id,full_name,email,firebase_uid,role) values
 ('35000000-0000-4000-8000-000000000001','Feedback Admin','feedback-admin@example.invalid','feedback-admin','admin');
insert into public.students(id,full_name,email,firebase_uid) values
 ('35000000-0000-4000-8000-000000000011','Feedback Student','feedback-student@example.invalid','feedback-student'),
 ('35000000-0000-4000-8000-000000000012','Other Student','feedback-other@example.invalid','feedback-other');
insert into public.mock_interview_slots(id,mentor_name,starts_at,ends_at,capacity,status) values
 ('35000000-0000-4000-8000-000000000021','Mentor',now()-interval '2 hours',now()-interval '1 hour',1,'open');
insert into public.mock_interview_bookings(id,student_id,slot_id,status) values
 ('35000000-0000-4000-8000-000000000031','35000000-0000-4000-8000-000000000011','35000000-0000-4000-8000-000000000021','booked');
create function pg_temp.feedback_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
set local role anon;
do $$ declare bid uuid:='35000000-0000-4000-8000-000000000031'; row jsonb; begin
 perform pg_temp.feedback_claims('feedback-student');
 begin
   perform public.lms_admin_save_interview_feedback(bid,'completed','Unauthorised',90,'',true);
   raise exception 'Student was allowed to publish';
 exception when insufficient_privilege then null; end;
 perform pg_temp.feedback_claims('feedback-admin');
 perform public.lms_admin_save_interview_feedback(bid,'completed','Draft only',80,'Private note',false);
 perform pg_temp.feedback_claims('feedback-student');
 row:=public.lms_student_home()->'bookings'->0;
 if row->>'feedback' is not null or row->>'score' is not null or row?'feedback_draft' or row?'internal_notes' then
   raise exception 'Draft or private notes exposed: %',row; end if;
 perform pg_temp.feedback_claims('feedback-admin');
 begin
   perform public.lms_admin_save_interview_feedback(bid,'completed',' ',80,'',true);
   raise exception 'Empty feedback published';
 exception when raise_exception then if SQLERRM='Empty feedback published' then raise; end if; end;
 perform public.lms_admin_save_interview_feedback(bid,'completed','Practise SQL joins',0,'Private note',true);
 perform pg_temp.feedback_claims('feedback-student');
 row:=public.lms_student_home()->'bookings'->0;
 if row->>'feedback'<>'Practise SQL joins' or (row->>'score')::integer<>0 or row?'internal_notes' then
   raise exception 'Published feedback incorrect: %',row; end if;
 perform pg_temp.feedback_claims('feedback-other');
 if jsonb_array_length(public.lms_student_home()->'bookings')<>0 then raise exception 'Another student can see feedback'; end if;
 perform pg_temp.feedback_claims('feedback-admin');
 perform public.lms_admin_save_interview_feedback(bid,'completed','Keep practising SQL joins',50,'Private note',true);
 perform pg_temp.feedback_claims('feedback-student');
 if not exists(select 1 from jsonb_array_elements(public.lms_notifications()->'items') n where n->>'title'='Interview feedback updated') then
   raise exception 'Feedback update notification missing'; end if;
 perform pg_temp.feedback_claims('feedback-other');
 begin
   perform public.lms_admin_send_interview_feedback(bid,'Not allowed');
   raise exception 'Student was allowed to send feedback';
 exception when insufficient_privilege then null; end;
 perform pg_temp.feedback_claims('feedback-admin');
 perform public.lms_admin_send_interview_feedback(bid,'Simple feedback');
 perform pg_temp.feedback_claims('feedback-student');
 row:=public.lms_student_home()->'bookings'->0;
 if row->>'feedback'<>'Simple feedback' or row->>'status'<>'completed' then
   raise exception 'Send did not preserve the interview status: %',row; end if;
end $$;
rollback;
