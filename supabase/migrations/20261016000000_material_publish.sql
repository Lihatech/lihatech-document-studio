-- Create or update a material and its batch release in one transaction.
create or replace function public.lms_publish_material(
  p_material jsonb, p_batch uuid, p_available_from timestamptz, p_expires_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_material_id uuid; current_material public.learning_materials;
begin
  if not public.has_admin_access() then raise exception 'Admin access is required.' using errcode='42501'; end if;
  if p_material is null or p_batch is null or p_available_from is null then raise exception 'Material, batch and release time are required.'; end if;
  if p_expires_at is not null and p_expires_at <= p_available_from then raise exception 'Expiry must be after release time.'; end if;

  if nullif(p_material->>'id','') is null then
    insert into public.learning_materials(title,description,module_name,position,course_id,kind,url,status)
    values(trim(p_material->>'title'),coalesce(trim(p_material->>'description'),''),coalesce(trim(p_material->>'module_name'),''),
      coalesce((p_material->>'position')::integer,0),nullif(p_material->>'course_id','')::uuid,'link',trim(p_material->>'url'),'published')
    returning id into v_material_id;
  else
    v_material_id := (p_material->>'id')::uuid;
    select * into current_material from public.learning_materials where id=v_material_id for update;
    if not found then raise exception 'Material not found.'; end if;
    update public.learning_materials set
      title=coalesce(nullif(trim(p_material->>'title'),''),current_material.title),
      description=case when p_material ? 'description' then coalesce(trim(p_material->>'description'),'') else current_material.description end,
      module_name=case when p_material ? 'module_name' then coalesce(trim(p_material->>'module_name'),'') else current_material.module_name end,
      position=coalesce((p_material->>'position')::integer,current_material.position),
      course_id=case when p_material ? 'course_id' then nullif(p_material->>'course_id','')::uuid else current_material.course_id end,
      url=case when current_material.kind='link' then coalesce(nullif(trim(p_material->>'url'),''),current_material.url) else current_material.url end,
      status='published'
    where id=v_material_id;
  end if;

  insert into public.batch_materials(batch_id,material_id,available_from,expires_at)
  values(p_batch,v_material_id,p_available_from,p_expires_at)
  on conflict(batch_id,material_id) do update set available_from=excluded.available_from,expires_at=excluded.expires_at;
  return v_material_id;
end $$;
revoke all on function public.lms_publish_material(jsonb,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.lms_publish_material(jsonb,uuid,timestamptz,timestamptz) to anon,authenticated;
