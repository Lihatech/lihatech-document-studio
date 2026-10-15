-- The batch end date is inclusive in Sri Lanka time. Individual expiry can shorten it.
create or replace function public.lms_has_enrollment(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
    where e.student_id=public.lms_student_id() and e.batch_id=p_batch and e.status='active' and e.left_at is null
    and e.starts_at <= now() and (e.expires_at is null or now() < e.expires_at)
    and (b.end_date is null or now() < (b.end_date + 1)::timestamp at time zone 'Asia/Colombo')
    and b.status in ('active','completed'));
$$;

create or replace function public.lms_student_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.students; result jsonb;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  result := jsonb_build_object('student',jsonb_build_object('id',s.id,'full_name',s.full_name,'email',s.email,'status',s.status), 'server_time',now());
  result := result || jsonb_build_object('enrollments',coalesce((select jsonb_agg(jsonb_build_object(
    'batch_id',b.id,'name',b.name,'code',b.code,'batch_status',b.status,'batch_end_date',b.end_date,
    'status',e.status,'starts_at',e.starts_at,'individual_expires_at',e.expires_at,
    'expires_at',case when b.end_date is null then e.expires_at when e.expires_at is null then (b.end_date + 1)::timestamp at time zone 'Asia/Colombo'
      else least(e.expires_at,(b.end_date + 1)::timestamp at time zone 'Asia/Colombo') end,'left_at',e.left_at,
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
      from public.mock_interview_slots sl join public.batches b on b.id=sl.batch_id
      where public.lms_has_enrollment(sl.batch_id) and sl.status in ('open','full') and sl.starts_at>now()
      and (b.end_date is null or sl.ends_at <= (b.end_date + 1)::timestamp at time zone 'Asia/Colombo')
      and (sl.booking_deadline is null or sl.booking_deadline>now())
      and exists(select 1 from public.batch_students e where e.student_id=s.id and e.batch_id=sl.batch_id and e.starts_at<=sl.starts_at and (e.expires_at is null or e.expires_at>=sl.ends_at))), '[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',bk.id,'slot_id',sl.id,'batch_id',sl.batch_id,'status',bk.status,'feedback',bk.feedback,'score',bk.score,
      'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,'slot_status',sl.status,
      'meeting_url',case when public.lms_has_enrollment(sl.batch_id) and bk.status='booked' and sl.ends_at>now() and sl.status not in ('cancelled','completed') then sl.meeting_url else null end))
      from public.mock_interview_bookings bk join public.mock_interview_slots sl on sl.id=bk.slot_id where bk.student_id=s.id), '[]'::jsonb));
end $$;

create or replace function public.lms_book_mock(p_slot uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sl public.mock_interview_slots; sid uuid := public.lms_student_id(); bid uuid;
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  perform 1 from public.students where id=sid for update;
  select * into sl from public.mock_interview_slots where id=p_slot for update;
  if not found or not public.lms_has_enrollment(sl.batch_id) or sl.status not in ('open','full') or sl.starts_at<=now()
    or sl.booking_deadline<=now() then raise exception 'This slot is unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.batch_students e join public.batches b on b.id=e.batch_id
    where e.student_id=sid and e.batch_id=sl.batch_id and e.starts_at<=sl.starts_at and (e.expires_at is null or e.expires_at>=sl.ends_at)
    and (b.end_date is null or sl.ends_at <= (b.end_date + 1)::timestamp at time zone 'Asia/Colombo'))
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
