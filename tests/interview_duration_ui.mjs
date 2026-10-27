// Isolated calendar checks; no live bookings or invitations.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

const source = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import MockCalendar from './src/components/lms/MockCalendar';
import AdminCalendar from './src/components/lms/AdminMockCalendar';
import './src/styles/student.css';
import './src/styles/lms.css';
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
const at=(time)=>day+'T'+time+':00+05:30';
const availability={date:day,calendar_connected:true,duration_minutes:35,
 booked_periods:[{starts_at:at('14:30'),ends_at:at('15:05')}],busy_periods:[],
 hours:[{starts_at:at('14:45'),ends_at:at('15:20'),available:false,reason:'reserved'},
 {starts_at:at('15:05'),ends_at:at('15:40'),available:true}]};
window.fixtureAvailability=availability;
window.durationSaved=null;
function Fixture(){
 const [role,setRole]=useState('student'),[minutes,setMinutes]=useState(35);
 window.refreshFixture=()=>setMinutes(window.durationSaved?.duration_minutes||35);
 const starts=at('09:00'),ends=new Date(Date.parse(starts)+minutes*60000).toISOString();
 return <><nav><button onClick={()=>setRole('student')}>Student view</button><button onClick={()=>setRole('admin')}>Admin view</button></nav>
 {role==='student'?<div className="student-portal"><MockCalendar bookings={[]} busy={false} loadDay={async()=>availability}
 loadMonth={async month=>({month,calendar_connected:true,busy_days:[]})} loadTopics={async()=>({prepared_topics:''})}
 onRequest={async()=>true} onCancel={()=>{}}/></div>:
 <div className="lms-workspace"><AdminCalendar bookings={[{id:'b1',student_id:'s1',slot_id:'sl1',status:'requested',prepared_topics:'SQL joins'}]}
 slots={[{id:'sl1',starts_at:starts,ends_at:ends,status:'open'}]}
 students={[{id:'s1',full_name:'Student',email:'student@example.invalid',profile_completed_at:'2026-01-01'}]}
 busy={false} configured onRefresh={async()=>window.refreshFixture()}
 onApprove={()=>{}} onDecline={()=>{}} onApproveReschedule={()=>{}} onDeclineReschedule={()=>{}}
 onCancel={()=>{}} onReschedule={()=>{}} onDetails={()=>{}}/></div>}</>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',jsx:'automatic',write:false,outfile:'fixture.js',
 plugins:[{name:'isolated-api',setup(b){b.onLoad({filter:/src[\\/]lib[\\/]lms\.ts$/},()=>({contents:`
 export async function lmsApi(path,method,body){
 if(path.includes('/events'))return {events:[]};
 if(path.includes('/availability'))return window.fixtureAvailability;
 if(path.endsWith('/duration')){window.durationSaved=body;return body;}
 throw Error('Unexpected request '+path);
 }`,loader:'js'}));}}]});
const server=createServer((req,res)=>{
 const file=result.outputFiles.find(f=>req.url==='/'+f.path.split(/[\\/]/).at(-1));
 if(file){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');res.end(file.contents);}
 else res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try{
 await mkdir('tmp/calendar-review',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const booked=page.getByRole('region',{name:'Booked and unavailable times'});
 await booked.getByText('2:30 pm–3:05 pm',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/2:45 pm to/}).count(),0);
 await page.getByRole('button',{name:'3:05 pm to 3:40 pm, Available'}).waitFor();
 await page.screenshot({path:'tmp/calendar-review/student-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'tmp/calendar-review/student-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'3:05 pm to 3:40 pm, Available'}).click();
 await page.getByRole('dialog').waitFor();
 assert.equal(await page.getByRole('spinbutton').count(),0);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Admin view',exact:true}).click();
 await page.getByRole('button',{name:/Student.*Review/}).click();
 await page.getByLabel('Interview duration (minutes)',{exact:true}).fill('45');
 await page.getByRole('button',{name:'Save duration',exact:true}).click();
 await page.getByText(/IST · 45 minutes/).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.durationSaved),{duration_minutes:45,proposal:false});
 assert.equal(await page.getByRole('button',{name:'Save duration',exact:true}).isDisabled(),true);
 await page.screenshot({path:'tmp/calendar-review/admin-review-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.querySelector('.portal-dialog').scrollWidth<=document.querySelector('.portal-dialog').clientWidth),true);
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1100});
 await page.screenshot({path:'tmp/calendar-review/admin-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Calendar UI: exact booked ranges, available-only choices, admin duration save, mobile layout passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
