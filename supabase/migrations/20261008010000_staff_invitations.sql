create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'instructor')),
  invited_by_firebase_uid text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_firebase_uid text
);

create unique index staff_invitations_one_pending_per_email
  on public.staff_invitations (lower(email))
  where status = 'pending';

create unique index admin_profiles_email_lower_idx
  on public.admin_profiles (lower(email))
  where email is not null and trim(email) <> '';

alter table public.staff_invitations enable row level security;
revoke all on public.staff_invitations from public, anon, authenticated;
grant all on public.staff_invitations to service_role;

create or replace function public.provision_staff_from_invitation(
  p_firebase_uid text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile public.admin_profiles%rowtype;
  invitation public.staff_invitations%rowtype;
  new_profile public.admin_profiles%rowtype;
begin
  if coalesce(trim(p_firebase_uid), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Firebase UID and verified email are required';
  end if;

  select * into existing_profile
  from public.admin_profiles
  where firebase_uid = p_firebase_uid
  limit 1;

  if found then
    if existing_profile.is_active and lower(existing_profile.email) = lower(p_email) then
      return jsonb_build_object(
        'firebase_uid', existing_profile.firebase_uid,
        'email', existing_profile.email,
        'role', existing_profile.role,
        'is_active', existing_profile.is_active
      );
    end if;
    raise exception 'This Firebase account already has an inactive or mismatched staff profile';
  end if;

  select * into invitation
  from public.staff_invitations
  where lower(email) = lower(p_email)
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'No unexpired staff invitation exists for this Google email';
  end if;

  if exists (
    select 1 from public.admin_profiles
    where lower(email) = lower(p_email)
  ) then
    raise exception 'A staff profile already exists for this email';
  end if;

  insert into public.admin_profiles (firebase_uid, email, full_name, role, is_active)
  values (p_firebase_uid, lower(p_email), invitation.full_name, invitation.role, true)
  returning * into new_profile;

  update public.staff_invitations
  set status = 'accepted', accepted_at = now(), accepted_firebase_uid = p_firebase_uid
  where id = invitation.id;

  return jsonb_build_object(
    'firebase_uid', new_profile.firebase_uid,
    'email', new_profile.email,
    'role', new_profile.role,
    'is_active', new_profile.is_active
  );
end;
$$;

revoke all on function public.provision_staff_from_invitation(text, text) from public, anon, authenticated;
grant execute on function public.provision_staff_from_invitation(text, text) to service_role;
