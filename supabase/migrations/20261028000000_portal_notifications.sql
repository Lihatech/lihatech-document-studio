-- Account-scoped in-app updates. No email/push delivery or public notification reads.
begin;
create table public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  admin_id uuid references public.admin_profiles(id) on delete cascade,
  category text not null check(category in ('materials','documents','mocks')),
  title text not null,
  body text not null default '',
  source_id uuid not null,
  batch_id uuid references public.batches(id) on delete cascade,
  event_key text not null,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check ((student_id is null) <> (admin_id is null))
);
create unique index portal_notifications_student_event on public.portal_notifications(student_id,event_key) where student_id is not null;
create unique index portal_notifications_admin_event on public.portal_notifications(admin_id,event_key) where admin_id is not null;
create index portal_notifications_student_unread on public.portal_notifications(student_id,read_at,available_at);
create index portal_notifications_admin_unread on public.portal_notifications(admin_id,read_at,available_at);
alter table public.portal_notifications enable row level security;
revoke all on public.portal_notifications from public,anon,authenticated;

create function public.lms_notification_visible(n public.portal_notifications) returns boolean
language sql stable security definer set search_path=public as $$
  select public.lms_verified_user() and n.available_at<=now() and (
    (n.admin_id is not null and public.has_admin_access() and exists(
      select 1 from public.admin_profiles a where a.id=n.admin_id and a.firebase_uid=auth.jwt()->>'sub'))
    or (n.student_id=public.lms_student_id() and (n.category<>'materials' or (
      public.lms_has_enrollment(n.batch_id) and public.lms_can_read_material(n.source_id)
      and exists(select 1 from public.batch_materials bm where bm.batch_id=n.batch_id and bm.material_id=n.source_id
        and bm.available_from<=now() and (bm.expires_at is null or bm.expires_at>now()))))))
$$;
revoke all on function public.lms_notification_visible(public.portal_notifications) from public,anon,authenticated;

create function public.lms_notifications() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  if not public.has_admin_access() and public.lms_student_id() is null then
    return jsonb_build_object('items','[]'::jsonb,'counts','{}'::jsonb); end if;
  return jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'category',n.category,'title',n.title,'body',n.body,
      'created_at',n.available_at,'read_at',n.read_at) order by n.available_at desc,n.id)
      from (select * from public.portal_notifications x where public.lms_notification_visible(x)
        order by x.available_at desc,x.id limit 100) n),'[]'::jsonb),
    'counts',coalesce((select jsonb_object_agg(c.category,c.total) from (
      select n.category,count(*) total from public.portal_notifications n
      where n.read_at is null and public.lms_notification_visible(n) group by n.category) c),'{}'::jsonb));
end $$;
create function public.lms_read_notifications(p_id uuid default null,p_category text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  if p_category is not null and p_category not in ('materials','documents','mocks') then raise exception 'Invalid category.'; end if;
  update public.portal_notifications n set read_at=now()
    where n.read_at is null and public.lms_notification_visible(n)
    and (p_id is null or n.id=p_id) and (p_category is null or n.category=p_category);
end $$;
revoke all on function public.lms_notifications() from public;
revoke all on function public.lms_read_notifications(uuid,text) from public;
grant execute on function public.lms_notifications() to anon,authenticated;
grant execute on function public.lms_read_notifications(uuid,text) to anon,authenticated;

create function public.lms_notify_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare cat text; heading text; detail text; sid uuid; source uuid:=new.id; key text;
begin
  if TG_TABLE_NAME='student_document_requests' then
    cat:='documents'; sid:=new.student_id;
    if TG_OP='INSERT' then
      heading:='New document request';
      detail:=new.candidate_name||' requested '||case when new.kind='certificate' then 'a certificate.' else 'an offer letter.' end;
    elsif new.status is distinct from old.status and new.status in ('fulfilled','declined') then
      heading:=case when new.status='fulfilled' then 'Your document is ready' else 'Document request declined' end;
      detail:=case when new.status='fulfilled' then 'Preview and download your approved PDF in Documents.' else coalesce(nullif(new.admin_note,''),'Open Documents to review the update.') end;
    else return new; end if;
  elsif TG_TABLE_NAME='mock_interview_bookings' then
    cat:='mocks'; sid:=new.student_id;
    if TG_OP='UPDATE' and new.status is not distinct from old.status then return new; end if;
    if TG_OP='UPDATE' and old.status='approving' and new.status='requested' then return new; end if;
    if new.status='approving' then return new; end if;
    select to_char(s.starts_at at time zone 'Asia/Kolkata','DD Mon YYYY, HH24:MI')||' IST' into detail
      from public.mock_interview_slots s where s.id=new.slot_id;
    heading:=case new.status when 'requested' then 'New mock interview request' when 'booked' then 'Interview confirmed'
      when 'rejected' then 'Interview request declined' when 'cancelled' then 'Interview cancelled'
      when 'completed' then 'Interview feedback available' when 'no_show' then 'Interview marked missed' else null end;
    if heading is null then return new; end if;
    if new.status='requested' then
      select coalesce(nullif(s.full_name,''),s.email)||' · '||detail into detail from public.students s where s.id=sid;
    end if;
  else
    cat:='materials'; heading:='Learning material uploaded'; detail:=new.title; sid:=null;
  end if;
  key:=TG_TABLE_NAME||':'||new.id||':'||gen_random_uuid();
  if TG_TABLE_NAME='learning_materials' or (TG_TABLE_NAME='student_document_requests' and TG_OP='INSERT')
     or (TG_TABLE_NAME='mock_interview_bookings' and new.status='requested') then
    insert into public.portal_notifications(admin_id,category,title,body,source_id,event_key)
      select a.id,cat,heading,detail,source,key from public.admin_profiles a
      where a.is_active and a.role in ('owner','admin');
  else
    insert into public.portal_notifications(student_id,category,title,body,source_id,event_key)
      values(sid,cat,heading,detail,source,key);
    if TG_TABLE_NAME='mock_interview_bookings' and new.status='cancelled' then
      insert into public.portal_notifications(admin_id,category,title,body,source_id,event_key)
        select a.id,cat,heading,detail,source,key from public.admin_profiles a
        where a.is_active and a.role in ('owner','admin');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.lms_notify_activity() from public,anon,authenticated;
create trigger notify_document_activity after insert or update on public.student_document_requests
  for each row execute function public.lms_notify_activity();
create trigger notify_interview_activity after insert or update on public.mock_interview_bookings
  for each row execute function public.lms_notify_activity();
create trigger notify_material_upload after insert on public.learning_materials
  for each row execute function public.lms_notify_activity();

-- Fan out only batch-published materials, not private uploads. Re-publishing is idempotent.
create function public.lms_notify_batch_materials() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.portal_notifications(student_id,category,title,body,source_id,batch_id,event_key,available_at)
    select e.student_id,'materials','New learning material',m.title||' · '||b.name,m.id,b.id,
      'material:'||b.id||':'||m.id,greatest(bm.available_from,b.start_date::timestamp at time zone 'Asia/Kolkata')
    from public.batch_materials bm join public.learning_materials m on m.id=bm.material_id
      join public.batches b on b.id=bm.batch_id join public.batch_students e on e.batch_id=b.id
      join public.students s on s.id=e.student_id
    where m.status='published' and e.status='active' and e.left_at is null and s.status='active'
      and b.status in ('active','planned') and b.end_date>=(now() at time zone 'Asia/Kolkata')::date
      and ((TG_TABLE_NAME='batch_materials' and bm.batch_id=(to_jsonb(new)->>'batch_id')::uuid and bm.material_id=(to_jsonb(new)->>'material_id')::uuid)
        or (TG_TABLE_NAME='batch_students' and e.batch_id=(to_jsonb(new)->>'batch_id')::uuid and e.student_id=(to_jsonb(new)->>'student_id')::uuid))
    on conflict(student_id,event_key) where student_id is not null
      do update set available_at=excluded.available_at,body=excluded.body;
  return new;
end $$;
revoke all on function public.lms_notify_batch_materials() from public,anon,authenticated;
create trigger notify_batch_publication after insert or update on public.batch_materials
  for each row execute function public.lms_notify_batch_materials();
create trigger notify_enrolled_materials after insert or update on public.batch_students
  for each row execute function public.lms_notify_batch_materials();

-- Existing pending work should also have a badge when the notification feature launches.
insert into public.portal_notifications(admin_id,category,title,body,source_id,event_key)
  select a.id,'documents','New document request',r.candidate_name||' requested a document.',r.id,'initial-document:'||r.id
  from public.admin_profiles a cross join public.student_document_requests r
  where a.is_active and a.role in ('owner','admin') and r.status in ('pending','approved');
insert into public.portal_notifications(admin_id,category,title,body,source_id,event_key)
  select a.id,'mocks','New mock interview request',s.full_name||' · '||to_char(sl.starts_at at time zone 'Asia/Kolkata','DD Mon YYYY, HH24:MI')||' IST',r.id,'initial-mock:'||r.id
  from public.admin_profiles a cross join public.mock_interview_bookings r
    join public.students s on s.id=r.student_id join public.mock_interview_slots sl on sl.id=r.slot_id
  where a.is_active and a.role in ('owner','admin') and r.status in ('requested','approving') and sl.starts_at>now();
notify pgrst,'reload schema';
commit;
