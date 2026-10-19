begin;
create function pg_temp.management_notification_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
insert into public.admin_profiles(id,full_name,email,firebase_uid,role) values
 ('29000000-0000-4000-8000-000000000001','Manage Admin','manage-notification@example.invalid','manage-notification','admin'),
 ('29000000-0000-4000-8000-000000000002','Other Admin','other-manage-notification@example.invalid','other-manage-notification','admin');
insert into public.students(id,full_name,email) values('29000000-0000-4000-8000-000000000011','Manage Student','manage-notification-student@example.invalid');
insert into public.mock_interview_slots(id,starts_at,ends_at,capacity,status) values
 ('29000000-0000-4000-8000-000000000021',now()+interval '3 days',now()+interval '3 days 1 hour',1,'open');
insert into public.mock_interview_bookings(id,slot_id,student_id,status,prepared_topics) values
 ('29000000-0000-4000-8000-000000000031','29000000-0000-4000-8000-000000000021','29000000-0000-4000-8000-000000000011','requested','SQL');
update public.mock_interview_bookings set status='rejected' where id='29000000-0000-4000-8000-000000000031';
-- A fresh item older in wall-clock time must still be above a newer handled item.
insert into public.portal_notifications(id,admin_id,category,title,source_id,event_key,available_at) values
 ('29000000-0000-4000-8000-000000000041','29000000-0000-4000-8000-000000000001','documents','Fresh request','29000000-0000-4000-8000-000000000099','fresh-fixture',now()-interval '1 hour');
set local role anon;
do $$ declare feed jsonb; foreign_id uuid; begin
 perform pg_temp.management_notification_claims('manage-notification');
 feed:=public.lms_notifications();
 if feed->'items'->0->>'title'<>'Fresh request' then raise exception 'Fresh notification was not first'; end if;
 if (feed->'counts')?'mocks' then raise exception 'Handled request remained unread'; end if;
 if not exists(select 1 from jsonb_array_elements(feed->'items') n where n->>'title'='Interview declined' and n->>'resolved_at' is not null) then
   raise exception 'Handled notification was not moved to history'; end if;
 perform public.lms_clear_notifications(null,true);
 if jsonb_array_length(public.lms_notifications()->'items')<>1 then raise exception 'Clear read removed unread work or kept history'; end if;
 perform pg_temp.management_notification_claims('other-manage-notification');
 select (n->>'id')::uuid into foreign_id from jsonb_array_elements(public.lms_notifications()->'items') n limit 1;
 if foreign_id is null then raise exception 'Other admin notifications were cleared'; end if;
 perform pg_temp.management_notification_claims('manage-notification');
 perform public.lms_clear_notifications(foreign_id);
 perform pg_temp.management_notification_claims('other-manage-notification');
 if jsonb_array_length(public.lms_notifications()->'items')<>1 then raise exception 'Cross-account dismissal allowed'; end if;
 perform pg_temp.management_notification_claims('manage-notification');
 perform public.lms_clear_notifications();
 if public.lms_notifications()->'counts'<>'{}'::jsonb or jsonb_array_length(public.lms_notifications()->'items')<>0 then raise exception 'Clear all failed'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.mock_interview_bookings where id='29000000-0000-4000-8000-000000000031') then raise exception 'Clearing deleted source booking'; end if;
end $$;
update public.mock_interview_bookings set status='requested' where id='29000000-0000-4000-8000-000000000031';
update public.mock_interview_bookings set status='booked' where id='29000000-0000-4000-8000-000000000031';
do $$ begin
 if not exists(select 1 from public.portal_notifications where source_id='29000000-0000-4000-8000-000000000031' and title='Interview declined' and resolved_at is not null) then
   raise exception 'A re-request overwrote historical decisions'; end if;
end $$;
update public.mock_interview_bookings set status='cancelled' where id='29000000-0000-4000-8000-000000000031';
set local role anon;
do $$ begin
 perform pg_temp.management_notification_claims('manage-notification');
 if (public.lms_notifications()->'counts'->>'mocks')::integer<>1 then raise exception 'New cancellation alert was hidden as old history'; end if;
end $$;
reset role;
rollback;
