// Isolated visual review; no authentication or live data.
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

await build({
  stdin: {
    contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import MockCalendar from './src/components/lms/MockCalendar';
import './src/styles/student.css';
const day=(offset,hour)=>{const d=new Date();d.setDate(d.getDate()+offset);d.setHours(hour,0,0,0);return d.toISOString()};
const bookings=[{id:'mine-1',starts_at:day(2,12),ends_at:day(2,13),status:'booked',meeting_url:'https://meet.google.com/example',slot_status:'open'},{id:'mine-2',starts_at:day(6,15),ends_at:day(6,16),status:'requested',slot_status:'open'}];
const hour=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')+':00+05:30';
const loadDay=async day=>({date:day,calendar_connected:true,busy_periods:[{starts_at:day+'T13:00:00+05:30',ends_at:day+'T14:00:00+05:30'}],hours:Array.from({length:33},(_,i)=>{const start=540+i*15;return{starts_at:day+'T'+hour(start),ends_at:day+'T'+hour(start+60),available:start+60<=780||start>=840,reason:start+60>780&&start<840?'calendar_busy':null}})});
const loadMonth=async month=>({month,calendar_connected:true,busy_days:[new Date().toISOString().slice(0,10)]});
createRoot(document.getElementById('root')).render(<div className="student-portal"><main className="page-content"><MockCalendar bookings={bookings} busy={false} loadDay={loadDay} loadMonth={loadMonth} onRequest={async()=>true} onCancel={()=>{}}/></main></div>);`,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, format: 'esm', outfile: 'mock-calendar-review.js',
});
await writeFile('mock-calendar-review.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/mock-calendar-review.css"></head><body style="margin:0"><div id="root"></div><script type="module" src="/mock-calendar-review.js"></script></body></html>');
console.log('Open /mock-calendar-review.html for isolated calendar review.');
