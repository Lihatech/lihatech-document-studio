-- Version 1: approved admins and registered students; instructors are deferred.
create or replace function public.lms_verified_user() returns boolean
language sql stable as $$
  select coalesce(auth.jwt()->>'iss' = 'https://securetoken.google.com/lihatech-document-studio'
    and auth.jwt()->>'aud' = 'lihatech-document-studio'
    and auth.jwt()->>'email_verified' = 'true' and nullif(auth.jwt()->>'sub','') is not null, false);
$$;
create or replace function public.has_admin_access() returns boolean
language sql stable security definer set search_path = public as $$
  select public.lms_verified_user() and exists(select 1 from public.admin_profiles
    where firebase_uid = auth.jwt()->>'sub' and is_active and role in ('owner','admin'));
$$;
create or replace function public.has_admin_management_access() returns boolean
language sql stable as $$ select public.has_admin_access(); $$;

alter table public.students add column firebase_uid text unique;
create unique index students_email_unique on public.students(lower(trim(email)));
alter table public.students add constraint students_name_required check (length(trim(full_name)) > 0);
alter table public.students add constraint students_email_required check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.batch_students add column starts_at timestamptz not null default now();
alter table public.batch_students add column expires_at timestamptz;
alter table public.batch_students add column status text not null default 'active' check(status in ('active','suspended','revoked'));
alter table public.batch_students add constraint enrollment_window check(expires_at is null or expires_at > starts_at);
alter table public.batches add constraint batch_dates check(end_date is null or start_date is null or end_date >= start_date);
alter table public.mock_interview_slots add column mentor_name text not null default '';
alter table public.mock_interview_slots add column meeting_url text;
alter table public.mock_interview_slots add column booking_deadline timestamptz;
alter table public.mock_interview_slots add constraint mock_window check(ends_at > starts_at and (booking_deadline is null or booking_deadline <= starts_at));
alter table public.mock_interview_slots add constraint mock_meeting_https check(meeting_url is null or meeting_url='' or meeting_url ~ '^https://');
alter table public.mock_interview_bookings add column score integer check(score between 0 and 100);
alter table public.mock_interview_bookings add column internal_notes text;

create table public.learning_materials (
  id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) > 0),
  description text not null default '', course_id uuid references public.courses(id),
  module_name text not null default '', position integer not null default 0,
  kind text not null default 'link' check(kind in ('link','file')),
  url text, storage_path text, status text not null default 'draft' check(status in ('draft','published','hidden')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((kind='link' and url ~ '^https://') or (kind='file' and nullif(storage_path,'') is not null))
);
create table public.batch_materials (
  batch_id uuid references public.batches(id), material_id uuid references public.learning_materials(id),
  available_from timestamptz not null default now(), expires_at timestamptz,
  primary key(batch_id, material_id), check(expires_at is null or expires_at > available_from)
);
create table public.material_progress (
  student_id uuid references public.students(id), material_id uuid references public.learning_materials(id),
  completed_at timestamptz not null default now(), primary key(student_id, material_id)
);
create or replace function public.lms_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where public.lms_verified_user() and firebase_uid=auth.jwt()->>'sub' and status='active';
$$;
create or replace function public.lms_has_enrollment(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
    where e.student_id=public.lms_student_id() and e.batch_id=p_batch and e.status='active' and e.left_at is null
    and e.starts_at <= now() and (e.expires_at is null or now() < e.expires_at) and b.status in ('active','completed'));
$$;
create or replace function public.lms_can_read_material(p_material uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.learning_materials m join public.batch_materials bm on bm.material_id=m.id
    where m.id=p_material and m.status='published' and bm.available_from <= now()
    and (bm.expires_at is null or now() < bm.expires_at) and public.lms_has_enrollment(bm.batch_id)
    and (m.course_id is null or (exists(select 1 from public.batch_courses bc where bc.batch_id=bm.batch_id and bc.course_id=m.course_id)
      and not exists(select 1 from public.student_course_access a where a.student_id=public.lms_student_id() and a.course_id=m.course_id
        and (a.status <> 'active' or a.starts_at > now() or a.expires_at <= now())))));
$$;

-- Student data is returned by narrow RPC projections, never through staff tables.
do $$ declare t text; begin
  foreach t in array array['learning_materials','batch_materials','material_progress'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated',t);
    execute format('create policy admin_access on public.%I for all to anon, authenticated using(public.has_admin_access()) with check(public.has_admin_access())',t);
  end loop;
end $$;

create or replace function public.lms_session() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.admin_profiles; s public.students; invite public.staff_invitations; em text := lower(trim(auth.jwt()->>'email'));
begin
  if not public.lms_verified_user() then raise exception 'Sign in with a verified Google account.' using errcode='42501'; end if;
  select * into p from public.admin_profiles where firebase_uid=auth.jwt()->>'sub';
  if found then
    if not p.is_active or p.role not in ('owner','admin') then raise exception 'This staff account has no version 1 access. Contact admin.' using errcode='42501'; end if;
    return jsonb_build_object('role','admin','id',p.id,'name',p.full_name,'email',em);
  end if;
  select * into invite from public.staff_invitations where lower(email)=em and status='pending' and role='admin' and expires_at>now() for update;
  if found then
    perform public.provision_staff_from_invitation(auth.jwt()->>'sub',em);
    select * into p from public.admin_profiles where firebase_uid=auth.jwt()->>'sub';
    return jsonb_build_object('role','admin','id',p.id,'name',p.full_name,'email',em);
  end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub' or lower(trim(email))=em order by firebase_uid nulls last limit 1 for update;
  if not found then raise exception 'This email is not registered. Contact admin for access.' using errcode='42501'; end if;
  if s.firebase_uid is not null and s.firebase_uid <> auth.jwt()->>'sub' then raise exception 'This student account is linked to another identity. Contact admin.' using errcode='42501'; end if;
  update public.students set firebase_uid=auth.jwt()->>'sub' where id=s.id and firebase_uid is null;
  return jsonb_build_object('role','student','id',s.id,'name',s.full_name,'email',s.email,'status',s.status);
end $$;

create or replace function public.lms_student_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.students; result jsonb;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  result := jsonb_build_object('student',jsonb_build_object('id',s.id,'full_name',s.full_name,'email',s.email,'status',s.status), 'server_time',now());
  result := result || jsonb_build_object('enrollments',coalesce((select jsonb_agg(jsonb_build_object(
    'batch_id',b.id,'name',b.name,'code',b.code,'batch_status',b.status,'status',e.status,'starts_at',e.starts_at,'expires_at',e.expires_at,'left_at',e.left_at,
    'accessible',public.lms_has_enrollment(b.id))) from public.batch_students e join public.batches b on b.id=e.batch_id where e.student_id=s.id),'[]'::jsonb));
  if s.status <> 'active' then return result || jsonb_build_object('materials','[]'::jsonb,'slots','[]'::jsonb,'bookings','[]'::jsonb); end if;
  return result || jsonb_build_object(
    'materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'module_name',m.module_name,'kind',m.kind,
      'batch_id',bm.batch_id,'course_id',m.course_id,'available_from',bm.available_from,'expires_at',bm.expires_at,
      'accessible',public.lms_can_read_material(m.id) and bm.available_from<=now() and (bm.expires_at is null or now()<bm.expires_at),
      'completed',exists(select 1 from public.material_progress pr where pr.student_id=s.id and pr.material_id=m.id)) order by m.position,m.title)
      from public.learning_materials m join public.batch_materials bm on bm.material_id=m.id where m.status='published' and public.lms_has_enrollment(bm.batch_id)
      and (m.course_id is null or exists(select 1 from public.batch_courses bc where bc.batch_id=bm.batch_id and bc.course_id=m.course_id))), '[]'::jsonb),
    'slots',coalesce((select jsonb_agg(jsonb_build_object('id',sl.id,'batch_id',sl.batch_id,'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,
      'booking_deadline',sl.booking_deadline,'capacity',sl.capacity,'remaining',sl.capacity-(select count(*) from public.mock_interview_bookings bk where bk.slot_id=sl.id and bk.status in ('booked','completed','no_show'))))
      from public.mock_interview_slots sl where public.lms_has_enrollment(sl.batch_id) and sl.status in ('open','full') and sl.starts_at>now()
      and (sl.booking_deadline is null or sl.booking_deadline>now())
      and exists(select 1 from public.batch_students e where e.student_id=s.id and e.batch_id=sl.batch_id and e.starts_at<=sl.starts_at and (e.expires_at is null or e.expires_at>=sl.ends_at))), '[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',bk.id,'slot_id',sl.id,'batch_id',sl.batch_id,'status',bk.status,'feedback',bk.feedback,'score',bk.score,
      'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,'slot_status',sl.status,
      'meeting_url',case when public.lms_has_enrollment(sl.batch_id) and bk.status='booked' and sl.ends_at>now() and sl.status not in ('cancelled','completed') then sl.meeting_url else null end))
      from public.mock_interview_bookings bk join public.mock_interview_slots sl on sl.id=bk.slot_id where bk.student_id=s.id), '[]'::jsonb));
end $$;

create or replace function public.lms_open_material(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.learning_materials;
begin
  if not public.lms_can_read_material(p_id) then raise exception 'This material is unavailable or your access has expired.' using errcode='42501'; end if;
  select * into m from public.learning_materials where id=p_id;
  return jsonb_build_object('url',m.url,'storage_path',m.storage_path,'kind',m.kind);
end $$;
create or replace function public.lms_complete_material(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lms_can_read_material(p_id) then raise exception 'Material access is required.' using errcode='42501'; end if;
  insert into public.material_progress(student_id,material_id) values(public.lms_student_id(),p_id) on conflict do nothing;
end $$;
create or replace function public.lms_book_mock(p_slot uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sl public.mock_interview_slots; sid uuid := public.lms_student_id(); bid uuid;
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  -- Serialize this student's bookings and then this slot's capacity check.
  perform 1 from public.students where id=sid for update;
  select * into sl from public.mock_interview_slots where id=p_slot for update;
  if not found or not public.lms_has_enrollment(sl.batch_id) or sl.status not in ('open','full') or sl.starts_at<=now()
    or sl.booking_deadline<=now() then raise exception 'This slot is unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.batch_students e where e.student_id=sid and e.batch_id=sl.batch_id and e.starts_at<=sl.starts_at and (e.expires_at is null or e.expires_at>=sl.ends_at))
    then raise exception 'Your enrollment does not cover this interview time.' using errcode='42501'; end if;
  if exists(select 1 from public.mock_interview_bookings b join public.mock_interview_slots x on x.id=b.slot_id
    where b.student_id=sid and b.status='booked' and x.status not in ('cancelled','completed') and x.starts_at<sl.ends_at and x.ends_at>sl.starts_at)
    then raise exception 'You already have an interview at this time.'; end if;
  if (select count(*) from public.mock_interview_bookings where slot_id=p_slot and status in ('booked','completed','no_show')) >= sl.capacity
    then raise exception 'This slot is full. Choose another time.'; end if;
  insert into public.mock_interview_bookings(slot_id,student_id) values(p_slot,sid)
    on conflict(slot_id,student_id) do update set status='booked',feedback=null,score=null,internal_notes=null returning id into bid;
  return bid;
end $$;
create or replace function public.lms_cancel_mock(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.mock_interview_bookings; sl public.mock_interview_slots;
begin
  select * into b from public.mock_interview_bookings where id=p_booking and student_id=public.lms_student_id();
  if not found then raise exception 'Your booking was not found.' using errcode='42501'; end if;
  select * into sl from public.mock_interview_slots where id=b.slot_id for update;
  if sl.starts_at<=now() or b.status<>'booked' then raise exception 'This booking can no longer be cancelled.'; end if;
  update public.mock_interview_bookings set status='cancelled' where id=b.id and status='booked';
end $$;

-- A CSV is a single transaction: no partial enrollment if one row is invalid.
create or replace function public.lms_import_students(p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare r jsonb; total integer := 0;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Student rows are required.'; end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Import 1 to 1000 students at a time.'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into public.students(full_name,email,phone) values(trim(r->>'full_name'),lower(trim(r->>'email')),nullif(trim(r->>'phone'),''));
    total:=total+1;
  end loop;
  return total;
end $$;
create or replace function public.lms_invite_admin(p_name text,p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; em text:=lower(trim(p_email));
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null or em !~ '^[^[:space:]@]+@lihatech\.com$' then raise exception 'A name and LihaTech email are required.'; end if;
  if exists(select 1 from public.admin_profiles where lower(email)=em) or exists(select 1 from public.students where lower(email)=em)
    then raise exception 'This email already belongs to a registered account.'; end if;
  update public.staff_invitations set status='revoked' where lower(email)=em and status='pending';
  insert into public.staff_invitations(email,full_name,role,invited_by_firebase_uid) values(em,trim(p_name),'admin',auth.jwt()->>'sub') returning id into rid;
  return rid;
end $$;
create policy admins_manage_invitations on public.staff_invitations for all to anon,authenticated
  using(public.has_admin_access()) with check(public.has_admin_access() and role='admin');
grant select,update on public.staff_invitations to anon,authenticated;

create or replace function public.lms_audit_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid; payload jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  select id into actor from public.admin_profiles where firebase_uid=auth.jwt()->>'sub';
  insert into public.admin_activity_log(actor_id,action,entity_type,entity_id,description,metadata)
    values(actor,lower(tg_op),tg_table_name,nullif(payload->>'id','')::uuid,tg_table_name || ' ' || lower(tg_op),
      jsonb_build_object('firebase_uid',auth.jwt()->>'sub','batch_id',payload->>'batch_id','student_id',payload->>'student_id','material_id',payload->>'material_id'));
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
do $$ declare t text; begin
  foreach t in array array['students','batches','batch_students','batch_courses','courses','learning_materials','batch_materials','mock_interview_slots','mock_interview_bookings','staff_invitations','admin_profiles','student_course_access'] loop
    execute format('create trigger lms_audit after insert or update or delete on public.%I for each row execute function public.lms_audit_change()',t);
  end loop;
end $$;
create trigger material_updated before update on public.learning_materials for each row execute function public.set_updated_at();
create or replace function public.lms_reset_student_identity() returns trigger
language plpgsql as $$
begin
  if lower(trim(new.email)) <> lower(trim(old.email)) then new.firebase_uid:=null; new.auth_user_id:=null; end if;
  return new;
end $$;
create trigger reset_student_identity before update of email on public.students for each row execute function public.lms_reset_student_identity();
create or replace function public.lms_enforce_mock_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare capacity integer;
begin
  select sl.capacity into capacity from public.mock_interview_slots sl where sl.id=new.slot_id for update;
  if new.status in ('booked','completed','no_show') and
    (select count(*) from public.mock_interview_bookings b where b.slot_id=new.slot_id and b.id<>new.id and b.status in ('booked','completed','no_show')) >= capacity
    then raise exception 'Interview capacity would be exceeded.'; end if;
  return new;
end $$;
create trigger enforce_mock_capacity before insert or update on public.mock_interview_bookings for each row execute function public.lms_enforce_mock_capacity();
create or replace function public.lms_enforce_slot_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.capacity < (select count(*) from public.mock_interview_bookings where slot_id=new.id and status in ('booked','completed','no_show'))
    then raise exception 'Capacity cannot be below the number of reserved bookings.'; end if;
  return new;
end $$;
create trigger enforce_slot_capacity before update of capacity on public.mock_interview_slots for each row execute function public.lms_enforce_slot_capacity();
create or replace function public.lms_protect_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Serialize role changes so concurrent deactivations cannot remove every admin.
  perform pg_advisory_xact_lock(61014001);
  if old.is_active and old.role in ('admin','owner') and (tg_op='DELETE' or not new.is_active or new.role not in ('admin','owner'))
    and not exists(select 1 from public.admin_profiles where id<>old.id and is_active and role in ('admin','owner'))
    then raise exception 'At least one active admin must remain.'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger protect_last_admin before update or delete on public.admin_profiles for each row execute function public.lms_protect_last_admin();

insert into storage.buckets(id,name,public,file_size_limit) values('lms-materials','lms-materials',false,4194304) on conflict(id) do nothing;
create policy lms_files_admin on storage.objects for all to anon,authenticated
  using(bucket_id='lms-materials' and public.has_admin_access()) with check(bucket_id='lms-materials' and public.has_admin_access());
-- Students cannot mint storage URLs that outlive enrollment. The API checks each download.
create or replace function public.lms_private_file(p_uid text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare old_claims text := current_setting('request.jwt.claims',true); material jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_uid,'email_verified',true,
    'iss','https://securetoken.google.com/lihatech-document-studio','aud','lihatech-document-studio')::text,true);
  material := public.lms_open_material(p_id);
  if material->>'kind' <> 'file' then raise exception 'This is not an uploaded file.'; end if;
  perform set_config('request.jwt.claims',coalesce(old_claims,'{}'),true);
  return material;
end $$;
revoke all on function public.lms_private_file(text,uuid) from public,anon,authenticated;
grant execute on function public.lms_private_file(text,uuid) to service_role;

-- SECURITY DEFINER routines must never inherit PUBLIC execute privileges.
do $$ declare sig text; begin
  foreach sig in array array['lms_verified_user()','lms_student_id()','lms_has_enrollment(uuid)','lms_can_read_material(uuid)','lms_session()','lms_student_home()','lms_open_material(uuid)','lms_complete_material(uuid)','lms_book_mock(uuid)','lms_cancel_mock(uuid)','lms_import_students(jsonb)','lms_invite_admin(text,text)'] loop
    execute 'revoke all on function public.' || sig || ' from public';
    execute 'grant execute on function public.' || sig || ' to anon,authenticated';
  end loop;
end $$;
create index batch_students_student_idx on public.batch_students(student_id);
create index batch_materials_material_idx on public.batch_materials(material_id);
create index mock_bookings_student_idx on public.mock_interview_bookings(student_id);
