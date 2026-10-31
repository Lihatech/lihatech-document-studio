-- Keep deletions atomic, and enforce admin access even for direct RPC calls.
create function public.lms_admin_delete_batch(p_batch uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from public.batches where id=p_batch for update;
  if not found then raise exception 'Batch not found'; end if;
  delete from public.batch_materials where batch_id=p_batch;
  -- Interviews are independent of batch membership; preserve bookings and calendar events.
  update public.mock_interview_slots set batch_id=null where batch_id=p_batch;
  delete from public.batches where id=p_batch;
end $$;
revoke all on function public.lms_admin_delete_batch(uuid) from public;
grant execute on function public.lms_admin_delete_batch(uuid) to anon,authenticated;

create function public.lms_admin_delete_material(p_material uuid) returns text
language plpgsql security definer set search_path=public as $$
declare material public.learning_materials;
begin
  if not public.has_admin_access() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into material from public.learning_materials where id=p_material for update;
  if not found then raise exception 'Document not found'; end if;
  delete from public.batch_materials where material_id=p_material;
  delete from public.material_progress where material_id=p_material;
  delete from public.portal_notifications where category='materials' and source_id=p_material;
  delete from public.learning_materials where id=p_material;
  -- Storage files must be removed through the Storage API, after the transaction succeeds.
  if material.kind='file' and not exists(select 1 from public.learning_materials where storage_path=material.storage_path) then
    return material.storage_path;
  end if;
  return null;
end $$;
revoke all on function public.lms_admin_delete_material(uuid) from public;
grant execute on function public.lms_admin_delete_material(uuid) to anon,authenticated;
notify pgrst,'reload schema';
