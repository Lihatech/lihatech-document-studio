-- Run after migrations against a test database. All fixtures are rolled back.
begin;
insert into public.admin_profiles(id,full_name,email,firebase_uid,role) values
 ('37000000-0000-4000-8000-000000000001','Deletion Admin','deletion-admin@example.invalid','deletion-admin','admin');
insert into public.students(id,full_name,email,firebase_uid) values
 ('37000000-0000-4000-8000-000000000011','Deletion Student','deletion-student@example.invalid','deletion-student');
insert into public.batches(id,name,code,course_name,start_date,end_date,status) values
 ('37000000-0000-4000-8000-000000000021','Delete batch','DELETE-TEST-A','Test',current_date-5,current_date+45,'active'),
 ('37000000-0000-4000-8000-000000000022','Keep batch','DELETE-TEST-B','Test',current_date-5,current_date+45,'active');
insert into public.batch_students(student_id,batch_id) values
 ('37000000-0000-4000-8000-000000000011','37000000-0000-4000-8000-000000000021');
insert into public.learning_materials(id,title,kind,url,status) values
 ('37000000-0000-4000-8000-000000000031','Shared resource','link','https://example.invalid/lesson','published');
insert into public.learning_materials(id,title,kind,storage_path,status) values
 ('37000000-0000-4000-8000-000000000032','Uploaded resource','file','deletion-test/resource.pdf','draft');
insert into public.batch_materials(batch_id,material_id) values
 ('37000000-0000-4000-8000-000000000021','37000000-0000-4000-8000-000000000031'),
 ('37000000-0000-4000-8000-000000000022','37000000-0000-4000-8000-000000000031');
insert into public.material_progress(student_id,material_id) values
 ('37000000-0000-4000-8000-000000000011','37000000-0000-4000-8000-000000000031');
insert into public.mock_interview_slots(id,batch_id,starts_at,ends_at,status) values
 ('37000000-0000-4000-8000-000000000041','37000000-0000-4000-8000-000000000021',now()-interval '2 hours',now()-interval '1 hour','completed');
insert into public.mock_interview_bookings(id,slot_id,student_id,status) values
 ('37000000-0000-4000-8000-000000000051','37000000-0000-4000-8000-000000000041','37000000-0000-4000-8000-000000000011','completed');
create function pg_temp.deletion_claims(uid text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',uid||'@example.invalid','email_verified',true,
 'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true)::text::void;
$$;
set local role anon;
do $$ begin
 perform pg_temp.deletion_claims('deletion-student');
 begin
   perform public.lms_admin_delete_batch('37000000-0000-4000-8000-000000000021');
   raise exception 'Student deleted a batch';
 exception when insufficient_privilege then null; end;
 begin
   perform public.lms_admin_delete_material('37000000-0000-4000-8000-000000000031');
   raise exception 'Student deleted a material';
 exception when insufficient_privilege then null; end;
 perform pg_temp.deletion_claims('deletion-admin');
 perform public.lms_admin_delete_batch('37000000-0000-4000-8000-000000000021');
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.batches where id='37000000-0000-4000-8000-000000000021') then raise exception 'Batch still exists'; end if;
 if exists(select 1 from public.batch_students where batch_id='37000000-0000-4000-8000-000000000021') then raise exception 'Enrolment still exists'; end if;
 if not exists(select 1 from public.students where id='37000000-0000-4000-8000-000000000011') then raise exception 'Student account deleted'; end if;
 if not exists(select 1 from public.batch_materials where batch_id='37000000-0000-4000-8000-000000000022') then raise exception 'Other batch lost material access'; end if;
 if not exists(select 1 from public.mock_interview_bookings where id='37000000-0000-4000-8000-000000000051') then raise exception 'Interview history deleted'; end if;
 if not exists(select 1 from public.mock_interview_slots where id='37000000-0000-4000-8000-000000000041' and batch_id is null) then raise exception 'Interview not detached'; end if;
end $$;
set local role anon;
do $$ declare path text; begin
 perform pg_temp.deletion_claims('deletion-admin');
 path:=public.lms_admin_delete_material('37000000-0000-4000-8000-000000000031');
 if path is not null then raise exception 'Web link returned a storage path'; end if;
 path:=public.lms_admin_delete_material('37000000-0000-4000-8000-000000000032');
 if path is distinct from 'deletion-test/resource.pdf' then raise exception 'Wrong storage cleanup path'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.learning_materials where id in ('37000000-0000-4000-8000-000000000031','37000000-0000-4000-8000-000000000032')) then raise exception 'Document not deleted'; end if;
 if exists(select 1 from public.batch_materials where material_id='37000000-0000-4000-8000-000000000031') then raise exception 'Material assignments remain'; end if;
 if exists(select 1 from public.material_progress where material_id='37000000-0000-4000-8000-000000000031') then raise exception 'Material progress remains'; end if;
 if not exists(select 1 from public.batches where id='37000000-0000-4000-8000-000000000022') then raise exception 'Other batch deleted'; end if;
end $$;
rollback;
