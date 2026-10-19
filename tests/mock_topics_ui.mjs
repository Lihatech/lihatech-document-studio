// Isolated component check: no live requests or calendar invitations.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const result=await build({stdin:{contents:`import React from 'react';
import {createRoot} from 'react-dom/client';
import MockCalendar from './src/components/lms/MockCalendar';
import './src/styles/student.css';
window.requests=[];
createRoot(document.getElementById('root')).render(<div className="student-portal"><MockCalendar bookings={[]} busy={false}
loadDay={async day=>({date:day,calendar_connected:true,hours:[{starts_at:day+'T09:00:00+05:30',ends_at:day+'T10:00:00+05:30',available:true}]})}
loadMonth={async month=>({month,calendar_connected:true,busy_days:[]})}
onRequest={async(startsAt,topics)=>{window.requests.push({startsAt,topics});return true;}} onCancel={()=>{}}/></div>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',write:false,outfile:'fixture.js'});
const server=createServer((req,res)=>{
  const file=result.outputFiles.find(file=>req.url==='/'+file.path.split(/[\\/]/).at(-1));
  if(file){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');res.end(file.contents);}
  else res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const failures=[];page.on('pageerror',error=>failures.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:/to .*Available/i}).click();
  const dialog=page.getByRole('dialog');
  const send=dialog.getByRole('button',{name:'Send request'});
  assert.equal(await send.isDisabled(),true);
  await dialog.getByLabel(/Topics you’ve prepared/).fill('   ');
  assert.equal(await send.isDisabled(),true);
  await dialog.getByLabel(/Topics you’ve prepared/).fill('  SQL joins, Java OOP\nReact hooks  ');
  assert.equal(await send.isEnabled(),true);
  assert.equal(await dialog.getByLabel(/Topics you’ve prepared/).getAttribute('maxlength'),'2000');
  assert.equal(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth),true);
  await send.click();await dialog.waitFor({state:'hidden'});
  assert.deepEqual((await page.evaluate(()=>window.requests))[0].topics,'SQL joins, Java OOP\nReact hooks');
  assert.deepEqual(failures,[]);
  console.log('Prepared topics: required field, whitespace guard, mobile layout and request payload passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
