// Real editor and admin UI; isolated API/PDF mocks never access accounts or send mail.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const worker=await readFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
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
  b.onLoad({filter:/src[\\/]lib[\\/]lmsApi\.ts$/},()=>({contents:`export async function lmsFetch(path,init){const r=await fetch(path,init);if(!r.ok)throw Error('Test API failed');return r;}export async function lmsRequest(path,init){return (await lmsFetch(path,init)).json();}`,loader:'js'}));
  b.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'test-pdf-worker',namespace:'test-worker'}));
  b.onLoad({filter:/.*/,namespace:'test-worker'},()=>({contents:`export default '/pdf-worker.mjs'`,loader:'js'}));
  b.onLoad({filter:/src[\\/]utils[\\/]certificateExport\.ts$/},()=>({contents:`import{jsPDF}from'jspdf';export async function captureCertificate(){return {}};export async function createCertificatePdf(){const pdf=new jsPDF({orientation:'landscape'});pdf.setFillColor(225,240,250);pdf.rect(0,0,297,210,'F');return {pdfBlob:pdf.output('blob')}}`,loader:'js'}));
}}]});
const row={id:'00000000-0000-4000-8000-000000000001',full_name:'Example Applicant',course_name:'Python course',certificate_type:'Course Completion',designation:'',requested_start_date:'2026-01-01',requested_end_date:'2026-06-30',status:'pending',admin_note:'',email_status:'not_sent',created_at:'2026-10-29T08:00:00Z',document:null,certificate_applicants:{email:'applicant@example.com',student_code:'LT-CERT-STU-100072'}};
let approval,pdfReads=0;
const server=createServer(async(req,res)=>{
  if(req.url==='/pdf-worker.mjs'){res.setHeader('Content-Type','application/javascript');res.end(worker);return;}
  if(req.url==='/admin/certificate-applications'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify([row]));return;}
  if(req.url?.endsWith('/approve')){let body='';for await(const chunk of req)body+=chunk;approval=JSON.parse(body);row.status='approved';row.email_status='sent';res.setHeader('Content-Type','application/json');res.end(JSON.stringify({approved:true,email_sent:true}));return;}
  if(req.url?.endsWith('/pdf')){pdfReads++;res.setHeader('Content-Type','application/pdf');res.end(Buffer.from(approval.pdf_base64,'base64'));return;}
  const asset=bundle.outputFiles.find(file=>file.path.replace(/\\/g,'/').endsWith(req.url));
  if(asset){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(asset.contents);return;}
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;background:#f4f8fb;margin:0;padding:24px;color:#12364b}main{max-width:1100px;margin:auto}*{box-sizing:border-box}</style><main id="root"></main><script type="module" src="/app.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const installedChrome='C:/Users/LENOVO/AppData/Local/Google/Chrome/Application/chrome.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync(installedChrome)?installedChrome:'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe')});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
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
 assert.equal(await page.getByRole('button',{name:/^Approved/}).getAttribute('aria-pressed'),'true');await page.getByText('Certificate emailed',{exact:true}).waitFor();
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Preview certificate',exact:true}).click();
 const preview=page.getByRole('dialog',{name:'Approved certificate PDF'});try{await preview.getByRole('img',{name:'Page 1 of PDF',exact:true}).waitFor();}catch(e){console.error('PDF preview errors:',errors,'Dialog:',await preview.innerText());throw e;}
 await page.waitForFunction(()=>document.querySelector('.public-certificate-pdf canvas')?.style.width);
 const desktopSize=await preview.boundingBox();assert.ok(desktopSize.height>=900*.9);assert.ok(desktopSize.width>=1280*.9);
 const canvasSize=await preview.locator('canvas').boundingBox();const containerSize=await preview.locator('.public-certificate-pdf-pages').boundingBox();
 assert.ok(canvasSize.width>containerSize.width*.9,'Certificate must fill the preview width instead of rendering as a thumbnail');
 await page.screenshot({path:'C:/Windows/Temp/lihatech-admin-certificate-preview.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});assert.equal(await preview.evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),true);
 const downloadEvent=page.waitForEvent('download');await preview.getByRole('button',{name:'Download PDF',exact:true}).click();const download=await downloadEvent;
 assert.equal(download.suggestedFilename(),'LihaTech-Certificate-LT-CERT-STU-100072.pdf');
 const parts=[];for await(const chunk of await download.createReadStream())parts.push(chunk);
 assert.deepEqual(Buffer.concat(parts),Buffer.from(approval.pdf_base64,'base64'));
 await preview.getByRole('button',{name:'Close certificate preview'}).click();
 const cardDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();await cardDownload;
 assert.equal(pdfReads,2);
 assert.deepEqual(errors,[]);console.log('Public admin: ID approval, cards/filters, real PDF rendering at full preview width, desktop/mobile sizing and original PDF download passed. API/capture mocked; no email sent.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
