// Isolated browser checks. No login, credentials or live data are used.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const mock=`
const db={students:[{id:'s1',email:'student@example.invalid',full_name:'Review Student',salutation:'Ms.',profile_completed_at:'2026-10-01',student_code:'LT-STU-100001',status:'active'}],batches:[{id:'a',name:'Batch A',code:'A',course_name:'Web Development',start_date:'2026-10-01',end_date:'2099-01-31',status:'active'},{id:'b',name:'Batch B',code:'B',course_name:'Web Development',start_date:'2026-10-01',end_date:'2099-01-31',status:'active'}],batch_students:[{student_id:'s1',batch_id:'a',status:'active',starts_at:'2026-10-01',left_at:null}],learning_materials:[1,2,3].map(i=>({id:'m'+i,title:'Document '+i,kind:'file',status:'published'})),batch_materials:[1,2,3].map(i=>({batch_id:'a',material_id:'m'+i,available_from:'2026-10-01'})),mock_interview_slots:[],mock_interview_bookings:[],admin_profiles:[],staff_invitations:[]};
export const lmsTables=Object.keys(db);
export const listRows=async table=>structuredClone(db[table]||[]);
export const batchDateLabel=value=>value||'Not set';export const displayDate=value=>value||'No expiry';export const batchEndInstant=value=>value?new Date(value+'T18:30:00Z'):null;export const localDate=value=>value?value.slice(0,16):'';
export async function rpc(name,args={}){window.__calls.push({name,args:structuredClone(args)});if(name==='lms_student_document_requests'||name==='lms_admin_document_requests')return [];if(name==='lms_student_home')return {student:structuredClone(db.students[0]),server_time:new Date().toISOString(),enrollments:[{batch_id:'a',name:'Batch A',status:'active',batch_status:'active',batch_start_date:'2026-10-01',batch_end_date:'2099-01-31',starts_at:'2026-10-01',expires_at:'2099-01-31',accessible:true}],materials:[{id:'office',title:'Practice workbook',kind:'file',batch_id:'a',accessible:true}],slots:[],bookings:[]};return 'saved-id';}
export async function saveRow(table,values,keys){window.__calls.push({name:'saveRow',table,values:structuredClone(values),keys});if(keys){const row=db[table].find(row=>row.id===keys.id);Object.assign(row,values);return row;}const row={id:'new-'+db[table].length,...values};db[table].push(row);return row;}
export async function removeAssignment(table,keys){window.__calls.push({name:'removeAssignment',table,keys});db[table]=db[table].filter(row=>!Object.entries(keys).every(([key,value])=>row[key]===value));}
export const openMaterial=async()=>{if(window.__fileServiceOffline)throw Error('The learning service is temporarily unavailable. Please retry or contact admin.');return {blob:new Blob(['PK-office-document'],{type:'application/octet-stream'}),filename:'practice.docx'};};
export const lmsApi=async()=>({configured:true,interviewer_email:'interviewer@example.invalid'});
`;
const source=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import LmsAdmin from './src/pages/admin/LmsAdmin';import StudentPortal from './src/pages/student/StudentPortal';import StudentDocumentRequests from './src/components/lms/StudentDocumentRequests';import {AppDialogs} from './src/lib/dialogs';import './src/styles/documentRequests.css';
window.__calls=[];
function Fixture(){const [page,setPage]=useState('batches');return <><AppDialogs/><nav className="test-nav"><button onClick={()=>setPage('batches')}>Manage batches</button><button onClick={()=>setPage('materials')}>Manage documents</button><button onClick={()=>setPage('student')}>Student request form</button><button onClick={()=>setPage('student-materials')}>Student materials</button></nav>{page==='student'?<StudentDocumentRequests student={{email:'student@example.invalid',full_name:'Review Student',salutation:'Ms.',student_code:'LT-STU-100001'}} enrollment={{name:'Batch A',course_name:'Web Development',batch_start_date:'2026-10-01',batch_end_date:'2026-10-31',status:'active'}}/>:page==='student-materials'?<StudentPortal path='/student/learning' navigate={()=>{}} onLogout={()=>{}}/>:<LmsAdmin module={page} navigate={path=>setPage(path.includes('material')?'materials':'batches')}/>}</>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
// Opt into the retained materials feature here; student_material_visibility checks the release default.
console.log('Bundling isolated admin UI…');
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',format:'esm',jsx:'automatic',loader:{'.png':'dataurl','.svg':'dataurl'},define:{'import.meta.env':'{}'},plugins:[{name:'isolated-services',setup(builder){builder.onLoad({filter:/src[\\/]lib[\\/]studentFeatures\.ts$/},()=>({contents:'export const studentMaterialsEnabled=true;',loader:'js'}));builder.onLoad({filter:/src[\\/]lib[\\/]lms\.ts$/},()=>({contents:mock,loader:'js'}));builder.onLoad({filter:/src[\\/]components[\\/]lms[\\/]RequestDocumentPreview\.tsx$/},()=>({contents:'export const DocumentPreviewDialog=()=>null;',loader:'js'}));builder.onLoad({filter:/src[\\/]components[\\/]lms[\\/]PdfMaterialPreview\.tsx$/},()=>({contents:'export default function PdfPreview(){return null;}',loader:'js'}));builder.onLoad({filter:/src[\\/]lib[\\/]supabase\.ts$/},()=>({contents:'export const supabase={storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null})})}};',loader:'js'}));}}]});
console.log('Bundle ready. Opening browser…');
const files=new Map(bundle.outputFiles.map(file=>['/'+basename(file.path),file.contents]));
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>:root{--liha-ink:#062b4b;--liha-muted:#476579;--liha-border:#c6dce6;--liha-surface:#fff;--liha-surface-soft:#e8f3f8;--liha-blue-dark:#07547e;--liha-blue:#078edb;--liha-navy:#062b4b}*{box-sizing:border-box}body{margin:0;padding:24px;font-family:Arial,sans-serif;background:#f3f8fb}button,input,select,textarea{font:inherit}.test-nav{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}.test-nav button{padding:10px;border:1px solid #c6dce6;border-radius:8px;background:white}button{cursor:pointer}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
const server=createServer((request,response)=>{const file=files.get(request.url);response.setHeader('Content-Type',request.url.endsWith('.js')?'application/javascript':request.url.endsWith('.css')?'text/css':'text/html');response.end(file||html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const modulePath=process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1280,height:850},acceptDownloads:true});page.setDefaultTimeout(10000);const failures=[];let nativeDialogs=0;
  await page.addInitScript(()=>{window.__blobEvents=[];const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);window.__blobEvents.push({created:url,size:blob.size});return url;};URL.revokeObjectURL=url=>{window.__blobEvents.push({revoked:url});return revoke(url);};});
  page.on('pageerror',error=>failures.push(error.message));page.on('dialog',async dialog=>{nativeDialogs++;await dialog.dismiss();});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('heading',{name:'Batches & students',exact:true}).waitFor();
  await page.getByPlaceholder('Batch, name, email or student ID').fill('student@example.invalid');await page.locator('.lms-batch-card').filter({hasText:'Batch A'}).waitFor();assert.equal(await page.locator('.lms-batch-card').count(),1);await page.getByRole('heading',{name:'Student search results (1)',exact:true}).waitFor();await page.getByRole('button',{name:'Manage student',exact:true}).waitFor();await page.getByPlaceholder('Batch, name, email or student ID').fill('');
  await page.getByRole('button',{name:'Create batch',exact:true}).click();let batchDialog=page.getByRole('dialog',{name:'Create batch',exact:true});
  assert.equal(await batchDialog.locator('input,select,textarea').count(),5,'Batch setup uses course and dates without status or offer fields');
  await batchDialog.getByLabel('Batch name',{exact:true}).fill('Batch C');await batchDialog.getByLabel('Batch code',{exact:true}).fill('C');await batchDialog.getByLabel('Course / programme name',{exact:true}).fill('Web Development');await batchDialog.getByLabel('Batch start date',{exact:true}).fill('2026-10-01');await batchDialog.getByLabel('Batch end date',{exact:true}).fill('2099-01-31');await batchDialog.getByRole('button',{name:'Save changes'}).click();await batchDialog.waitFor({state:'hidden'});
  const batchCreation=await page.evaluate(()=>window.__calls.find(row=>row.name==='saveRow'&&row.table==='batches'));assert.equal(batchCreation.values.status,'active');assert.equal(batchCreation.values.document_department,undefined);
  await page.locator('.lms-batch-card').filter({hasText:'Batch A'}).getByRole('button',{name:'Manage batch & students'}).click();
  await page.getByRole('button',{name:'Edit batch settings'}).click();batchDialog=page.getByRole('dialog',{name:'Edit batch',exact:true});assert.equal(await batchDialog.locator('input,select,textarea').count(),5);await batchDialog.getByRole('button',{name:'Save changes'}).click();await batchDialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Manage student',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Manage student',exact:true});await dialog.waitFor();
  assert.equal(await dialog.locator('input,select,textarea').count(),3,'Only email, batch and access belong in the admin student editor');
  assert.equal(await dialog.getByLabel('Registered Google email').inputValue(),'student@example.invalid');
  assert.equal(await dialog.getByText('Phone').count(),0);
  await page.screenshot({path:join(tmpdir(),'lihatech-student-popup.png')});
  await dialog.getByLabel('Registered Google email').fill('corrected@example.invalid');await dialog.getByLabel('Batch',{exact:true}).selectOption('b');await dialog.getByRole('button',{name:'Save changes'}).click();
  await dialog.waitFor({state:'hidden'});
  let call=await page.evaluate(()=>window.__calls.find(row=>row.name==='lms_admin_save_student'));
  assert.deepEqual(call.args,{p_id:'s1',p_email:'corrected@example.invalid',p_batch:'b',p_access:'active'});
  await page.getByRole('button',{name:'Import CSV / Excel'}).click();dialog=page.getByRole('dialog',{name:'Import students',exact:true});
  assert.equal(await dialog.getByRole('button',{name:'Download CSV template'}).count(),1);assert.equal(await dialog.getByRole('button',{name:'Download Excel template'}).count(),1);
  await dialog.locator('input[type=file]').setInputFiles({name:'students.csv',mimeType:'text/csv',buffer:Buffer.from('Email\nfirst@example.invalid\nsecond@example.invalid\n')});
  await dialog.getByText(/2 students ready to import/).waitFor();await dialog.getByRole('button',{name:'Import students',exact:true}).click();await dialog.waitFor({state:'hidden'});
  call=await page.evaluate(()=>window.__calls.find(row=>row.name==='lms_import_students_to_batch'));assert.equal(call.args.p_rows.length,2);assert.equal(call.args.p_batch,'a');
  await page.getByRole('button',{name:'Delete student',exact:true}).click();dialog=page.getByRole('dialog',{name:'Please confirm'});await dialog.waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(nativeDialogs,0,'Deletion must use the application warning window');
  await page.getByRole('button',{name:'Manage documents',exact:true}).click();await page.getByLabel('Batch access',{exact:true}).selectOption('a');await page.getByRole('checkbox',{name:'Select all 3 documents'}).check();await page.getByRole('button',{name:'Publish selected (3)'}).click();
  dialog=page.getByRole('dialog',{name:'Publish documents to batches'});await dialog.getByRole('checkbox',{name:/Batch B/}).check();await dialog.getByRole('button',{name:'Publish 3 documents to 1 batch'}).click();await dialog.waitFor({state:'hidden'});
  call=await page.evaluate(()=>window.__calls.find(row=>row.name==='lms_publish_resources'));assert.deepEqual(call.args.p_materials,[{id:'m1'},{id:'m2'},{id:'m3'}]);assert.deepEqual(call.args.p_batches,['b']);
  await page.getByRole('button',{name:'Upload document',exact:true}).click();dialog=page.getByRole('dialog',{name:'Upload document',exact:true});
  await dialog.getByRole('button',{name:'Add link',exact:true}).click();await dialog.getByLabel('Document title',{exact:true}).fill('Resource link');await dialog.getByLabel('Google Drive or HTTPS link').fill('https://example.invalid/resource');await dialog.getByRole('checkbox',{name:/Batch A/}).check();await dialog.getByRole('checkbox',{name:/Batch B/}).check();await dialog.getByRole('button',{name:'Save document & access'}).click();await dialog.waitFor({state:'hidden'});
  call=await page.evaluate(()=>window.__calls.filter(row=>row.name==='lms_publish_resources').at(-1));assert.deepEqual(call.args.p_batches,['a','b']);
  await page.getByRole('button',{name:'Upload document',exact:true}).click();dialog=page.getByRole('dialog',{name:'Upload document',exact:true});
  await dialog.locator('input[type=file]').setInputFiles({name:'lesson.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest document')});await dialog.getByRole('checkbox',{name:/Batch A/}).check();await dialog.getByRole('button',{name:'Save document & access'}).click();await dialog.waitFor({state:'hidden'});
  call=await page.evaluate(()=>window.__calls.filter(row=>row.name==='saveRow'&&row.values.kind==='file').at(-1));assert.equal(call.values.title,'lesson.pdf');assert.match(call.values.storage_path,/lesson\.pdf$/);
  await page.getByRole('button',{name:'Student request form',exact:true}).click();await page.getByRole('button',{name:/Internship completion/}).click();await page.getByLabel(/Internship domain \/ role/).fill('Web Developer Intern');await page.getByLabel('Requested start date').fill('2026-09-25');await page.getByLabel('Requested end date').fill('2026-10-25');await page.getByRole('button',{name:'Send request',exact:true}).click();
  await page.getByText('Request sent. Admin will review and approve your certificate.').waitFor();call=await page.evaluate(()=>window.__calls.find(row=>row.name==='lms_request_document'));assert.equal(call.args.p_request.requested_start_date,'2026-09-25');assert.equal(call.args.p_request.designation,'Web Developer Intern');assert.deepEqual(Object.keys(call.args.p_request.profile).sort(),['full_name','salutation']);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(tmpdir(),'lihatech-request-mobile.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Student form must fit a phone screen');
  await page.setViewportSize({width:1280,height:850});await page.getByRole('button',{name:'Student materials',exact:true}).click();await page.getByRole('button',{name:'Open material'}).waitFor();
  await page.evaluate(()=>window.__fileServiceOffline=true);await page.getByRole('button',{name:'Open material'}).click();dialog=page.getByRole('dialog',{name:'Practice workbook'});await dialog.getByRole('button',{name:'Retry',exact:true}).waitFor();
  await page.evaluate(()=>window.__fileServiceOffline=false);await dialog.getByRole('button',{name:'Retry',exact:true}).click();await dialog.getByText('This file is ready to download.',{exact:false}).waitFor();
  // This automated Windows browser cancels even standalone HTTP downloads.
  // Capture the actual anchor action and read its Blob rather than rely on OS file saving.
  await page.evaluate(()=>document.addEventListener('click',async event=>{const link=event.target;if(link instanceof HTMLAnchorElement&&link.download&&link.href.startsWith('blob:')){event.preventDefault();window.__downloadRecord={filename:link.download,url:link.href,text:await (await fetch(link.href)).text()};}},true));
  await dialog.getByRole('button',{name:'Download file',exact:true}).click();await page.waitForFunction(()=>!!window.__downloadRecord);
  const downloaded=await page.evaluate(()=>window.__downloadRecord);assert.equal(downloaded.filename,'practice.docx');assert.equal(downloaded.text,'PK-office-document');
  await dialog.getByRole('button',{name:'Close material preview'}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(url=>window.__blobEvents.some(event=>event.revoked===url),downloaded.url);
  assert.deepEqual(failures,[]);assert.equal(nativeDialogs,0);
  console.log('Student popup, custom warning, CSV/Excel guidance, bulk batch publishing, requested dates and material retry/download passed. Screenshots: '+join(tmpdir(),'lihatech-student-popup.png')+'; '+join(tmpdir(),'lihatech-request-mobile.png'));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
