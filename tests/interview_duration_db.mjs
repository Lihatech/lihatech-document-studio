// Optional isolated PostgreSQL check: set PGLITE_MODULE to an external PGlite installation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create table public.students(id uuid primary key default gen_random_uuid(),firebase_uid text,status text);
    create table public.mock_interview_slots(
      id uuid primary key default gen_random_uuid(),batch_id uuid,mentor_name text,
      starts_at timestamptz,ends_at timestamptz,capacity integer,status text,booking_deadline timestamptz);
    create table public.mock_interview_bookings(
      id uuid primary key default gen_random_uuid(),slot_id uuid,student_id uuid,status text,prepared_topics text,
      feedback text,score integer,internal_notes text,meeting_url text,calendar_event_id text,calendar_error text,
      reschedule_starts_at timestamptz,reschedule_ends_at timestamptz,updated_at timestamptz default now(),
      unique(slot_id,student_id));
    insert into public.students(firebase_uid,status) values('duration-student','active');
    select set_config('request.jwt.claim.role','service_role',false);
  `);
  await db.exec(await readFile('supabase/migrations/20261104000000_per_request_interview_duration.sql','utf8'));
  // Applying twice is safe for users who have already run the migration.
  await db.exec(await readFile('supabase/migrations/20261104000000_per_request_interview_duration.sql','utf8'));
  const request=async time=>(await db.query(`select public.lms_request_mock_time('duration-student',
    ((current_date+2)::text||'T${time}:00+05:30')::timestamptz,9,18,'SQL joins') as id`)).rows[0].id;
  const first=await request('09:00');
  const second=await request('10:00');
  assert.equal((await db.query('select public.lms_mock_interview_duration() as minutes')).rows[0].minutes,35);
  assert.equal(Number((await db.query(`select extract(epoch from (s.ends_at-s.starts_at))/60 as minutes
    from mock_interview_slots s join mock_interview_bookings b on s.id=b.slot_id where b.id=$1`,[first])).rows[0].minutes),35);
  await db.query('select public.lms_admin_set_mock_duration($1,50,false)',[first]);
  await assert.rejects(db.query('select public.lms_admin_set_mock_duration($1,65,false)',[first]),/overlaps/);
  await db.query('select public.lms_admin_set_mock_duration($1,35,false)',[first]);
  const boundary=await request('10:35');
  assert.ok(boundary);
  await assert.rejects(request('10:30'),/unavailable/);
  await db.query("update mock_interview_bookings set status='booked' where id=$1",[second]);
  await assert.rejects(db.query('select public.lms_admin_set_mock_duration($1,45,false)',[second]),/pending/);
  await db.query("update mock_interview_bookings set reschedule_starts_at=((current_date+2)::text||'T12:00:00+05:30')::timestamptz where id=$1",[second]);
  await db.query('select public.lms_admin_set_mock_duration($1,45,true)',[second]);
  await db.exec("select set_config('request.jwt.claim.role','authenticated',false);");
  await assert.rejects(db.query('select public.lms_admin_set_mock_duration($1,35,false)',[first]),/Server access/);
  console.log('SQL duration checks: migration/reapply, 35-minute default, edit, conflicts, exact-end booking, proposal and role guard passed.');
} finally { await db.close(); }
