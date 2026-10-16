import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const result=await build({stdin:{contents:`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {batchState,assignableBatch,currentEnrollment} from './src/lib/batches';
  import StudentDocumentRequests from './src/components/lms/StudentDocumentRequests';
  export {batchState,assignableBatch,currentEnrollment};
  export const html=renderToStaticMarkup(<StudentDocumentRequests
    student={{full_name:'Official Student',email:'student@example.invalid'}}
    enrollment={{name:'October batch',course_name:'AI Programme',batch_start_date:'2026-10-01',batch_end_date:'2026-10-31',certificate_type:'Course Completion',status:'active'}}/>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},
plugins:[{name:'no-auth-or-network',setup(build){build.onLoad({filter:/src[\\/]lib[\\/](supabase|firebase)\.ts$/},()=>({contents:'export const supabase=null; export const auth=null;'}));}}]});
const module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {batchState,assignableBatch,currentEnrollment,html}=module.exports;
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
assert.match(html,/Suggested corrections/);
assert.doesNotMatch(html,/type="date"|autoComplete="name"|name="candidate_name"/,'Official details are presented for review, not as editable document fields');
console.log('Batch boundaries, closed dropdown exclusions, single-batch selection and read-only request details passed.');
