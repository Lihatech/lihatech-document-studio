alter table public.admin_profiles
  drop constraint if exists admin_profiles_id_fkey,
  alter column id set default gen_random_uuid(),
  add column if not exists firebase_uid text,
  add column if not exists email text;

create unique index if not exists admin_profiles_firebase_uid_idx
  on public.admin_profiles(firebase_uid)
  where firebase_uid is not null;

drop function if exists public.bootstrap_first_admin(text);

create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where firebase_uid = auth.jwt() ->> 'sub'
      and auth.jwt() ->> 'iss' = 'https://securetoken.google.com/lihatech-document-studio'
      and auth.jwt() ->> 'aud' = 'lihatech-document-studio'
      and is_active = true
      and role in ('owner', 'admin', 'instructor', 'staff')
  );
$$;

create or replace function public.has_admin_management_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where firebase_uid = auth.jwt() ->> 'sub'
      and auth.jwt() ->> 'iss' = 'https://securetoken.google.com/lihatech-document-studio'
      and auth.jwt() ->> 'aud' = 'lihatech-document-studio'
      and is_active = true
      and role in ('owner', 'admin')
  );
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'students', 'batches', 'courses', 'course_modules', 'lessons',
    'batch_courses', 'batch_students', 'student_course_access', 'live_lectures',
    'mock_interview_slots', 'mock_interview_bookings', 'certificate_requests',
    'document_records', 'company_settings', 'admin_activity_log'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'admin_full_access_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (public.has_admin_access()) with check (public.has_admin_access())',
      'admin_full_access_' || table_name,
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', table_name);
  end loop;
end;
$$;

drop policy if exists admin_full_access_admin_profiles on public.admin_profiles;
drop policy if exists admin_profiles_read on public.admin_profiles;
drop policy if exists admin_profiles_insert on public.admin_profiles;
drop policy if exists admin_profiles_update on public.admin_profiles;
drop policy if exists admin_profiles_delete on public.admin_profiles;

create policy admin_profiles_read on public.admin_profiles
for select to anon, authenticated using (public.has_admin_access());
create policy admin_profiles_insert on public.admin_profiles
for insert to anon, authenticated with check (public.has_admin_management_access());
create policy admin_profiles_update on public.admin_profiles
for update to anon, authenticated using (public.has_admin_management_access()) with check (public.has_admin_management_access());
create policy admin_profiles_delete on public.admin_profiles
for delete to anon, authenticated using (public.has_admin_management_access());
grant select, insert, update, delete on public.admin_profiles to anon, authenticated;

drop policy if exists "admins can read document assets" on storage.objects;
drop policy if exists "admins can upload document assets" on storage.objects;
drop policy if exists "admins can update document assets" on storage.objects;
drop policy if exists "admins can delete document assets" on storage.objects;

create policy "admins can read document assets"
on storage.objects for select to anon, authenticated
using (bucket_id = 'document-assets' and public.has_admin_access());

create policy "admins can upload document assets"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'document-assets' and public.has_admin_access());

create policy "admins can update document assets"
on storage.objects for update to anon, authenticated
using (bucket_id = 'document-assets' and public.has_admin_access())
with check (bucket_id = 'document-assets' and public.has_admin_access());

create policy "admins can delete document assets"
on storage.objects for delete to anon, authenticated
using (bucket_id = 'document-assets' and public.has_admin_access());
