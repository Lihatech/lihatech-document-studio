// Public pages must work without JavaScript, authentication or backend requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const publicDir=process.env.PUBLIC_PAGES_DIR||'public';
const paths=['/about.html','/privacy.html','/terms.html'];
const source=`import React from 'react';import {createRoot} from 'react-dom/client';import Login from './src/pages/Login';createRoot(document.getElementById('root')).render(<Login/>);`;
console.log('Bundling isolated sign-in fixture…');
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'esm',plugins:[{name:'no-auth-services',setup(builder){
 builder.onLoad({filter:/src[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export const auth=null,firebaseConfigured=true;export async function signInWithCompanyGoogle(){throw Error("Sign-in is not used in this test");}',loader:'js'}));
 builder.onLoad({filter:/src[\\/]lib[\\/]supabase\.ts$/},()=>({contents:'export const supabaseConfigured=true;',loader:'js'}));
}}]});
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/login-fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);return;}
  if(req.url==='/'){res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/login-fixture.js"></script>');return;}
  if(![...paths,'/public-pages.css','/lihatech-logo-official.png'].includes(req.url)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url.endsWith('.html')?'text/html; charset=utf-8':req.url.endsWith('.css')?'text/css':'image/png');res.end(await readFile(join(publicDir,req.url.slice(1))));
 }catch{res.writeHead(500);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'});
try{
 const base='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({javaScriptEnabled:false});
 const page=await context.newPage();page.setDefaultTimeout(10000);const failures=[];page.on('request',request=>{if(!request.url().startsWith(base))failures.push(request.url());});
 for(const [index,path] of paths.entries()){
  console.log('Checking '+path);const response=await page.goto(base+path);assert.equal(response.status(),200);assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('script').count(),0);assert.equal(await page.locator('nav[aria-label="Main navigation"] [aria-current="page"]').count(),1);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://studio.lihatech.com'+path);
  assert.equal(await page.locator('header img').evaluate(image=>image.complete&&image.naturalWidth>0),true);
  for(const size of [{width:1440,height:900},{width:375,height:812},{width:812,height:375}]){
   await page.setViewportSize(size);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${path} must fit ${size.width}px`);
  }
  await page.setViewportSize({width:375,height:812});await page.screenshot({path:join(tmpdir(),`lihatech-public-${index}-mobile.png`),fullPage:true});
 }
 await page.goto(base+'/about.html');await page.getByRole('link',{name:'Privacy Policy',exact:true}).first().click();assert.ok(page.url().endsWith('/privacy.html'));
 await page.getByRole('link',{name:'Skip to content',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#main'&&document.activeElement.id==='main');
 assert.deepEqual(failures,[],'Public pages must not call Google, Firebase or private APIs');
 await context.close();
 const login=await browser.newPage();const errors=[];login.on('pageerror',error=>errors.push(error.message));await login.goto(base);
 for(const [label,path] of [['About','/about.html'],['Privacy Policy','/privacy.html'],['Terms of Use','/terms.html']]){
  await login.getByRole('navigation',{name:'Public information'}).getByRole('link',{name:label,exact:true}).click();assert.ok(login.url().endsWith(path));await login.goBack();
 }
 assert.deepEqual(errors,[]);console.log('Public pages load without JavaScript/auth/API access; desktop/mobile/landscape layouts, policy links, skip link, logo and sign-in footer passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
