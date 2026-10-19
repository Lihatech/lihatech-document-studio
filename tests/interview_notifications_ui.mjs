// Isolated student/admin UI checks; no real accounts, requests or calendar events.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
const mock=`export const displayDate=value=>value;
export async function rpc(name,args={}){
 if(name==='lms_notifications'){
  if(window.failNotifications)throw Error('Offline');
  const seen=JSON.parse(localStorage.getItem('read-'+window.testRole)||'[]');
  const categories=window.testRole==='admin'?['documents','mocks']:['materials','documents','mocks'];
  const items=categories.map(category=>({id:category,category,title:category==='mocks'?'Interview confirmed':category==='documents'?'Your document is ready':'New learning material',body:'Fixture update',created_at:new Date().toISOString(),read_at:seen.includes(category)?new Date().toISOString():null}));
  return {items,counts:Object.fromEntries(items.filter(row=>!row.read_at).map(row=>[row.category,1]))};
 }
 if(name==='lms_read_notifications'){
  const seen=JSON.parse(localStorage.getItem('read-'+window.testRole)||'[]');
  localStorage.setItem('read-'+window.testRole,JSON.stringify([...new Set([...seen,...(args.p_id?[args.p_id]:['materials','documents','mocks'])])]));
 }
}`;
const source=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import MockCalendar from './src/components/lms/MockCalendar';
import Bell,{NotificationProvider,NotificationBadge} from './src/components/lms/StudentNotifications';import './src/styles/student.css';
function Fixture(){const [bookings,setBookings]=useState([]),[role,setRole]=useState('student'),[path,setPath]=useState('/student/mocks');window.testRole=role;
 const loadDay=async day=>({date:day,calendar_connected:true,hours:[9,10].map(hour=>({starts_at:day+'T'+hour.toString().padStart(2,'0')+':00:00+05:30',ends_at:day+'T'+(hour+1).toString().padStart(2,'0')+':00:00+05:30',available:hour===9&&!bookings.length,reason:hour===10?'reserved':null}))});
 return <NotificationProvider role={role} key={role}><div className="student-portal"><header style={{display:'flex',padding:20}}><strong>LihaTech</strong><Bell navigate={setPath}/></header><nav aria-label="Test tabs">{['materials','documents','mocks'].map(category=><button key={category}>{category}<NotificationBadge path={{materials:'/student/learning',documents:'/student/documents',mocks:'/student/mocks'}[category]}/></button>)}</nav><output>{path}</output>
 <button onClick={()=>setRole(role==='student'?'admin':'student')}>Switch account role</button><button onClick={()=>setBookings(rows=>rows.map(row=>({...row,status:'booked',meeting_url:'https://meet.google.com/example'})))}>Admin confirms</button>
 <main className="page-content"><MockCalendar bookings={bookings} busy={false} loadDay={loadDay} loadMonth={async month=>({month,calendar_connected:true,busy_days:[]})} onCancel={()=>{}} onRequest={async(startsAt,topics)=>{window.lastRequest={startsAt,topics};setBookings([{id:'request',starts_at:new Date(startsAt).toISOString(),ends_at:new Date(Date.parse(startsAt)+3600000).toISOString(),status:'requested'}]);return true;}}/></main></div></NotificationProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;
console.log('Building isolated notification/calendar fixture…');
const built=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',write:false,outfile:'fixture.js',plugins:[{name:'fake-notifications',setup(build){build.onResolve({filter:/lib\/lms$/},()=>({path:'lms',namespace:'fake'}));build.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:mock,loader:'js'}));}}]});
const server=createServer((req,res)=>{const file=built.outputFiles.find(f=>req.url==='/'+f.path.split(/[\\/]/).at(-1));if(file){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');res.end(file.contents);}else res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
console.log('Browser ready; checking requests and notifications…');
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 // Select tomorrow so the upcoming card is visible irrespective of test execution time.
 await page.locator('.booking-date.today').evaluate(button=>button.nextElementSibling.click());
 await page.getByRole('button',{name:/to .*Available/i}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel(/Topics you’ve prepared/).fill('SQL joins, Java OOP');await dialog.getByRole('button',{name:'Send request'}).click();
 await dialog.waitFor({state:'hidden'});await page.getByText('Interview request sent',{exact:true}).waitFor();
 const own=page.getByRole('button',{name:/Your request · Awaiting approval/});await own.waitFor();assert.equal(await own.isDisabled(),true);assert.match(await own.getAttribute('class'),/is-requested/);
 const left=await page.locator('.booking-left-column').boundingBox(),upcoming=await page.locator('.booking-upcoming').boundingBox(),month=await page.locator('.booking-date-panel').boundingBox();assert.equal(left.x,upcoming.x);assert.ok(upcoming.y>=month.y+month.height);
 assert.equal(await page.locator('.booking-interview').count(),1,'UTC/IST representations must not duplicate a request');
 await page.screenshot({path:join(tmpdir(),'lihatech-interview-pending.png')});
 await page.getByRole('button',{name:'Dismiss request confirmation'}).click();assert.equal(await own.isVisible(),true,'Dismissing success must not remove the reserved slot');
 await page.getByRole('button',{name:'Admin confirms',exact:true}).click();const confirmed=page.getByRole('button',{name:/Your interview · Confirmed/});await confirmed.waitFor();assert.match(await confirmed.getAttribute('class'),/is-confirmed/);await page.getByRole('link',{name:'Join Meet'}).waitFor();
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(tmpdir(),'lihatech-interview-confirmed-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});
 assert.match(await page.getByRole('button',{name:/Overlaps a booking/}).getAttribute('class'),/is-busy/);
 await page.getByLabel('Notifications, 3 unread',{exact:true}).click();await page.getByRole('button',{name:/Your document is ready/}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('read-student')).includes('documents'));assert.equal(await page.locator('output').textContent(),'/student/documents');
 await page.reload();await page.getByLabel('Notifications, 2 unread',{exact:true}).click();await page.getByRole('button',{name:'Mark all read',exact:true}).click();await page.getByLabel('Notifications',{exact:true}).waitFor();assert.equal(await page.locator('nav .portal-notification-badge').count(),0);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Switch account role'}).click();await page.getByLabel('Notifications, 2 unread',{exact:true}).click();await page.getByRole('button',{name:/Interview confirmed/}).click();assert.equal(await page.locator('output').textContent(),'/mock-interviews');
 await page.setViewportSize({width:375,height:812});await page.getByLabel('Notifications, 1 unread',{exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(tmpdir(),'lihatech-notifications-mobile.png')});
 await page.evaluate(()=>{window.failNotifications=true;window.dispatchEvent(new Event('lihatech-activity'));});await page.getByRole('alert').waitFor();await page.evaluate(()=>window.failNotifications=false);await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('alert').waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log('Request confirmation, pending/confirmed slots, left-column interviews, account badges, persisted reads, routing, retry and phone layout passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
