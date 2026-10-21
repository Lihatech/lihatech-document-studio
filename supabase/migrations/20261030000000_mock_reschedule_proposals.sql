alter table public.mock_interview_bookings
  add column if not exists reschedule_starts_at timestamptz,
  add column if not exists reschedule_ends_at timestamptz,
  add column if not exists reschedule_prepared_topics text;
