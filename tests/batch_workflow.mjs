import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const result=await build({stdin:{contents:`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {batchState,assignableBatch,currentEnrollment} from './src/lib/batches';
  import StudentDocumentRequests from './src/components/lms/StudentDocumentRequests';
  import BatchDetails from './src/components/lms/BatchDetails';
  export {batchState,assignableBatch,currentEnrollment};
  const props={initialTab:'overview',batch:{id:'old',name:'Existing batch',code:'OLD',status:'active',start_date:'2026-10-10',end_date:'2026-10-20'},data:{},busy:false,onClose:()=>{},onEdit:()=>{},onEnrollment:()=>{},onRemoveStudent:()=>{},onMaterial:()=>{},onRemoveMaterial:()=>{}};
  export const legacyBatchHtml=renderToStaticMarkup(<BatchDetails {...props}/>);
  export const readyBatchHtml=renderToStaticMarkup(<BatchDetails {...props} batch={{...props.batch,course_name:'Official Programme',certificate_type:'Course Completion'}}/>);
  export const html=renderToStaticMarkup(<StudentDocumentRequests
    student={{full_name:'Official Student',email:'student@example.invalid'}}
    enrollment={{name:'October batch',course_name:'AI Programme',batch_start_date:'2026-10-01',batch_end_date:'2026-10-31',certificate_type:'Course Completion',status:'active'}}/>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',loader:{'.css':'empty','.png':'dataurl'},define:{'import.meta.env':'{}'},
plugins:[{name:'no-auth-or-network',setup(build){build.onLoad({filter:/src[\\/]lib[\\/](supabase|firebase)\.ts$/},()=>({contents:'export const supabase=null; export const auth=null;'}));}}]});
const module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {batchState,assignableBatch,currentEnrollment,html,legacyBatchHtml,readyBatchHtml}=module.exports;
const originalNow=Date.now;
try {
  Date.now=()=>Date.parse('2026-10-16T00:00:00+05:30');
  const batch={status:'planned',start_date:'2026-10-16',end_date:'2026-10-16'};
  assert.equal(batchState(batch),'active','A scheduled batch opens automatically at midnight IST');
  assert.equal(batchState({...batch,start_date:'2026-10-17',end_date:'2026-10-18'}),'planned');
  assert.equal(assignableBatch({...batch,status:'completed'}),false);
  assert.equal(assignableBatch({...batch,status:'paused'}),false);
  Date.now=()=>Date.parse('2026-10-17T00:00:00+05:30');
  assert.equal(batchState(batch),'completed','Access closes after the inclusive end date');
  assert.equal(assignableBatch(batch),false,'Expired batches are excluded from assignment dropdowns');
  const current={batch_id:'current',status:'active',starts_at:'2026-10-01',left_at:null};
  assert.equal(currentEnrollment([{batch_id:'old',status:'revoked',starts_at:'2026-01-01',left_at:'2026-02-01'},current]).batch_id,'current');
} finally { Date.now=originalNow; }
assert.match(html,/Official Student/);
assert.match(html,/AI Programme/);
assert.match(html,/Name on your certificate/);
assert.doesNotMatch(html,/Live document preview|Draft|Open larger preview/,'Students request first and receive only the approved document');
assert.equal((html.match(/type="date"/g)||[]).length,2,'Students may propose a start and end date for admin review');
assert.match(html,/Official batch course and dates/);
assert.match(html,/does not change your learning access/);
assert.match(html,/autoComplete="name"/,'Personal details can be corrected before submitting');
assert.match(html,/Course completion/);
assert.match(html,/Internship completion/);
assert.doesNotMatch(html,/Phone number|Address|College or institution|What best describes you\?|Offer letter/,'Request form asks only for document identity and completion details');
assert.match(legacyBatchHtml,/Edit batch settings/,'Legacy batches expose a clear settings action');
assert.match(legacyBatchHtml,/Add the course name and batch dates/,'Missing course setup is explained');
assert.match(legacyBatchHtml,/10 Oct 2026/,'Existing batch dates are retained in the overview');
assert.match(readyBatchHtml,/Certificate requests are configured/,'Configured batches show document readiness');
assert.match(readyBatchHtml,/Official Programme/);
console.log('Batch boundaries, single-batch selection, editable personal details, and protected programme fields passed.');
