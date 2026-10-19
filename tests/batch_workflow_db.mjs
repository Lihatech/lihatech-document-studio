// Optional isolated PostgreSQL runtime; install PGlite outside the application.
// PGLITE_MODULE may point to that installation's dist/index.js.
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    grant usage on schema public,auth,storage to anon,authenticated;`);
  for(const file of (await readdir('supabase/migrations')).filter(file=>file.endsWith('.sql')).sort()) {
    if(file.startsWith('202610210')) {
      await db.exec(`insert into public.students(full_name,email,firebase_uid) values('Migration student','migration-student@example.invalid','migration-student');
        insert into public.batches(name,code,start_date,end_date,status) values
        ('Existing current','MIGRATE-CURRENT',current_date-7,current_date+30,'active'),
        ('Existing future','MIGRATE-FUTURE',current_date+7,current_date+60,'planned');
        insert into public.batch_students(student_id,batch_id) select s.id,b.id from public.students s cross join public.batches b where s.firebase_uid='migration-student' and b.code like 'MIGRATE-%';`);
    }
    // gen_random_uuid is built into modern PostgreSQL; no pgcrypto functions are used.
    const sql=(await readFile(`supabase/migrations/${file}`,'utf8')).replace('create extension if not exists pgcrypto;','');
    try { await db.exec(sql); } catch(error) { throw new Error(`${file}: ${error.message}`); }
  }
  const cleaned=(await db.query(`select b.code,e.status,e.left_at from public.batch_students e join public.students s on s.id=e.student_id join public.batches b on b.id=e.batch_id where s.firebase_uid='migration-student' order by b.code`)).rows;
  if(cleaned.length!==2||cleaned[0].status!=='active'||cleaned[1].status!=='revoked'||!cleaned[1].left_at) throw new Error('Migration did not preserve and retire legacy multiple memberships');
  for(const file of ['student_document_requests.sql','batch_document_workflow.sql','student_personal_document_details.sql','published_student_documents.sql','single_step_document_approval.sql','batch_student_management.sql']) {
    try { await db.exec(await readFile(`supabase/tests/${file}`,'utf8')); }
    catch(error) { throw new Error(`${file}: ${error.message}`); }
  }
  console.log('All migrations and batch/document SQL behavior checks passed in isolated PostgreSQL.');
} finally { await db.close(); }
