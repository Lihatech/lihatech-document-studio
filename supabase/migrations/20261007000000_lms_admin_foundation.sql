create extension if not exists pgcrypto;

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'admin', 'instructor', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
    where id = auth.uid()
      and is_active = true
      and role in ('owner', 'admin', 'instructor', 'staff')
  );
$$;

create or replace function public.bootstrap_first_admin(p_full_name text default '')
returns public.admin_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.admin_profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if exists (select 1 from public.admin_profiles) then
    raise exception 'An admin profile already exists';
  end if;

  insert into public.admin_profiles (id, full_name, role)
  values (auth.uid(), coalesce(nullif(trim(p_full_name), ''), coalesce(auth.jwt() ->> 'email', 'Admin')), 'owner')
  returning * into profile;

  return profile;
end;
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  college_name text,
  department text,
  enrollment_id text,
  status text not null default 'active' check (status in ('active', 'suspended', 'completed', 'archived')),
  internal_notes text,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed', 'cancelled')),
  notes text,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  course_type text not null default 'course',
  duration text,
  mode text not null default 'online' check (mode in ('online', 'offline', 'hybrid')),
  description text,
  syllabus_url text,
  project_instructions_url text,
  is_published boolean not null default false,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  notes_url text,
  project_instructions_url text,
  position integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.batch_courses (
  batch_id uuid not null references public.batches(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (batch_id, course_id)
);

create table public.batch_students (
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (batch_id, student_id)
);

create table public.student_course_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  starts_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired', 'revoked')),
  restriction_reason text,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table public.live_lectures (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  instructor_id uuid references public.admin_profiles(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meet_url text,
  notes_url text,
  recording_url text,
  status text not null default 'scheduled' check (status in ('scheduled', 'rescheduled', 'cancelled', 'completed')),
  notes text,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mock_interview_slots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  mentor_id uuid references public.admin_profiles(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  status text not null default 'open' check (status in ('open', 'full', 'cancelled', 'completed')),
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mock_interview_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.mock_interview_slots(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed', 'no_show')),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, student_id)
);

create table public.certificate_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  certificate_type text not null,
  status text not null default 'pending' check (status in ('pending', 'needs_correction', 'approved', 'rejected', 'generated', 'issued', 'revoked')),
  eligibility_notes text,
  certificate_details jsonb not null default '{}'::jsonb,
  rejection_reason text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  issued_at timestamptz,
  revoked_at timestamptz,
  reviewed_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_records (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('invoice', 'certificate', 'letter', 'payslip')),
  external_id text,
  template_key text,
  status text not null default 'active' check (status in ('draft', 'active', 'issued', 'revoked', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_settings (
  id boolean primary key default true check (id = true),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.admin_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.admin_profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_profiles', 'students', 'batches', 'courses', 'course_modules', 'lessons',
    'student_course_access', 'live_lectures', 'mock_interview_slots',
    'mock_interview_bookings', 'certificate_requests', 'document_records', 'company_settings'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end;
$$;

create index students_status_idx on public.students(status);
create index batches_status_idx on public.batches(status);
create index courses_published_idx on public.courses(is_published);
create index lessons_module_position_idx on public.lessons(module_id, position);
create index lectures_starts_at_idx on public.live_lectures(starts_at);
create index mock_slots_starts_at_idx on public.mock_interview_slots(starts_at);
create index certificate_requests_status_idx on public.certificate_requests(status);
create index document_records_type_idx on public.document_records(document_type);
create index activity_log_created_at_idx on public.admin_activity_log(created_at desc);

alter table public.admin_profiles enable row level security;
alter table public.students enable row level security;
alter table public.batches enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.batch_courses enable row level security;
alter table public.batch_students enable row level security;
alter table public.student_course_access enable row level security;
alter table public.live_lectures enable row level security;
alter table public.mock_interview_slots enable row level security;
alter table public.mock_interview_bookings enable row level security;
alter table public.certificate_requests enable row level security;
alter table public.document_records enable row level security;
alter table public.company_settings enable row level security;
alter table public.admin_activity_log enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_profiles', 'students', 'batches', 'courses', 'course_modules', 'lessons',
    'batch_courses', 'batch_students', 'student_course_access', 'live_lectures',
    'mock_interview_slots', 'mock_interview_bookings', 'certificate_requests',
    'document_records', 'company_settings', 'admin_activity_log'
  ] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access())', 'admin_full_access_' || table_name, table_name);
  end loop;
end;
$$;

grant execute on function public.bootstrap_first_admin(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('document-assets', 'document-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy "admins can read document assets"
on storage.objects for select to authenticated
using (bucket_id = 'document-assets' and public.has_admin_access());

create policy "admins can upload document assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'document-assets' and public.has_admin_access());

create policy "admins can update document assets"
on storage.objects for update to authenticated
using (bucket_id = 'document-assets' and public.has_admin_access())
with check (bucket_id = 'document-assets' and public.has_admin_access());

create policy "admins can delete document assets"
on storage.objects for delete to authenticated
using (bucket_id = 'document-assets' and public.has_admin_access());
