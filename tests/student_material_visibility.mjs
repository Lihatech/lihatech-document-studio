// Real portal/notification components with isolated data; no accounts or live writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const services=`
export const displayDate=value=>value;export const batchDateLabel=value=>value;export const batchEndInstant=value=>new Date(value+'T18:30:00Z');
export const lmsApi=async()=>({});export const openMaterial=async()=>{throw Error('Hidden material must not open');};
export async function rpc(name){
 if(name==='lms_student_home')return {student:{full_name:'Test Student',email:'student@example.invalid',status:'active',profile_completed_at:'2026-01-01'},server_time:new Date().toISOString(),enrollments:[{batch_id:'a',name:'Batch A',status:'active',batch_status:'active',starts_at:'2026-01-01',batch_end_date:'2099-01-01',accessible:true}],materials:[{id:'m',batch_id:'a',title:'Hidden workbook',accessible:true}],bookings:[]};
 if(name==='lms_notifications')return {items:['materials','documents','mocks'].map(category=>({id:category,category,title:category+' update',body:'Fixture',created_at:new Date().toISOString(),read_at:null})),counts:{materials:1,documents:1,mocks:1}};
 return [];
}`;
const source=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import StudentPortal from './src/pages/student/StudentPortal';import Bell,{NotificationProvider} from './src/components/lms/StudentNotifications';
function Fixture(){const [path,setPath]=useState('/student'),[admin,setAdmin]=useState(false);return <><button onClick={()=>setPath('/student/learning')}>Open old material link</button><button onClick={()=>setAdmin(true)}>Inspect admin notices</button><output>{path}</output><NotificationProvider key={admin?'admin':'student'} role={admin?'admin':'student'}>{admin?<Bell navigate={()=>{}}/>:<StudentPortal path={path} navigate={setPath} onLogout={()=>{}}/>}</NotificationProvider></>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;
console.log('Bundling student visibility fixture…');
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',format:'esm',jsx:'automatic',define:{'import.meta.env':'{}'},plugins:[{name:'isolated-data',setup(builder){
 builder.onLoad({filter:/src[\\/]lib[\\/]lms\.ts$/},()=>({contents:services,loader:'js'}));
 builder.onLoad({filter:/src[\\/]components[\\/]lms[\\/](StudentDocumentRequests|StudentProfileForm|PdfMaterialPreview|MockCalendar)\.tsx$/},()=>({contents:'export default function FixtureChild(){return null;}',loader:'js'}));
}}]});
const files=new Map(bundle.outputFiles.map(file=>['/'+basename(file.path),file.contents]));
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':req.url.endsWith('.css')?'text/css':'text/html');res.end(files.get(req.url)||'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'});
try{
 console.log('Checking portal and notifications…');
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'Welcome, Test.'}).waitFor();
 assert.equal(await page.getByText('My learning',{exact:true}).count(),0);
 assert.equal(await page.locator('.student-home-materials').count(),0);
 assert.equal(await page.getByText('Study materials',{exact:true}).count(),0);
 assert.equal(await page.getByText('Hidden workbook',{exact:true}).count(),0);
 await page.getByRole('button',{name:/Your documents/}).waitFor();
 await page.getByLabel('Notifications, 2 unread',{exact:true}).click();
 assert.equal(await page.getByText('materials update',{exact:true}).count(),0);
 await page.getByText('documents update',{exact:true}).waitFor();await page.getByText('mocks update',{exact:true}).waitFor();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Open old material link'}).evaluate(button=>button.click());
 await page.waitForFunction(()=>document.querySelector('output').textContent==='/student');
 assert.equal(await page.getByRole('button',{name:'Open material',exact:true}).count(),0);
 await page.setViewportSize({width:375,height:812});
 assert.equal(await page.locator('.student-mobile-nav a').count(),4);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Inspect admin notices'}).evaluate(button=>button.click());await page.getByLabel('Notifications, 3 unread',{exact:true}).click();await page.getByText('materials update',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Student materials hidden, legacy route redirected, four-item mobile navigation fits, student notices filtered and admin notices retained.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
