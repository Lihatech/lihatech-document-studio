-- Students request completion certificates using only identity and internship role.
-- Existing offer requests and issued documents retain their review/download flow.
begin;
create or replace function public.lms_request_document(p_request jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid:=public.lms_student_id(); s public.students; b public.batches; rid uuid;
  certificate_kind text; requested_role text; identity jsonb;
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
  -- Do not rewrite or clear phone, address, education, or employment details.
  update public.students set full_name=btrim(s.full_name),salutation=s.salutation,updated_at=now()
    where id=sid returning * into s;
  insert into public.student_document_requests(student_id,batch_id,kind,candidate_name,program_name,certificate_type,
    designation,start_date,end_date,details,profile_snapshot)
  values(sid,b.id,'certificate',concat_ws(' ',nullif(s.salutation,''),s.full_name),b.course_name,certificate_kind,
    requested_role,b.start_date,b.end_date,'',
    jsonb_build_object('salutation',s.salutation,'full_name',s.full_name,'email',s.email,
      'phone',s.phone,'college_name',s.college_name,'department',s.department,'address',s.address)) returning id into rid;
  return rid;
end $$;
notify pgrst,'reload schema';
commit;
