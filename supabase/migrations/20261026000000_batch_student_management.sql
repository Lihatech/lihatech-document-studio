-- Batch-centered administration, stable student identity and requested certificate dates.
begin;
create sequence public.student_code_sequence start with 100001;
alter sequence public.student_code_sequence owned by none;
alter table public.students add column student_code text not null default ('LT-STU-'||nextval('public.student_code_sequence')::text) unique;
alter sequence public.student_code_sequence owned by public.students.student_code;
grant usage on sequence public.student_code_sequence to anon,authenticated,service_role;

create function public.lms_protect_student_code() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.student_code is distinct from old.student_code then raise exception 'Student IDs cannot be changed.'; end if;
  return new;
end $$;
create trigger protect_student_code before update of student_code on public.students for each row execute function public.lms_protect_student_code();
revoke all on function public.lms_protect_student_code() from public,anon,authenticated;

alter table public.student_document_requests
  add column student_code text,
  add column requested_start_date date,
  add column requested_end_date date,
  add constraint requested_dates_order check (requested_start_date is null or requested_end_date>=requested_start_date);
update public.student_document_requests r set student_code=s.student_code from public.students s where s.id=r.student_id;
create function public.lms_snapshot_student_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  select student_code into new.student_code from public.students where id=new.student_id;
  return new;
end $$;
create trigger snapshot_student_identity before insert on public.student_document_requests for each row execute function public.lms_snapshot_student_identity();
revoke all on function public.lms_snapshot_student_identity() from public,anon,authenticated;

create function public.lms_admin_save_student(p_id uuid,p_email text,p_batch uuid,p_access text default 'active') returns void
language plpgsql security definer set search_path=public as $$
declare s public.students; email_value text:=lower(btrim(p_email));
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if email_value is null or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_batch is null
    or p_access is null or p_access not in ('active','suspended','revoked') then raise exception 'Check the email, batch and access.'; end if;
  select * into s from public.students where id=p_id for update;
  if not found then raise exception 'Student not found.'; end if;
  update public.students set email=email_value, firebase_uid=case when email is distinct from email_value then null else firebase_uid end,
    status=case when p_access='active' then 'active' else status end,updated_at=now() where id=p_id;
  if p_access='revoked' then
    update public.batch_students set status='revoked',left_at=now() where student_id=p_id and batch_id=p_batch;
    if not found then raise exception 'This student has no access to the selected batch.'; end if;
  else
    perform public.lms_assign_student_to_batch(p_id,p_batch,p_access);
  end if;
end $$;
revoke all on function public.lms_admin_save_student(uuid,text,uuid,text) from public;
grant execute on function public.lms_admin_save_student(uuid,text,uuid,text) to anon,authenticated;

create function public.lms_publish_resources(p_materials jsonb,p_batches uuid[],p_available_from timestamptz,p_expires_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare material jsonb; batch_id uuid; saved_id uuid; result jsonb:='[]'::jsonb;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_materials is null or jsonb_typeof(p_materials)<>'array' then raise exception 'Choose documents to publish.'; end if;
  if jsonb_array_length(p_materials) not between 1 and 100 or coalesce(cardinality(p_batches),0) not between 1 and 100
    or jsonb_array_length(p_materials)*cardinality(p_batches)>1000 or array_position(p_batches,null) is not null then
    raise exception 'Choose up to 100 documents and batches, with no more than 1,000 assignments at once.';
  end if;
  if p_available_from is null or (p_expires_at is not null and p_expires_at<=p_available_from) then raise exception 'Check the release time and expiry.'; end if;
  if exists(select 1 from unnest(p_batches) chosen(id) left join public.batches b on b.id=chosen.id
    where b.id is null or b.status not in ('planned','active') or b.start_date is null or b.end_date is null
      or p_available_from>=(b.end_date+1)::timestamp at time zone 'Asia/Kolkata'
      or now()>=(b.end_date+1)::timestamp at time zone 'Asia/Kolkata') then raise exception 'Choose upcoming or active batches with valid access dates.'; end if;
  for material in select value from jsonb_array_elements(p_materials) order by value->>'id' loop
    if jsonb_typeof(material)<>'object' or nullif(material->>'id','') is null then raise exception 'Choose saved documents to publish.'; end if;
    for batch_id in select distinct id from unnest(p_batches) chosen(id) order by id loop
      saved_id:=public.lms_publish_material(jsonb_build_object('id',material->>'id'),batch_id,p_available_from,p_expires_at);
    end loop;
    result:=result||jsonb_build_array(saved_id);
  end loop;
  return result;
end $$;
revoke all on function public.lms_publish_resources(jsonb,uuid[],timestamptz,timestamptz) from public;
grant execute on function public.lms_publish_resources(jsonb,uuid[],timestamptz,timestamptz) to anon,authenticated;

create or replace function public.lms_request_document(p_request jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid:=public.lms_student_id(); s public.students; b public.batches; rid uuid;
  certificate_kind text; requested_role text; identity jsonb; requested_start date; requested_end date;
begin
  if sid is null then raise exception 'Active student access is required.' using errcode='42501'; end if;
  if p_request is null or jsonb_typeof(p_request)<>'object' or p_request->>'kind' is distinct from 'certificate' then
    raise exception 'Choose course completion or internship completion.';
  end if;
  select * into s from public.students where id=sid for update;
  if s.profile_completed_at is null then raise exception 'Complete your profile first.'; end if;
  identity:=coalesce(p_request->'profile','{}'::jsonb);
  if jsonb_typeof(identity)<>'object' then raise exception 'Check your name and title.'; end if;
  if identity?'full_name' then s.full_name:=identity->>'full_name'; end if;
  if identity?'salutation' then s.salutation:=identity->>'salutation'; end if;
  if length(public.lms_normalize_name(s.full_name)) not between 1 and 120 or s.full_name is null
    or s.salutation is null or s.salutation not in ('','Mr.','Ms.','Mrs.','Mx.','Dr.') then
    raise exception 'Check your name and title.';
  end if;
  select batch.* into b from public.batch_students e join public.batches batch on batch.id=e.batch_id
    where e.student_id=sid and e.status in ('active','suspended') and e.left_at is null and batch.status<>'cancelled'
    order by batch.start_date desc nulls last limit 1;
  if not found then raise exception 'Ask admin to assign your batch first.'; end if;
  if btrim(b.course_name)='' or b.start_date is null or b.end_date is null then
    raise exception 'Ask admin to complete the batch course name and dates first.';
  end if;
  certificate_kind:=case when p_request?'certificate_type' then p_request->>'certificate_type'
    when b.certificate_type='Internship Completion' then 'Internship Completion' else 'Course Completion' end;
  if certificate_kind is null or certificate_kind not in ('Course Completion','Internship Completion') then
    raise exception 'Choose course completion or internship completion.';
  end if;
  requested_role:=case when certificate_kind='Internship Completion' then btrim(coalesce(p_request->>'designation','')) else '' end;
  if certificate_kind='Internship Completion' and length(requested_role) not between 1 and 120 then
    raise exception 'Enter your internship domain or role (up to 120 characters).';
  end if;
  if exists(select 1 from public.student_document_requests where student_id=sid and batch_id=b.id
    and kind='certificate' and status in ('pending','approved')) then
    raise exception 'You already have an open certificate request.';
  end if;
  begin
    requested_start:=coalesce(nullif(p_request->>'requested_start_date','')::date,b.start_date);
    requested_end:=coalesce(nullif(p_request->>'requested_end_date','')::date,b.end_date);
  exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Choose valid certificate dates.'; end;
  if not isfinite(requested_start) or not isfinite(requested_end) or requested_start<date '0001-01-01'
    or requested_end>date '9999-12-31' or requested_start>date '9999-12-31' or requested_end<date '0001-01-01' then
    raise exception 'Choose valid certificate dates.';
  end if;
  if requested_end<requested_start then raise exception 'Requested end date must be on or after the start date.'; end if;
  -- Do not rewrite or clear phone, address, education, or employment details.
  update public.students set full_name=btrim(s.full_name),salutation=s.salutation,updated_at=now()
    where id=sid returning * into s;
  insert into public.student_document_requests(student_id,batch_id,kind,candidate_name,program_name,certificate_type,
    designation,start_date,end_date,details,requested_start_date,requested_end_date,profile_snapshot)
  values(sid,b.id,'certificate',concat_ws(' ',nullif(s.salutation,''),s.full_name),b.course_name,certificate_kind,
    requested_role,b.start_date,b.end_date,'',requested_start,requested_end,
    jsonb_build_object('salutation',s.salutation,'full_name',s.full_name,'email',s.email,
      'phone',s.phone,'college_name',s.college_name,'department',s.department,'address',s.address)) returning id into rid;
  return rid;
end $$;

create or replace function public.lms_approve_document_request(
  p_id uuid, p_document jsonb, p_expected_updated_at timestamptz,
  p_expected_version integer default 0, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.student_document_requests; saved public.document_studio_records;
  registry_kind text; fields jsonb; result jsonb;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  -- Same lock order as registry saves and publication: document, then request.
  select d.* into saved from public.document_studio_records d join public.student_document_requests q
    on d.record_id=q.studio_record_id and d.kind=case when q.kind='certificate' then 'certificate' else 'letter' end
    where q.id=p_id and not d.archived for update of d;
  select * into r from public.student_document_requests where id=p_id for update;
  if not found or r.status not in ('pending','approved') or p_expected_updated_at is null
    or r.updated_at is distinct from p_expected_updated_at
    or coalesce(saved.version,0) is distinct from p_expected_version then
    raise exception 'This request changed. Close it and refresh before approving.' using errcode='40001';
  end if;
  if p_document is null or jsonb_typeof(p_document)<>'object'
    or length(coalesce(p_document->>'id','')) not between 1 and 200
    or (saved.record_id is not null and saved.record_id is distinct from p_document->>'id')
    or coalesce(p_document->>'issueDate','')='' or length(coalesce(p_note,''))>1000 then
    raise exception 'Check the document details before approving.';
  end if;
  perform (p_document->>'issueDate')::date;
  registry_kind:=case when r.kind='certificate' then 'certificate' else 'letter' end;
  fields:=jsonb_build_object('candidate_name',p_document->>'candidateName',
    'start_date',p_document->>'startDate','end_date',p_document->>'endDate');
  if r.kind='certificate' then
    if length(btrim(coalesce(p_document->>'certificateId','')))=0 then raise exception 'Certificate number is required.'; end if;
    fields:=fields||jsonb_build_object('program_name',p_document->>'programName','certificate_type',p_document->>'certificateType');
  else
    if p_document->>'letterType' is distinct from r.offer_type then raise exception 'The offer type must match this request.'; end if;
    if not (r.offer_type='Internship Offer' and coalesce((p_document->>'noStipend')::boolean,false))
      and btrim(coalesce(p_document->>'stipend',''))='' then raise exception 'Confirm the agreed compensation before approving.'; end if;
    fields:=fields||jsonb_build_object('designation',p_document->>'designation','department',p_document->>'department');
  end if;
  perform public.lms_admin_update_document_request(p_id,fields);
  update public.student_document_requests set status='approved' where id=p_id;
  p_document:=p_document||jsonb_build_object('requestId',p_id,'studentId',(select student_code from public.students where id=r.student_id));
  perform public.save_document_studio_records(jsonb_build_array(jsonb_build_object(
    'kind',registry_kind,'record_id',p_document->>'id','data',p_document,
    'expected_version',p_expected_version,'archived',false)));
  perform public.lms_review_document_request(p_id,'fulfilled',p_note);
  select to_jsonb(d) into result from public.document_studio_records d
    where d.kind=registry_kind and d.record_id=p_document->>'id';
  return jsonb_build_object('record',result,'request',(select value from jsonb_array_elements(public.lms_admin_document_requests()) where value->>'id'=p_id::text));
end $$;
revoke all on function public.lms_approve_document_request(uuid,jsonb,timestamptz,integer,text) from public;
grant execute on function public.lms_approve_document_request(uuid,jsonb,timestamptz,integer,text) to anon,authenticated;


create or replace function public.lms_student_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.students; result jsonb;
begin
  if not public.lms_verified_user() then raise exception 'Sign in again.' using errcode='42501'; end if;
  select * into s from public.students where firebase_uid=auth.jwt()->>'sub';
  if not found then raise exception 'Student access is not registered.' using errcode='42501'; end if;
  result := jsonb_build_object('student',jsonb_build_object('id',s.id,'student_code',s.student_code,'full_name',s.full_name,'salutation',s.salutation,'email',s.email,'status',s.status,
    'phone',s.phone,'address',s.address,'profile_type',s.profile_type,'college_name',s.college_name,
    'department',s.department,'college_location',s.college_location,'office_name',s.office_name,
    'job_title',s.job_title,'office_location',s.office_location,
    'profile_completed_at',s.profile_completed_at), 'server_time',now());
  result := result || jsonb_build_object('enrollments',coalesce((select jsonb_agg(jsonb_build_object(
    'batch_id',b.id,'name',b.name,'code',b.code,'batch_status',b.status,'batch_start_date',b.start_date,'batch_end_date',b.end_date,
    'course_name',b.course_name,'certificate_type',b.certificate_type,'offer_type',b.offer_type,'designation',b.designation,'document_department',b.document_department,
    'status',e.status,'starts_at',b.start_date::timestamp at time zone 'Asia/Kolkata','individual_expires_at',e.expires_at,
    'expires_at',case when b.end_date is null then e.expires_at when e.expires_at is null then (b.end_date + 1)::timestamp at time zone 'Asia/Kolkata'
      else least(e.expires_at,(b.end_date + 1)::timestamp at time zone 'Asia/Kolkata') end,'left_at',e.left_at,
    'accessible',public.lms_has_enrollment(b.id))) from public.batch_students e join public.batches b on b.id=e.batch_id where e.student_id=s.id),'[]'::jsonb));
  if s.status <> 'active' then return result || jsonb_build_object('materials','[]'::jsonb,'slots','[]'::jsonb,'bookings','[]'::jsonb); end if;
  return result || jsonb_build_object(
    'materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'module_name',m.module_name,'kind',m.kind,
      'batch_id',bm.batch_id,'course_id',m.course_id,'available_from',bm.available_from,'expires_at',bm.expires_at,
      'accessible',public.lms_can_read_material(m.id) and bm.available_from<=now() and (bm.expires_at is null or now()<bm.expires_at),
      'completed',exists(select 1 from public.material_progress pr where pr.student_id=s.id and pr.material_id=m.id)) order by m.title,m.id)
      from public.learning_materials m join public.batch_materials bm on bm.material_id=m.id where m.status='published' and public.lms_has_enrollment(bm.batch_id)
      and (m.course_id is null or exists(select 1 from public.batch_courses bc where bc.batch_id=bm.batch_id and bc.course_id=m.course_id))), '[]'::jsonb),
    'slots',coalesce((select jsonb_agg(jsonb_build_object('id',sl.id,'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,
      'booking_deadline',sl.booking_deadline,'remaining',1) order by sl.starts_at)
      from public.mock_interview_slots sl where sl.batch_id is null and sl.status='open' and sl.starts_at>now()
      and (sl.booking_deadline is null or sl.booking_deadline>now())
      and not exists(select 1 from public.mock_interview_bookings bk where bk.slot_id=sl.id
        and bk.status in ('requested','approving','booked','completed','no_show'))), '[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',bk.id,'slot_id',sl.id,'status',bk.status,'feedback',bk.feedback,'score',bk.score,
      'mentor_name',sl.mentor_name,'starts_at',sl.starts_at,'ends_at',sl.ends_at,'slot_status',sl.status,
      'meeting_url',case when bk.status='booked' and sl.status<>'cancelled' then coalesce(bk.meeting_url,sl.meeting_url) else null end) order by sl.starts_at desc)
      from public.mock_interview_bookings bk join public.mock_interview_slots sl on sl.id=bk.slot_id where bk.student_id=s.id), '[]'::jsonb));
end $$;
notify pgrst,'reload schema';
commit;
