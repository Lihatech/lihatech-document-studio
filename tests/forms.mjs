import { build } from 'esbuild';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const source = `
import React from 'react';
import Home from './src/pages/Home';
import DocumentNavigation, {getDocumentBackLink, getDocumentSection, StudioLink} from './src/components/layout/DocumentNavigation';
import Navbar from './src/components/layout/Navbar';
import {renderToString} from 'react-dom/server';
import CertificateBuilder from './src/pages/CertificateBuilder';
import BulkCertificateGenerator from './src/pages/BulkCertificateGenerator';
import PayslipBuilder from './src/pages/PayslipBuilder';
import LetterBuilder from './src/pages/LetterBuilder';
import InvoiceBuilder from './src/pages/InvoiceBuilder';
import Settings from './src/pages/Settings';
import {getDefaultStudioData} from './src/utils/storage';
const studio=getDefaultStudioData(); const {settings}=studio;
export {getDocumentBackLink,getDocumentSection,StudioLink};
const save=async()=>true; const nothing=()=>{};
export const rendered = {
 home:renderToString(<Home navigate={nothing} data={{...studio, invoices:[{id:'a'},{id:'b'}]}}/>),
 module:renderToString(<DocumentNavigation path='/certificate/new' navigate={nothing} editing/>),
 sidebar:renderToString(<Navbar path='/settings' navigate={nothing} settings={settings} userEmail={null} darkMode={false} setDarkMode={nothing} onLogout={nothing}/>),
 certificate:renderToString(<CertificateBuilder settings={settings} courses={[]} existingCertificates={[]} onBack={nothing} navigate={nothing} onSaveCertificate={save} onSaveCourse={save} onAddCertificateOption={async name=>name}/>),
 bulk:renderToString(<BulkCertificateGenerator settings={settings} courses={[]} existingCertificates={[]} navigate={nothing} onSaveCertificates={save} onSaveCourse={save} onAddCertificateOption={async name=>name}/>),
 payslip:renderToString(<PayslipBuilder settings={settings} employees={[]} onSaveEmployees={save} onSavePayslip={save} onBack={nothing} navigate={nothing}/>),
 letter:renderToString(<LetterBuilder settings={settings} onSaveLetter={save} onBack={nothing} navigate={nothing}/>),
 invoice:renderToString(<InvoiceBuilder settings={settings} clients={[]} existingInvoices={[]} onSaveInvoice={save} onBack={nothing}/>),
 settings:renderToString(<Settings settings={settings} onSaveSettings={save}/>),
};`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',loader:{'.png':'dataurl'},plugins:[{name:'mock-persistence-for-render',setup(build){build.onLoad({filter:/src[\\/]lib[\\/]documentStudio\.ts$/},()=>({contents:`export const getReservedInvoiceNumbers=()=>[];export const errorMessage=e=>e.message;export const loadInvoiceDraft=async()=>null;export const saveInvoiceDraft=async()=>{};`}));}}]});
const output={exports:{}};
try { new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),output,output.exports); } catch(error) { console.error(error.message); process.exit(1); }
const {rendered,getDocumentBackLink,getDocumentSection,StudioLink}=output.exports;
assert.deepEqual(getDocumentBackLink('/documents'),{path:'/',label:'Back to LMS overview'});
for(const type of ['invoice','certificate','letter','payslip']) {
 assert.equal(getDocumentBackLink(`/${type}/new`).path,`/${type}/old`);
 assert.equal(getDocumentBackLink(`/${type}/old`).path,'/documents');
}
assert.equal(getDocumentBackLink('/certificate/bulk').path,'/certificate/old');
assert.equal(getDocumentBackLink('/settings').path,'/documents');
assert.equal(getDocumentSection('/students'),undefined);
assert.equal(getDocumentSection('/certificate-requests'),undefined);
let navigated='';let prevented=false;
const link=StudioLink({navigate:path=>navigated=path,href:'/documents'});
link.props.onClick({button:0,defaultPrevented:false,preventDefault(){prevented=true;}});
assert.equal(navigated,'/documents');assert.equal(prevented,true);
navigated='';prevented=false;
link.props.onClick({button:0,metaKey:true,defaultPrevented:false,preventDefault(){prevented=true;}});
assert.equal(navigated,'');assert.equal(prevented,false,'Modified clicks preserve native new-tab behavior');
assert.match(rendered.module,/aria-current="page"[^>]*>Edit/);
assert.match(rendered.module,/Back to certificates/);
assert.match(rendered.home,/>2<\/p>/);
assert.match(rendered.home,/No activity yet/);
assert.match(rendered.sidebar,/Document settings/);
for(const [form,html] of Object.entries(rendered))assert.ok(html.length>20,`${form} renders`);
for(const form of ['certificate','bulk']) {assert.match(rendered[form],/Add new option/);assert.match(rendered[form],/Certification category/);assert.match(rendered[form],/Partner institute/);}
assert.ok(!rendered.payslip.includes('Yameen Hakim'),'No seeded employee preview');
console.log('Forms, module overview, breadcrumbs, parent navigation, sidebar, counts, and native link behavior pass.');
