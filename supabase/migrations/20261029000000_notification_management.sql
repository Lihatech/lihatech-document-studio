begin;
alter table public.portal_notifications add column resolved_at timestamptz,add column dismissed_at timestamptz;

-- Decisions belong in history for every admin, even if they have not opened the bell.
create function public.lms_resolve_activity_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare heading text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if TG_TABLE_NAME='mock_interview_bookings' then
    heading:=case new.status when 'booked' then 'Interview accepted' when 'rejected' then 'Interview declined'
      when 'cancelled' then 'Interview cancelled' when 'completed' then 'Interview completed' when 'no_show' then 'Interview marked missed' else null end;
  else
    heading:=case new.status when 'fulfilled' then 'Document approved and sent' when 'declined' then 'Document request declined' else null end;
  end if;
  if heading is not null then
    update public.portal_notifications set resolved_at=coalesce(resolved_at,now()),read_at=coalesce(read_at,now()),title=heading
      where admin_id is not null and resolved_at is null and source_id=new.id
      and (new.status<>'cancelled' or title<>'Interview cancelled')
      and category=case when TG_TABLE_NAME='mock_interview_bookings' then 'mocks' else 'documents' end;
  end if;
  return new;
end $$;
revoke all on function public.lms_resolve_activity_notifications() from public,anon,authenticated;
create trigger resolve_interview_notifications after update on public.mock_interview_bookings for each row execute function public.lms_resolve_activity_notifications();
create trigger resolve_document_notifications after update on public.student_document_requests for each row execute function public.lms_resolve_activity_notifications();
update public.portal_notifications n set resolved_at=now(),read_at=coalesce(n.read_at,now()),title=case b.status
  when 'booked' then 'Interview accepted' when 'rejected' then 'Interview declined' when 'cancelled' then 'Interview cancelled'
  when 'completed' then 'Interview completed' else 'Interview marked missed' end
  from public.mock_interview_bookings b where n.admin_id is not null and n.category='mocks' and n.source_id=b.id and b.status not in ('requested','approving');
update public.portal_notifications n set resolved_at=now(),read_at=coalesce(n.read_at,now()),title=case r.status
  when 'fulfilled' then 'Document approved and sent' else 'Document request declined' end
  from public.student_document_requests r where n.admin_id is not null and n.category='documents' and n.source_id=r.id and r.status in ('fulfilled','declined');

create or replace function public.lms_notifications() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  if not public.has_admin_access() and public.lms_student_id() is null then
    return jsonb_build_object('items','[]'::jsonb,'counts','{}'::jsonb); end if;
  return jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'category',n.category,'title',n.title,'body',n.body,
      'created_at',n.available_at,'read_at',n.read_at,'resolved_at',n.resolved_at)
      order by (n.read_at is null and n.resolved_at is null) desc,n.available_at desc,n.id)
      from (select * from public.portal_notifications x where x.dismissed_at is null and public.lms_notification_visible(x)
        order by (x.read_at is null and x.resolved_at is null) desc,x.available_at desc,x.id limit 100) n),'[]'::jsonb),
    'counts',coalesce((select jsonb_object_agg(c.category,c.total) from (
      select n.category,count(*) total from public.portal_notifications n
      where n.read_at is null and n.resolved_at is null and n.dismissed_at is null and public.lms_notification_visible(n) group by n.category) c),'{}'::jsonb));
end $$;

create function public.lms_clear_notifications(p_id uuid default null,p_read_only boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  update public.portal_notifications n set dismissed_at=now(),read_at=coalesce(n.read_at,now())
    where n.dismissed_at is null and public.lms_notification_visible(n)
    and (p_id is null or n.id=p_id) and (not p_read_only or n.read_at is not null or n.resolved_at is not null);
end $$;
revoke all on function public.lms_clear_notifications(uuid,boolean) from public;
grant execute on function public.lms_clear_notifications(uuid,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
