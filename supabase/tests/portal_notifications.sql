-- Real trigger/RPC checks in a rolled-back transaction. No invitations are sent.
begin;
create function pg_temp.notification_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.admin_profiles(id,full_name,email,firebase_uid,role) values
 ('28000000-0000-4000-8000-000000000001','Notification Admin','notification-admin@example.invalid','notification-admin','admin'),
 ('28000000-0000-4000-8000-000000000002','Other Admin','notification-other-admin@example.invalid','notification-other-admin','admin');
insert into public.students(id,full_name,email,firebase_uid) values
 ('28000000-0000-4000-8000-000000000011','Notification Student','notification-student@example.invalid','notification-student'),
 ('28000000-0000-4000-8000-000000000012','Other Student','notification-other@example.invalid','notification-other');
insert into public.batches(id,name,code,course_name,start_date,end_date,status) values
 ('28000000-0000-4000-8000-000000000021','Notification batch','NOTIFY-TEST','Test course',current_date-5,current_date+45,'active');
insert into public.batch_students(student_id,batch_id) values
 ('28000000-0000-4000-8000-000000000011','28000000-0000-4000-8000-000000000021');
insert into public.learning_materials(id,title,kind,url,status) values
 ('28000000-0000-4000-8000-000000000031','Notification lesson','link','https://example.invalid/lesson','published');
insert into public.batch_materials(batch_id,material_id,available_from) values
 ('28000000-0000-4000-8000-000000000021','28000000-0000-4000-8000-000000000031',now()+interval '1 day');
insert into public.student_document_requests(id,student_id,kind,candidate_name,program_name,certificate_type) values
 ('28000000-0000-4000-8000-000000000041','28000000-0000-4000-8000-000000000011','certificate','Notification Student','Test course','Course Completion');
insert into public.mock_interview_slots(id,mentor_name,starts_at,ends_at,capacity,status) values
 ('28000000-0000-4000-8000-000000000051','Test interviewer',now()+interval '2 days',now()+interval '2 days 1 hour',1,'open');
insert into public.mock_interview_bookings(id,student_id,slot_id,status,prepared_topics) values
 ('28000000-0000-4000-8000-000000000061','28000000-0000-4000-8000-000000000011','28000000-0000-4000-8000-000000000051','requested','SQL joins');
set local role anon;
do $$ declare feed jsonb; notice uuid; denied boolean:=false; begin
  perform pg_temp.notification_claims('notification-admin');
  feed:=public.lms_notifications();
  if (feed->'counts'->>'documents')::integer<>1 or (feed->'counts'->>'mocks')::integer<>1 or (feed->'counts'->>'materials')::integer<>1 then
    raise exception 'Admin categories did not receive new activity: %',feed; end if;
  select (n->>'id')::uuid into notice from jsonb_array_elements(feed->'items') n where n->>'category'='mocks';
  perform public.lms_read_notifications(notice);
  if (public.lms_notifications()->'counts')?'mocks' then raise exception 'Read badge did not clear'; end if;
  perform pg_temp.notification_claims('notification-other-admin');
  if (public.lms_notifications()->'counts'->>'mocks')::integer<>1 then raise exception 'Reading affected another admin'; end if;
  perform pg_temp.notification_claims('notification-student');
  if jsonb_array_length(public.lms_notifications()->'items')<>0 then raise exception 'Student saw unreleased material or admin-only activity'; end if;
  begin perform 1 from public.portal_notifications; exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Direct table access allowed'; end if;
end $$;
reset role;
update public.batch_materials set available_from=now()-interval '1 hour' where batch_id='28000000-0000-4000-8000-000000000021';
-- Repeated publication must not produce duplicate notifications; release time must be updated.
update public.batch_materials set available_from=now()-interval '1 hour' where batch_id='28000000-0000-4000-8000-000000000021';
update public.mock_interview_bookings set status='booked',meeting_url='https://meet.google.com/example' where id='28000000-0000-4000-8000-000000000061';
update public.student_document_requests set status='declined',admin_note='Please correct your details.' where id='28000000-0000-4000-8000-000000000041';
set local role anon;
do $$ declare feed jsonb; other_id uuid; begin
  perform pg_temp.notification_claims('notification-student');
  feed:=public.lms_notifications();
  if jsonb_array_length(feed->'items')<>3 or (feed->'counts'->>'materials')::integer<>1 then
    raise exception 'Student notification visibility or deduplication failed: %',feed; end if;
  select (n->>'id')::uuid into other_id from jsonb_array_elements(feed->'items') n limit 1;
  perform pg_temp.notification_claims('notification-other');
  perform public.lms_read_notifications(other_id);
  if jsonb_array_length(public.lms_notifications()->'items')<>0 then raise exception 'Student saw another account updates'; end if;
  perform pg_temp.notification_claims('notification-student');
  if (select count(*) from jsonb_array_elements(public.lms_notifications()->'items') n where n->>'read_at' is null)<>3 then
    raise exception 'Cross-account read changed another user'; end if;
  perform public.lms_read_notifications();
  if public.lms_notifications()->'counts'<>'{}'::jsonb then raise exception 'Mark all read failed'; end if;
end $$;
reset role;
rollback;
