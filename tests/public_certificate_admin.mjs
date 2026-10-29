// Real editor and admin UI; isolated API/PDF mocks never access accounts or send mail.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
const source=`
import React from 'react';import{createRoot}from'react-dom/client';
import PublicCertificateApplications from './src/components/lms/PublicCertificateApplications';
import CertificateBuilder from './src/pages/CertificateBuilder';
import {normalizeSettings} from './src/utils/storage';import{AppDialogs}from'./src/lib/dialogs';
import './src/styles/documentRequests.css';
const settings=normalizeSettings({name:'LihaTech',directorName:'Director',certTemplate:'royal'});
createRoot(document.getElementById('root')).render(<><AppDialogs/><PublicCertificateApplications settings={settings} renderReview={(row,saved,approve)=><CertificateBuilder reviewMode requestDraft={row} editingCertificate={saved} settings={settings} courses={[]} existingCertificates={[]} onSaveCertificate={approve} onSaveCourse={async()=>true} onAddCertificateOption={async(_,name)=>name} onBack={()=>{}} navigate={()=>{}}/>}/></>);
`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},outfile:'app.js',bundle:true,write:false,format:'esm',minify:true,define:{'import.meta.env':'{}'},loader:{'.png':'dataurl'},plugins:[{name:'isolated-api-and-pdf',setup(b){
  b.onLoad({filter:/\.png$/},()=>({contents:`export default 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'`,loader:'js'}));
  b.onLoad({filter:/src[\\/]lib[\\/]lmsApi\.ts$/},()=>({contents:`export async function lmsRequest(path,init){const r=await fetch(path,init);if(!r.ok)throw Error('Test API failed');return r.json();}`,loader:'js'}));
  b.onLoad({filter:/src[\\/]utils[\\/]certificateExport\.ts$/},()=>({contents:`export async function captureCertificate(){return {}};export async function createCertificatePdf(){return {pdfBlob:new Blob(['%PDF-1.4 test'],{type:'application/pdf'})}}`,loader:'js'}));
}}]});
const row={id:'00000000-0000-4000-8000-000000000001',full_name:'Example Applicant',course_name:'Python course',certificate_type:'Course Completion',designation:'',requested_start_date:'2026-01-01',requested_end_date:'2026-06-30',status:'pending',admin_note:'',email_status:'not_sent',created_at:'2026-10-29T08:00:00Z',document:null,certificate_applicants:{email:'applicant@example.com',student_code:'LT-CERT-STU-100072'}};
let approval;
const server=createServer(async(req,res)=>{
  if(req.url==='/admin/certificate-applications'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify([row]));return;}
  if(req.url?.endsWith('/approve')){let body='';for await(const chunk of req)body+=chunk;approval=JSON.parse(body);row.status='approved';row.email_status='sent';res.setHeader('Content-Type','application/json');res.end(JSON.stringify({approved:true,email_sent:true}));return;}
  const asset=bundle.outputFiles.find(file=>file.path.replace(/\\/g,'/').endsWith(req.url));
  if(asset){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(asset.contents);return;}
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;background:#f4f8fb;margin:0;padding:24px;color:#12364b}main{max-width:1100px;margin:auto}*{box-sizing:border-box}</style><main id="root"></main><script type="module" src="/app.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
 const review=page.getByRole('button',{name:'Review application'});try{await review.waitFor();}catch(e){console.error('Browser errors:',errors,'Page:',await page.locator('body').innerText());throw e;}
 assert.equal(await review.evaluate(button=>getComputedStyle(button).backgroundColor),'rgb(7, 84, 126)');
 assert.ok((await review.boundingBox()).height>=44);
 await page.screenshot({path:'C:/Windows/Temp/lihatech-admin-certificate-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'C:/Windows/Temp/lihatech-admin-certificate-mobile.png',fullPage:true});
 await page.getByRole('searchbox',{name:'Search public applications'}).fill('missing');await page.getByText('No applications match these filters.').waitFor();
 await page.getByRole('searchbox',{name:'Search public applications'}).fill('100072');await review.click();
 await page.getByRole('button',{name:'Edit document details',exact:true}).click();
 const id=page.getByRole('textbox',{name:'Student ID (assigned automatically)'});
 assert.equal(await id.inputValue(),'LT-CERT-STU-100072');assert.equal(await id.getAttribute('readonly'),'');
 await page.getByRole('button',{name:'Done editing',exact:true}).click();
 await page.getByRole('button',{name:'Approve and send',exact:true}).first().click();
 await page.getByText('Approved. The certificate PDF was emailed to the applicant.',{exact:true}).waitFor();
 assert.equal(approval.document.studentId,'LT-CERT-STU-100072');assert.equal(approval.document.candidateEmail,'applicant@example.com');assert.ok(approval.pdf_base64);
 await page.getByRole('button',{name:/^Approved/}).click();await page.getByText('Certificate emailed',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Public admin: styled buttons, mobile layout, search/status filters, automatic read-only public student ID and actual editor approval passed. API/PDF mocked; no email sent.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
