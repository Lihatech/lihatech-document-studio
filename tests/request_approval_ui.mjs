// Isolated browser fixture: no credentials, login, or live requests.
import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const mock=`
export const batchDateLabel=v=>v||'Not set';
const base={candidate_name:'Ms. Review Student',program_name:'Web Development',certificate_type:'Course Completion',offer_type:null,designation:'Developer Intern',department:'Engineering',start_date:'2026-10-01',end_date:'2026-10-31',details:'Please check my name.',status:'pending',admin_note:'',created_at:'2026-10-17T10:00:00Z',updated_at:'2026-10-17T10:00:00Z',student_email:'review@example.invalid',batch_name:'October batch',studio_version:null};
const requests=[{...base,id:'certificate-request',kind:'certificate'},{...base,id:'offer-request',kind:'offer_letter',offer_type:'Internship Offer'}];
const documents={};
export async function rpc(name,args={}) {
 window.__calls=window.__calls||[];window.__calls.push(name);
 if(name==='lms_admin_document_requests'||name==='lms_student_document_requests')return structuredClone(requests);
 if(name==='lms_approve_document_request'){
  window.__lastApproval=structuredClone(args);
  if(window.__failApproval)throw Error('Approval failed for test. Nothing issued.');
  const row=requests.find(r=>r.id===args.p_id);Object.assign(row,{status:'fulfilled',published_at:new Date().toISOString(),admin_note:args.p_note});
  documents[row.id]={document:args.p_document,kind:row.kind,draft:false,settings:{name:'LihaTech',directorName:'Review Director',certTemplate:'royal'}};
  return {request:structuredClone(row),record:{kind:row.kind==='certificate'?'certificate':'letter',record_id:args.p_document.id,data:args.p_document,version:1,archived:false}};
 }
 if(name==='lms_request_document_content')return structuredClone(documents[args.p_id]);
 if(name==='lms_request_document'){window.__studentRequest=args;return 'new-request';}
 if(name==='lms_review_document_request'){Object.assign(requests.find(r=>r.id===args.p_id),{status:'declined',admin_note:args.p_note});return;}
 return [];
}
`;
const contents=`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import DocumentRequestsAdmin from './src/pages/admin/DocumentRequestsAdmin';
import StudentDocumentRequests from './src/components/lms/StudentDocumentRequests';
import CertificateBuilder from './src/pages/CertificateBuilder';import LetterBuilder from './src/pages/LetterBuilder';
import {normalizeSettings} from './src/utils/storage';
const settings=normalizeSettings({name:'LihaTech',certTemplate:'royal',directorName:'Review Director',letterDefaults:{'Internship Offer':{noStipend:true}}});
function Fixture(){const[tab,setTab]=useState('admin'),[cache,setCache]=useState(null);const noop=()=>{};
return <><nav><button onClick={()=>setTab('admin')}>Admin requests</button><button onClick={()=>setTab('other')}>Other tab</button><button onClick={()=>setTab('student')}>Student requests</button></nav>
{tab==='admin'?<DocumentRequestsAdmin cachedRequests={cache} onRequestsChange={setCache} onIssued={noop} renderReview={(request,saved,approve)=>request.kind==='certificate'?<CertificateBuilder key={request.id} reviewMode settings={settings} courses={[]} existingCertificates={[]} requestDraft={request} editingCertificate={saved} onSaveCertificate={approve} onSaveCourse={async()=>true} onAddCertificateOption={async(k,name)=>name} onBack={noop} navigate={noop}/>:<LetterBuilder key={request.id} reviewMode settings={settings} requestDraft={request} editingLetter={saved} onSaveLetter={approve} onBack={noop} navigate={noop}/>}/>:tab==='student'?<StudentDocumentRequests student={{full_name:'Review Student',salutation:'Ms.',email:'review@example.invalid',profile_type:'student',college_name:'Review college',department:'Engineering',college_location:'Pune',phone:'1234567890',address:'Review address'}} enrollment={{name:'October batch',course_name:'Web Development',certificate_type:'Course Completion',batch_start_date:'2026-10-01',batch_end_date:'2026-10-31',status:'active'}}/>:<p>Another tab</p>}</>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;
await build({stdin:{contents,loader:'tsx',resolveDir:process.cwd()},bundle:true,format:'esm',outfile:'request-review.js',loader:{'.png':'dataurl','.svg':'dataurl'},define:{'import.meta.env':'{}'},plugins:[{name:'mock-lms',setup(b){b.onLoad({filter:/src[\\/]lib[\\/]lms\.ts$/},()=>({contents:mock,loader:'js'}));}}]});
await writeFile('request-review.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/request-review.css"><style>body{font-family:Inter,system-ui,sans-serif;margin:0;padding:24px;background:#f4f7fb}nav{display:flex;gap:12px;margin-bottom:24px}</style></head><body><div id="root"></div><script type="module" src="/request-review.js"></script></body></html>');
console.log('Isolated request-review fixture created.');
