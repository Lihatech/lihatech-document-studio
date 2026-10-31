-- Five-day recoverable deletion. Keep original rows and relationships until expiry.
alter table public.students add column trashed_at timestamptz;
alter table public.batches add column trashed_at timestamptz;
create table public.lms_trash (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('batch','student')),
  entity_id uuid not null,
  title text not null,
  previous_status text not null,
  group_id uuid not null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '5 days',
  data jsonb not null default '{}'::jsonb,
  unique(kind,entity_id)
);
alter table public.lms_trash enable row level security;
revoke all on public.lms_trash from public,anon,authenticated;

create or replace function public.lms_student_id() returns uuid
language sql stable security definer set search_path=public as $$
  select id from public.students where public.lms_verified_user()
    and firebase_uid=auth.jwt()->>'sub' and status='active' and trashed_at is null;
$$;
create or replace function public.lms_has_enrollment(p_batch uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
    where e.student_id=public.lms_student_id() and e.batch_id=p_batch and e.status='active' and e.left_at is null
      and b.trashed_at is null and b.status in ('planned','active')
      and now()>=b.start_date::timestamp at time zone 'Asia/Kolkata'
      and now()<(b.end_date+1)::timestamp at time zone 'Asia/Kolkata');
$$;

create function public.lms_guard_trashed_row() returns trigger
language plpgsql set search_path=public as $$
begin
  if old.trashed_at is not null and new.trashed_at is not null
    and new.status<>(case when TG_TABLE_NAME='students' then 'archived' else 'cancelled' end) then
    raise exception 'Restore this record from Trash before changing its access.';
  end if;
  return new;
end $$;
create trigger guard_trashed_student before update on public.students for each row execute function public.lms_guard_trashed_row();
create trigger guard_trashed_batch before update on public.batches for each row execute function public.lms_guard_trashed_row();
revoke all on function public.lms_guard_trashed_row() from public,anon,authenticated;
create function public.lms_guard_trash_enrollment() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.students where id=new.student_id for update;
  if exists(select 1 from public.students where id=new.student_id and trashed_at is not null)
    or exists(select 1 from public.batches where id=new.batch_id and trashed_at is not null) then
    raise exception 'Restore the student and batch from Trash before assigning access.';
  end if;
  return new;
end $$;
create trigger guard_trash_enrollment before insert or update on public.batch_students
  for each row execute function public.lms_guard_trash_enrollment();
revoke all on function public.lms_guard_trash_enrollment() from public,anon,authenticated;

create function public.lms_trash_student_record(p_student uuid,p_group uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.students;
begin
  select * into s from public.students where id=p_student and trashed_at is null for update;
  if not found then raise exception 'Student not found or already in Trash.'; end if;
  insert into public.lms_trash(kind,entity_id,title,previous_status,group_id)
    values('student',s.id,coalesce(nullif(s.full_name,''),s.email),s.status,p_group);
  update public.students set status='archived',trashed_at=now(),updated_at=now() where id=s.id;
end $$;
revoke all on function public.lms_trash_student_record(uuid,uuid) from public,anon,authenticated;

create function public.lms_admin_trash_students(p_students uuid[],p_only_unassigned boolean default false) returns integer
language plpgsql security definer set search_path=public as $$
declare sid uuid; total integer:=0; gid uuid:=gen_random_uuid();
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  if coalesce(cardinality(p_students),0) not between 1 and 1000 or array_position(p_students,null) is not null then
    raise exception 'Choose between 1 and 1,000 students.'; end if;
  perform pg_advisory_xact_lock(61109001);
  for sid in select distinct id from unnest(p_students) chosen(id) order by id loop
    perform 1 from public.students where id=sid for update;
    if p_only_unassigned and exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
      where e.student_id=sid and e.status in ('active','suspended') and e.left_at is null and b.trashed_at is null) then
      raise exception 'A selected student now has batch access. Refresh the list and try again.';
    end if;
    perform public.lms_trash_student_record(sid,gid);total:=total+1;
  end loop;
  return total;
end $$;
revoke all on function public.lms_admin_trash_students(uuid[],boolean) from public;
grant execute on function public.lms_admin_trash_students(uuid[],boolean) to anon,authenticated;

create function public.lms_admin_trash_batch(p_batch uuid,p_delete_students boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches; s public.students; gid uuid:=gen_random_uuid(); suspended jsonb:='[]'::jsonb; moved integer:=0;
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(61109001);
  select * into b from public.batches where id=p_batch and trashed_at is null for no key update;
  if not found then raise exception 'Batch not found or already in Trash.'; end if;
  insert into public.lms_trash(id,kind,entity_id,title,previous_status,group_id)
    values(gid,'batch',b.id,b.name,b.status,gid);
  update public.batches set status='cancelled',trashed_at=now(),updated_at=now() where id=b.id;
  for s in select student.* from public.students student where student.trashed_at is null
    and exists(select 1 from public.batch_students e where e.batch_id=b.id and e.student_id=student.id
      and e.status in ('active','suspended') and e.left_at is null) order by student.id for update loop
    if not exists(select 1 from public.batch_students e join public.batches other on other.id=e.batch_id
      where e.student_id=s.id and e.batch_id<>b.id and e.status in ('active','suspended') and e.left_at is null and other.trashed_at is null) then
      if coalesce(p_delete_students,false) then
        perform public.lms_trash_student_record(s.id,gid);moved:=moved+1;
      elsif s.status='active' then
        update public.students set status='suspended',updated_at=now() where id=s.id;
        suspended:=suspended||jsonb_build_array(jsonb_build_object('id',s.id,'status',s.status,'changed_at',now()));
      end if;
    end if;
  end loop;
  update public.lms_trash set data=jsonb_build_object('suspended_students',suspended) where id=gid;
  return jsonb_build_object('trash_id',gid,'students_moved',moved,'students_suspended',jsonb_array_length(suspended));
end $$;
revoke all on function public.lms_admin_trash_batch(uuid,boolean) from public;
grant execute on function public.lms_admin_trash_batch(uuid,boolean) to anon,authenticated;
-- Keep older clients recoverable too.
create or replace function public.lms_admin_delete_batch(p_batch uuid) returns void
language plpgsql security definer set search_path=public as $$
begin perform public.lms_admin_trash_batch(p_batch,false);end $$;

create function public.lms_restore_student_record(p_entry uuid) returns void
language plpgsql security definer set search_path=public as $$
declare entry public.lms_trash; restored_status text;
begin
  select * into entry from public.lms_trash where id=p_entry and kind='student' for update;
  if not found or entry.expires_at<=clock_timestamp() then raise exception 'The five-day restore window has expired.'; end if;
  restored_status:=entry.previous_status;
  if restored_status='active' and not exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
    where e.student_id=entry.entity_id and e.status in ('active','suspended') and e.left_at is null and b.trashed_at is null) then restored_status:='suspended'; end if;
  update public.students set status=restored_status,trashed_at=null,updated_at=now() where id=entry.entity_id;
  delete from public.lms_trash where id=p_entry;
end $$;
revoke all on function public.lms_restore_student_record(uuid) from public,anon,authenticated;
create function public.lms_admin_restore_trash(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare entry public.lms_trash; child record; saved jsonb;
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(61109001);
  select * into entry from public.lms_trash where id=p_id for update;
  if not found or entry.expires_at<=clock_timestamp() then raise exception 'The five-day restore window has expired.'; end if;
  if entry.kind='student' then perform public.lms_restore_student_record(entry.id);return;end if;
  update public.batches set status=entry.previous_status,trashed_at=null,updated_at=now() where id=entry.entity_id;
  for child in select id from public.lms_trash where kind='student' and group_id=entry.group_id and expires_at>clock_timestamp() order by entity_id loop
    perform public.lms_restore_student_record(child.id);
  end loop;
  for saved in select value from jsonb_array_elements(coalesce(entry.data->'suspended_students','[]'::jsonb)) loop
    -- Do not overwrite subsequent admin changes to the student's account.
    update public.students set status=saved->>'status',updated_at=now()
      where id=(saved->>'id')::uuid and trashed_at is null and status='suspended'
        and updated_at=(saved->>'changed_at')::timestamptz;
  end loop;
  delete from public.lms_trash where id=p_id;
end $$;
revoke all on function public.lms_admin_restore_trash(uuid) from public;
grant execute on function public.lms_admin_restore_trash(uuid) to anon,authenticated;

create function public.lms_purge_expired_trash() returns void
language plpgsql security definer set search_path=public as $$
declare entry record;
begin
  perform pg_advisory_xact_lock(61109001);
  for entry in select * from public.lms_trash where expires_at<=now() and kind='student' order by entity_id for update loop
    delete from public.material_progress where student_id=entry.entity_id;
    delete from public.students where id=entry.entity_id and trashed_at is not null;
    delete from public.lms_trash where id=entry.id;
  end loop;
  for entry in select * from public.lms_trash where expires_at<=now() and kind='batch' order by entity_id for update loop
    delete from public.batch_materials where batch_id=entry.entity_id;
    update public.mock_interview_slots set batch_id=null where batch_id=entry.entity_id;
    delete from public.batches where id=entry.entity_id and trashed_at is not null;
    delete from public.lms_trash where id=entry.id;
  end loop;
end $$;
revoke all on function public.lms_purge_expired_trash() from public,anon,authenticated;
grant execute on function public.lms_purge_expired_trash() to service_role;
create function public.lms_admin_trash() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform public.lms_purge_expired_trash();
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'title',t.title,'deleted_at',t.deleted_at,
    'expires_at',t.expires_at,'related_students',(select count(*) from public.lms_trash child where child.kind='student' and child.group_id=t.group_id))
    order by t.deleted_at desc,t.kind) from public.lms_trash t),'[]'::jsonb);
end $$;
revoke all on function public.lms_admin_trash() from public;
grant execute on function public.lms_admin_trash() to anon,authenticated;
notify pgrst,'reload schema';

-- Cron installation: https://supabase.com/docs/guides/cron/install
-- Restore expires at exactly five days; physical cleanup runs every 30 minutes.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('lms-trash-five-day-cleanup','*/30 * * * *','select public.lms_purge_expired_trash();');
