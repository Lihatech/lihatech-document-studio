// Run with node --test. Set LMS_TEST_PGLITE_URL to a test-only @electric-sql/pglite module URL.
// Scheduling requires Supabase pg_cron; these tests execute the actual SQL functions/triggers.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.LMS_TEST_PGLITE_URL||'@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;grant usage on schema auth to public;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table public.admin_profiles(firebase_uid text);
insert into public.admin_profiles values('admin');
create function public.lms_verified_user() returns boolean language sql stable as $$select auth.jwt()->>'email_verified'='true'$$;
create function public.has_admin_access() returns boolean language sql stable security definer as $$select public.lms_verified_user() and exists(select 1 from public.admin_profiles where firebase_uid=auth.jwt()->>'sub')$$;
create table public.students(id uuid primary key,full_name text not null,email text unique,status text not null default 'active',firebase_uid text,updated_at timestamptz not null default now());
create table public.batches(id uuid primary key,name text not null,code text unique,status text not null default 'active',start_date date,end_date date,updated_at timestamptz not null default now());
create table public.batch_students(batch_id uuid references public.batches on delete cascade,student_id uuid references public.students on delete cascade,status text default 'active',left_at timestamptz,primary key(batch_id,student_id));
create table public.learning_materials(id uuid primary key,title text);
create table public.batch_materials(batch_id uuid references public.batches,material_id uuid references public.learning_materials,primary key(batch_id,material_id));
create table public.material_progress(student_id uuid references public.students,material_id uuid references public.learning_materials,primary key(student_id,material_id));
create table public.mock_interview_slots(id uuid primary key,batch_id uuid references public.batches on delete cascade);
create table public.mock_interview_bookings(id uuid primary key,slot_id uuid references public.mock_interview_slots on delete cascade,student_id uuid references public.students on delete cascade,feedback text);
create table public.student_document_requests(id uuid primary key,student_id uuid references public.students on delete cascade,batch_id uuid references public.batches on delete set null);
`);
const migration=await readFile(new URL('../supabase/migrations/20261109000000_batch_student_trash.sql',import.meta.url),'utf8');
try{await db.exec(migration.split('-- Cron installation:')[0]);}catch(error){throw new Error('Trash migration failed: '+error.message+'; position '+error.position+'; context '+error.where);}
after(()=>db.close());
async function one(sql,args=[]){return (await db.query(sql,args)).rows[0];}
async function user(sub){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub,email_verified:true})]);await db.exec('set role anon');}
async function failure(sql,args,pattern){await db.exec('savepoint expected_failure');await assert.rejects(()=>db.query(sql,args),pattern);await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}
async function fixture(run){
 await db.exec('begin');
 const f=Object.fromEntries(['solo','multi','paused','free','a','b','material','slot','booking','document'].map(key=>[key,randomUUID()]));
 try{
  for(const [key,status] of [['solo','active'],['multi','active'],['paused','suspended'],['free','suspended']])await db.query('insert into students(id,full_name,email,firebase_uid,status) values($1,$2,$3,$2,$4)',[f[key],key,key+'@example.test',status]);
  for(const key of ['a','b'])await db.query("insert into batches(id,name,code,start_date,end_date) values($1,$2,$2,current_date-1,current_date+30)",[f[key],key]);
  for(const [student,batch] of [['solo','a'],['multi','a'],['multi','b'],['paused','a']])await db.query('insert into batch_students(batch_id,student_id) values($1,$2)',[f[batch],f[student]]);
  await db.query("insert into learning_materials values($1,'Lesson')",[f.material]);
  await db.query('insert into batch_materials values($1,$2)',[f.a,f.material]);await db.query('insert into material_progress values($1,$2)',[f.solo,f.material]);
  await db.query('insert into mock_interview_slots values($1,$2)',[f.slot,f.a]);await db.query("insert into mock_interview_bookings values($1,$2,$3,'Useful feedback')",[f.booking,f.slot,f.solo]);
  await db.query('insert into student_document_requests values($1,$2,$3)',[f.document,f.solo,f.a]);
  await user('admin');await run(f);
 }finally{await db.exec('reset role;rollback');}
}
test('batch trash preserves relationships, blocks last-batch students, and restores prior access',()=>fixture(async f=>{
 const {result}=await one('select lms_admin_trash_batch($1,false) result',[f.a]);assert.equal(result.students_moved,0);
 await db.exec('reset role');
 assert.equal((await one('select status from students where id=$1',[f.solo])).status,'suspended');
 assert.equal((await one('select status from students where id=$1',[f.multi])).status,'active');
 assert.equal((await one('select count(*)::int n from batch_students where batch_id=$1',[f.a])).n,3);
 assert.equal((await one('select feedback from mock_interview_bookings where id=$1',[f.booking])).feedback,'Useful feedback');
 await user('admin');await db.query('select lms_admin_restore_trash($1)',[result.trash_id]);await db.exec('reset role');
 assert.equal((await one('select status from students where id=$1',[f.solo])).status,'active');
 assert.equal((await one('select status from students where id=$1',[f.paused])).status,'suspended');
 assert.equal((await one('select status from batches where id=$1',[f.a])).status,'active');
}));
test('batch plus students trash excludes students in other batches and restores the group',()=>fixture(async f=>{
 const {result}=await one('select lms_admin_trash_batch($1,true) result',[f.a]);assert.equal(result.students_moved,2);
 await db.exec('reset role');
 assert.equal((await one('select status from students where id=$1',[f.solo])).status,'archived');
 assert.equal((await one('select trashed_at from students where id=$1',[f.multi])).trashed_at,null);
 await user('solo');assert.equal((await one('select lms_student_id() id')).id,null);
 await user('admin');await db.query('select lms_admin_restore_trash($1)',[result.trash_id]);await db.exec('reset role');
 assert.equal((await one('select status from students where id=$1',[f.solo])).status,'active');
 assert.equal((await one('select count(*)::int n from lms_trash')).n,0);
 assert.equal((await one('select count(*)::int n from student_document_requests where id=$1',[f.document])).n,1);
}));
test('bulk unassigned trash is atomic and refuses a student who has batch access',()=>fixture(async f=>{
 await failure('select lms_admin_trash_students($1,true)',[[f.free,f.multi]],/batch access/);
 await db.exec('reset role');assert.equal((await one('select count(*)::int n from lms_trash')).n,0);
 await user('admin');assert.equal((await one('select lms_admin_trash_students($1,true) n',[[f.free]])).n,1);
 const list=(await one('select lms_admin_trash() result')).result;assert.equal(list.length,1);assert.equal(list[0].kind,'student');
 await db.query('select lms_admin_restore_trash($1)',[list[0].id]);await db.exec('reset role');
 assert.equal((await one('select status from students where id=$1',[f.free])).status,'suspended');
}));
test('expired records cannot be restored and purge cleans dependent student records',()=>fixture(async f=>{
 const {result}=await one('select lms_admin_trash_batch($1,true) result',[f.a]);await db.exec('reset role');
 await db.exec("update lms_trash set expires_at=now()-interval '1 second'");
 await user('admin');await failure('select lms_admin_restore_trash($1)',[result.trash_id],/expired/);
 await db.exec('reset role');await db.exec('select lms_purge_expired_trash()');
 assert.equal((await one('select count(*)::int n from students where id=$1',[f.solo])).n,0);
 assert.equal((await one('select count(*)::int n from students where id=$1',[f.multi])).n,1);
 assert.equal((await one('select count(*)::int n from batches where id=$1',[f.a])).n,0);
 assert.equal((await one('select count(*)::int n from material_progress where student_id=$1',[f.solo])).n,0);
 assert.equal((await one('select count(*)::int n from student_document_requests where id=$1',[f.document])).n,0);
}));
test('student callers cannot list, restore, trash, or purge and cannot bypass internal helpers',()=>fixture(async f=>{
 await user('solo');
 for(const [sql,args] of [['select lms_admin_trash()',[]],['select lms_admin_trash_batch($1,true)',[f.a]],['select lms_admin_trash_students($1,false)',[[f.multi]]],['select lms_admin_restore_trash($1)',[randomUUID()]],['select lms_purge_expired_trash()',[]],['select lms_trash_student_record($1,$2)',[f.multi,randomUUID()]]])await failure(sql,args,/Admin access required|permission denied/);
}));
test('batch-only expiry retains student accounts and interview history',()=>fixture(async f=>{
 await db.query('select lms_admin_trash_batch($1,false)',[f.a]);await db.exec('reset role');
 await db.exec("update lms_trash set expires_at=now()-interval '1 second';select lms_purge_expired_trash()");
 assert.equal((await one('select status from students where id=$1',[f.solo])).status,'suspended');
 assert.equal((await one('select batch_id from mock_interview_slots where id=$1',[f.slot])).batch_id,null);
 assert.equal((await one('select feedback from mock_interview_bookings where id=$1',[f.booking])).feedback,'Useful feedback');
 assert.equal((await one('select count(*)::int n from student_document_requests where id=$1',[f.document])).n,1);
}));
test('restoring a batch does not overwrite a later admin account change',()=>fixture(async f=>{
 const {result}=await one('select lms_admin_trash_batch($1,false) result',[f.a]);await db.exec('reset role');
 await db.query("update students set updated_at=now()+interval '1 second' where id=$1",[f.solo]);
 await user('admin');await db.query('select lms_admin_restore_trash($1)',[result.trash_id]);await db.exec('reset role');
 assert.equal((await one('select status from students where id=$1',[f.solo])).status,'suspended');
}));
test('trashed rows reject reactivation and enrolment until explicitly restored',()=>fixture(async f=>{
 await db.query('select lms_admin_trash_students($1,false)',[[f.solo]]);await db.exec('reset role');
 await failure("update students set status='active' where id=$1",[f.solo],/Restore/);
 await failure('insert into batch_students(batch_id,student_id) values($1,$2)',[f.b,f.solo],/Restore/);
}));
