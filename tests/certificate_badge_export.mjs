// Capture the actual certificate using the same renderer as emailed PDFs.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
const cssFile=(await readdir('dist/assets')).find(name=>/^index-.*\.css$/.test(name));
const css=await readFile('dist/assets/'+cssFile);
const source=`import React from 'react';import{createRoot}from'react-dom/client';
import CertificatePreview from './src/components/certificate/CertificatePreview';import{normalizeSettings}from'./src/utils/storage';import{captureCertificate,createCertificatePdf}from'./src/utils/certificateExport';
const settings=normalizeSettings({name:'LihaTech',directorName:'Director'});
const certificate={id:'badge-test',certificateId:'LT-CERT-123456789ABC',studentId:'LT-CERT-STU-100072',candidateName:'Example Applicant',certificateType:'Course Completion',programName:'Python Course',issueDate:'2026-10-29',mode:'Online',location:'',textTemplate:'',createdAt:'2026-10-29'};
createRoot(document.getElementById('root')).render(<><section id="royal"><CertificatePreview certificate={{...certificate,designTemplate:'royal'}} settings={settings} showActions={false} renderOnlySheet/></section><section id="emerald"><CertificatePreview certificate={{...certificate,designTemplate:'emerald'}} settings={settings} showActions={false} renderOnlySheet/></section></>);
window.captureBadge=async(template)=>{
 const sheet=document.querySelector('#'+template+'>div');const seal=sheet.querySelector('[data-certificate-badge="seal"]');
 const bounds=seal.getBoundingClientRect(),sheetBounds=sheet.getBoundingClientRect();
 const canvas=await captureCertificate(sheet);const scale=canvas.width/sheetBounds.width;
 const pixels=canvas.getContext('2d').getImageData(Math.round((bounds.left-sheetBounds.left)*scale),Math.round((bounds.top-sheetBounds.top)*scale),Math.round(bounds.width*scale),Math.round(bounds.height*scale)).data;
 let gold=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>140&&pixels[i+1]>100&&pixels[i+2]<pixels[i+1]*.8&&pixels[i]>pixels[i+1]*1.05)gold++;
 const {pdfBlob}=await createCertificatePdf(canvas,{includePreview:false});canvas.id='captured-certificate';canvas.style.width='1123px';canvas.style.height='794px';document.getElementById('captured-certificate')?.remove();document.body.appendChild(canvas);
 return {gold,pdfSize:pdfBlob.size};
};
window.openCorrectionDialog=()=>{const dialog=document.createElement('dialog');dialog.innerHTML='<p>Correction review is open</p>';document.body.appendChild(dialog);dialog.showModal();for(const id of ['royal','emerald']){const sheet=document.getElementById(id);sheet.style.position='absolute';sheet.style.left='-15000px';sheet.style.top='0';}};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'esm',minify:true,loader:{'.png':'dataurl','.svg':'dataurl'},define:{'import.meta.env':'{}'}});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.end('<!doctype html><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:white}#root{width:1123px}</style><div id="root"></div><script type="module" src="/app.js"></script>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/LENOVO/AppData/Local/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.locator('[data-certificate-badge="seal"]').first().waitFor();
 const sources=await page.locator('img[data-certificate-badge]').evaluateAll(nodes=>nodes.map(node=>node.src));assert.equal(sources.length,2);assert.ok(sources.every(src=>src.startsWith('data:image/svg+xml')),'Export uses complete self-contained SVG images');
 for(const template of ['royal','emerald']){
  const result=await page.evaluate(template=>window.captureBadge(template),template);
  assert.ok(result.gold>500,template+' badge gold seal must survive PDF rasterization: '+JSON.stringify(result));assert.ok(result.pdfSize>10000);
  await page.locator('#captured-certificate').screenshot({path:'C:/Windows/Temp/lihatech-'+template+'-badge-export.png'});
 }
 await page.evaluate(()=>window.openCorrectionDialog());
 for(const template of ['royal','emerald']){
  const result=await page.evaluate(template=>window.captureBadge(template),template);
  assert.ok(result.gold>500,template+' hidden export behind correction dialog must retain the badge: '+JSON.stringify(result));
 }
 assert.deepEqual(errors,[]);console.log('Royal/emerald badges retain gold seal in normal and hidden modal exports using self-contained images. No email sent.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
