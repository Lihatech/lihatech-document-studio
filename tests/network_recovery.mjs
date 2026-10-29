// Isolated browser checks: no Google sign-in, live database, or retained fixtures.
// Set PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for an external runtime.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const mocks={
 firebase:`
  export const firebaseConfigured=true;
  export const COMPANY_ACCESS_WARNING='Account not approved.';
  export const isAllowedCompanyUser=()=>true;
  export const auth={currentUser:{uid:'test-user',email:'test@lihatech.com'}};
  const listeners=new Set();
  export const subscribeToCompanyAuth=callback=>{listeners.add(callback);queueMicrotask(()=>{if(listeners.has(callback))callback(auth.currentUser);});return()=>listeners.delete(callback);};
  export const signOutCompany=async()=>{window.__signOuts=(window.__signOuts||0)+1;auth.currentUser=null;listeners.forEach(callback=>callback(null));};
  export const signInWithCompanyGoogle=async()=>{};
 `,
 supabase:`export const supabaseConfigured=true;export const loadCompanySettings=async()=>({});export const saveCompanySettings=async()=>{};`,
 documentStudio:`
  export const loadStudioData=async defaults=>{window.__loads=(window.__loads||0)+1;return defaults;};
  export const saveStudioChanges=async()=>{};export const addCertificateOption=async()=>({});
  export const errorMessage=e=>e.message;export const rememberStudioRecord=()=>{};
 `,
 lms:`
  export const isLmsAccessDenied=e=>e?.code==='42501';
  export const rpc=async()=>{
   window.__accessCalls=(window.__accessCalls||0)+1;
   if(window.__denyAccess)throw Object.assign(new Error('Your access changed.'),{code:'42501'});
   if(window.__failAccess)throw new Error('Failed to fetch');
   return {role:window.__role||'admin',id:'test-user',name:'Test user',email:'test@lihatech.com'};
  };
 `,
};
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',loader:{'.png':'dataurl','.svg':'dataurl'},define:{'import.meta.env':'{}'},plugins:[{name:'isolated-access-check',setup(b){
 b.onLoad({filter:/src[\\/]lib[\\/](firebase|supabase|documentStudio|lms)\.ts$/},args=>({contents:mocks[args.path.match(/([^\\/]+)\.ts$/)[1]],loader:'js'}));
 b.onLoad({filter:/src[\\/]pages[\\/].*\.tsx$/},args=>args.path.endsWith('Login.tsx')?undefined:{contents:`import React from 'react';export default function Workspace(){return <main><h1>Portal workspace</h1><input aria-label="Unsaved note" defaultValue=""/></main>;}`,loader:'tsx'});
 b.onLoad({filter:/src[\\/]components[\\/]layout[\\/](Navbar|DocumentNavigation)\.tsx$/},()=>({contents:'export default function Navigation(){return null;}export const getDocumentSection=()=>undefined;',loader:'js'}));
}}]});
const cssFile=(await readdir('dist/assets')).find(file=>/^index-.*\.css$/.test(file));
const css=await readFile(`dist/assets/${cssFile}`,'utf8');
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
const server=createServer((request,response)=>{response.setHeader('Content-Type','text/html');response.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const errors=[];
async function open(options={}) {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(options=>{
  Object.assign(window,options);
  Object.defineProperty(navigator,'onLine',{get:()=>!window.__offline});
  const interval=window.setInterval;
  window.setInterval=(callback,delay,...args)=>{if(delay===60000)window.__verify=callback;return interval(callback,delay,...args);};
 },options);
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 return page;
}
async function connection(page,offline) {
 await page.evaluate(value=>{window.__offline=value;window.dispatchEvent(new Event(value?'offline':'online'));},offline);
}
try {
 const page=await open({__offline:true});
 await page.getByRole('heading',{name:'No network connection',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Sign in',exact:true}).count(),0);
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__accessCalls||0),0,'Offline retry does not attempt authentication');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('dialog[open]').count(),1,'Connection notice cannot be dismissed into an unverified session');
 assert.equal(await page.locator('dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth),true);
 await connection(page,false);
 await page.getByRole('heading',{name:'Portal workspace'}).waitFor();
 await page.getByRole('textbox',{name:'Unsaved note'}).fill('Do not lose this edit');
 await connection(page,true);
 await page.getByRole('heading',{name:'No network connection',exact:true}).waitFor();
 const calls=await page.evaluate(()=>window.__accessCalls);
 await page.evaluate(()=>window.__verify());
 assert.equal(await page.evaluate(()=>window.__accessCalls),calls,'Background checks skip offline requests');
 await connection(page,false);
 await page.locator('dialog[open]').waitFor({state:'detached'});
 assert.equal(await page.getByRole('textbox',{name:'Unsaved note'}).inputValue(),'Do not lose this edit');
 assert.equal(await page.evaluate(()=>window.__loads),1,'Reconnection must not reload settings and reset open editors');
 assert.equal(await page.evaluate(()=>window.__signOuts||0),0,'Disconnecting never signs the user out');
 await page.evaluate(async()=>{window.__failAccess=true;await window.__verify();});
 await page.getByRole('heading',{name:'Unable to connect',exact:true}).waitFor();
 await page.evaluate(()=>window.__failAccess=false);
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await page.locator('dialog[open]').waitFor({state:'detached'});
 assert.equal(await page.getByRole('textbox',{name:'Unsaved note'}).inputValue(),'Do not lose this edit');
 await page.evaluate(async()=>{window.__denyAccess=true;await window.__verify();});
 await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
 assert.equal(await page.locator('dialog[open]').count(),0,'Real access denial is not presented as a network failure');
 assert.equal(await page.evaluate(()=>window.__signOuts),1);
 const initialFailure=await open({__failAccess:true});
 await initialFailure.getByRole('heading',{name:'Unable to connect',exact:true}).waitFor();
 assert.equal(await initialFailure.getByRole('heading',{name:'Sign in',exact:true}).count(),0);
 await initialFailure.evaluate(()=>window.__failAccess=false);
 await initialFailure.getByRole('button',{name:'Try again',exact:true}).click();
 await initialFailure.getByRole('heading',{name:'Portal workspace'}).waitFor();
 const student=await open({__role:'student'});
 await student.getByRole('heading',{name:'Portal workspace'}).waitFor();
 await student.getByRole('textbox',{name:'Unsaved note'}).fill('Student edit');
 await connection(student,true);
 await student.getByRole('heading',{name:'No network connection',exact:true}).waitFor();
 await connection(student,false);
 await student.locator('dialog[open]').waitFor({state:'detached'});
 assert.equal(await student.getByRole('textbox',{name:'Unsaved note'}).inputValue(),'Student edit');
 assert.deepEqual(errors,[]);
 console.log('Offline startup, reconnect, manual retry, preserved admin/student work, transient failures, and real access denial passed.');
} finally {
 await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
