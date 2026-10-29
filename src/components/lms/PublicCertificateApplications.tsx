import React, { Suspense, useEffect, useRef, useState } from 'react';
import { lmsFetch, lmsRequest } from '../../lib/lmsApi';
import type { Certificate, CompanySettings, Letter } from '../../types';
import type { DocumentRequest } from '../../lib/documentRequests';
import CertificatePreview from '../certificate/CertificatePreview';
import { captureCertificate, createCertificatePdf } from '../../utils/certificateExport';
import { Award, ArrowUpRight, CalendarDays, CheckCircle2, Download, Eye, Mail, RefreshCw, Search, X } from 'lucide-react';
import '../../styles/publicCertificateAdmin.css';

type Application={id:string;full_name:string;course_name:string;certificate_type:string;designation:string;requested_start_date:string|null;requested_end_date:string|null;status:'pending'|'approved'|'declined';admin_note:string;email_status:string;created_at:string;document:Certificate|null;certificate_applicants:{email:string;student_code:string}};
type Props={settings:CompanySettings;renderReview:(row:DocumentRequest,saved:Certificate|Letter|null,approve:(document:Certificate|Letter)=>Promise<boolean>)=>React.ReactNode};
const endpoint='/admin/certificate-applications';
const PdfMaterialPreview=React.lazy(()=>import('./PdfMaterialPreview'));
export default function PublicCertificateApplications({settings,renderReview}:Props){
  const [rows,setRows]=useState<Application[]>([]),[selected,setSelected]=useState<Application|null>(null);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('pending'),[loading,setLoading]=useState(true);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
  const [exporting,setExporting]=useState<{document:Certificate;resolve:(pdf:string)=>void;reject:(e:unknown)=>void}|null>(null);
  const [viewer,setViewer]=useState<{blob:Blob;name:string;filename:string}|null>(null),[opening,setOpening]=useState<string|null>(null);
  const lock=useRef(false);
  async function reload(){setLoading(true);try{setRows(await lmsRequest<Application[]>(endpoint));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load public applications.');}finally{setLoading(false);}}
  useEffect(()=>{void reload();},[]);
  async function openPdf(row:Application,download=false){
    if(opening)return;setOpening(row.id);setError('');
    try{
      const blob=await(await lmsFetch(`${endpoint}/${row.id}/pdf`)).blob();
      if(blob.type.split(';')[0]!=='application/pdf')throw new Error('The saved certificate PDF could not be loaded.');
      const filename=`LihaTech-Certificate-${row.certificate_applicants.student_code}.pdf`;
      if(download){const{saveAs}=await import('file-saver');saveAs(blob,filename);}
      else setViewer({blob,name:row.full_name,filename});
    }catch(e){setError(e instanceof Error?e.message:'Could not open the saved certificate.');}
    finally{setOpening(null);}
  }
  async function send(row:Application){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    try{const result=await lmsRequest<{email_sent:boolean}>(`${endpoint}/${row.id}/send`,{method:'POST'});setNotice(result.email_sent?'Certificate emailed.':'Email failed. Check Hostinger settings and retry.');await reload();}
    catch(e){setError(e instanceof Error?e.message:'Email delivery failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function approve(document:Certificate|Letter){
    if(!selected||lock.current)return false;lock.current=true;setBusy(true);setError('');
    try{
      const certificate={...document,studentId:selected.certificate_applicants.student_code,candidateEmail:selected.certificate_applicants.email} as Certificate;
      const pdf_base64=await new Promise<string>((resolve,reject)=>setExporting({document:certificate,resolve,reject}));
      const result=await lmsRequest<{email_sent:boolean}>(`${endpoint}/${selected.id}/approve`,{method:'POST',body:JSON.stringify({document:certificate,pdf_base64})});
      setSelected(null);setFilter('approved');setNotice(result.email_sent?'Approved. The certificate PDF was emailed to the applicant.':'Approved and saved. Email failed; check Hostinger settings, then use Retry email.');await reload();return true;
    }catch(e){setError(e instanceof Error?e.message:'Could not approve the certificate.');return false;}
    finally{setExporting(null);lock.current=false;setBusy(false);}
  }
  async function decline(){
    if(!selected||lock.current||!note.trim())return;lock.current=true;setBusy(true);setError('');
    try{await lmsRequest(`${endpoint}/${selected.id}/decline`,{method:'POST',body:JSON.stringify({note})});setSelected(null);setNote('');setNotice('Application declined.');await reload();}
    catch(e){setError(e instanceof Error?e.message:'Could not decline.');}finally{lock.current=false;setBusy(false);}
  }
  const draft:DocumentRequest|null=selected?{id:selected.id,kind:'certificate',candidate_name:selected.full_name,program_name:selected.course_name,certificate_type:'Course Completion',offer_type:null,designation:'',department:'',start_date:null,end_date:null,details:'',status:'pending',admin_note:'',created_at:selected.created_at,student_code:selected.certificate_applicants.student_code,student_email:selected.certificate_applicants.email}:null;
  const shown=rows.filter(row=>(filter==='all'||row.status===filter)&&`${row.full_name} ${row.course_name} ${row.certificate_applicants.email} ${row.certificate_applicants.student_code}`.toLowerCase().includes(query.toLowerCase()));
  const dateLabel=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value)):'Not provided';
  const statuses={pending:'Awaiting review',approved:'Approved',declined:'Declined'};
  return <section className="public-certificate-admin" aria-label="Public certificate applications">
    <header className="public-applications-heading"><div><p className="request-kicker">PUBLIC APPLICATIONS</p><h2>Certificate applications</h2><p>Review completion requests from applicants outside the student portal.</p></div><div className="public-applications-toolbar"><a className="public-app-button secondary" href="/certificate-request" target="_blank" rel="noopener noreferrer"><ArrowUpRight size={17}/>Open public form</a><button type="button" className="public-app-button secondary" disabled={busy||loading} onClick={()=>void reload()}><RefreshCw size={16}/>{loading?'Refreshing…':'Refresh applications'}</button></div></header>
    {error&&<p role="alert" className="request-error">{error}</p>}{notice&&<p role="status" className="request-notice">{notice}</p>}
    <div className="public-applications-filters"><div role="group" aria-label="Application status">{(['pending','approved','declined','all'] as const).map(value=><button type="button" key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='pending'?'Needs review':value==='all'?'All applications':statuses[value]}<span>{rows.filter(row=>value==='all'||row.status===value).length}</span></button>)}</div><label className="public-application-search"><Search size={16}/><span className="sr-only">Search public applications</span><input type="search" placeholder="Search name, course, email or ID" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    {loading&&!rows.length?<p className="request-empty" role="status">Loading applications…</p>:!shown.length?<div className="request-empty"><Award size={28}/><p>{rows.length?'No applications match these filters.':'No public applications yet.'}</p></div>:<div className="request-admin-list">{shown.map(row=><article className="request-admin-card public-application-card" key={row.id}>
      <div className="request-admin-card-head"><div><span className="request-doc-icon"><Award size={22}/></span><div><h3>{row.full_name}</h3><p>{row.course_name}</p></div></div><span className={`request-status ${row.status==='approved'?'fulfilled':row.status}`}>{statuses[row.status]}</span></div>
      <dl className="public-application-facts"><div><dt>Student ID · automatic</dt><dd className="public-application-id">{row.certificate_applicants.student_code}</dd></div><div><dt>Email address</dt><dd>{row.certificate_applicants.email}</dd></div><div><dt>Certificate type</dt><dd>{row.certificate_type||'Course Completion'}</dd></div><div><dt>Requested dates</dt><dd>{dateLabel(row.requested_start_date)} – {dateLabel(row.requested_end_date)}</dd></div>{row.designation&&<div><dt>Internship domain / role</dt><dd>{row.designation}</dd></div>}</dl>
      {row.admin_note&&<p className="request-student-note"><strong>Admin note</strong>{row.admin_note}</p>}
      <footer className="public-application-actions"><span><CalendarDays size={15}/>Applied {dateLabel(row.created_at)}</span><div>
        {row.status==='pending'&&<button type="button" className="public-app-button primary" disabled={busy} onClick={()=>{setSelected(row);setNote('');setError('');}}><Eye size={17}/>Review application<ArrowUpRight size={16}/></button>}
        {row.status==='approved'&&<><button type="button" className="public-app-button secondary" disabled={!!opening||busy} onClick={()=>void openPdf(row)}><Eye size={17}/>{opening===row.id?'Opening…':'Preview certificate'}</button><button type="button" className="public-app-button primary" disabled={!!opening||busy} onClick={()=>void openPdf(row,true)}><Download size={17}/>Download PDF</button></>}
        {row.status==='approved'&&(row.email_status==='sent'?<span className="public-application-delivered"><CheckCircle2 size={17}/>Certificate emailed</span>:<><span className="public-application-email-state">{row.email_status==='sending'?'Email is being sent':'Email not delivered'}</span><button type="button" className="public-app-button secondary" disabled={busy} onClick={()=>void send(row)}><Mail size={17}/>Retry email</button></>)}
      </div></footer>
    </article>)}</div>}
    {selected&&draft&&<ApplicationDialog busy={busy} onClose={()=>setSelected(null)}>
      <div className="request-review-summary"><p className="request-kicker">CERTIFICATE REVIEW</p><h2>Review public certificate application</h2><p>{selected.full_name} · {selected.certificate_applicants.email}</p><p>Confirm course completion, edit certificate details as needed, then approve to email the PDF.</p></div>
      <div className="public-review-student-id"><Award size={20}/><div><strong>{selected.certificate_applicants.student_code}</strong><span>Student ID assigned automatically and included on this certificate.</span></div></div>
      {error&&<p role="alert" className="request-error">{error}</p>}
      <dl className="request-facts"><div><dt>Certificate type</dt><dd>{selected.certificate_type}</dd></div><div><dt>Requested dates</dt><dd>{selected.requested_start_date||'Not provided'} – {selected.requested_end_date||'Not provided'}</dd></div>{selected.designation&&<div><dt>Internship domain / role</dt><dd>{selected.designation}</dd></div>}</dl>
      {renderReview({...draft,certificate_type:selected.certificate_type||'Course Completion',designation:selected.designation||'',requested_start_date:selected.requested_start_date,requested_end_date:selected.requested_end_date,certificate_number:`LT-CERT-P-${selected.id.replace(/-/g,'').toUpperCase()}`},selected.document,approve)}
      <div className="request-review-footer"><label>Reason for declining<textarea maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain why this application cannot be approved"/></label><button type="button" className="public-app-button danger" disabled={busy||!note.trim()} onClick={()=>void decline()}>Decline application</button></div>
    </ApplicationDialog>}
    {exporting&&<ExportSheet document={exporting.document} settings={settings} ready={exporting.resolve} failed={exporting.reject}/>}
    {viewer&&<SavedCertificateDialog viewer={viewer} onClose={()=>setViewer(null)}/>}
  </section>;
}
function SavedCertificateDialog({viewer,onClose}:{viewer:{blob:Blob;name:string;filename:string};onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="request-preview-dialog public-certificate-pdf" aria-label="Approved certificate PDF" onClose={onClose}>
    <header><div><h2>Approved certificate</h2><p>{viewer.name} · Original saved certificate PDF</p></div><div><button type="button" className="public-app-button primary" onClick={async()=>{const{saveAs}=await import('file-saver');saveAs(viewer.blob,viewer.filename);}}><Download size={17}/>Download PDF</button><button type="button" className="public-app-button secondary" aria-label="Close certificate preview" onClick={()=>ref.current?.close()}><X size={17}/>Close</button></div></header>
    <div className="public-certificate-pdf-pages"><Suspense fallback={<p role="status">Loading certificate preview…</p>}><PdfMaterialPreview blob={viewer.blob}/></Suspense></div>
  </dialog>;
}
function ApplicationDialog({children,busy,onClose}:{children:React.ReactNode;busy:boolean;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="request-review-dialog public-application-review" aria-label="Review public certificate" onCancel={e=>{if(busy)e.preventDefault();}} onClose={onClose}><button type="button" className="request-review-close public-app-button secondary" disabled={busy} onClick={()=>ref.current?.close()}><X size={17}/>Close</button>{children}</dialog>;
}
function ExportSheet({document,settings,ready,failed}:{document:Certificate;settings:CompanySettings;ready:(value:string)=>void;failed:(e:unknown)=>void}){
  const ref=useRef<HTMLDivElement>(null),started=useRef(false);
  useEffect(()=>{if(started.current)return;started.current=true;void(async()=>{try{
    if(!ref.current)throw new Error('Certificate preview is unavailable.');
    const {pdfBlob}=await createCertificatePdf(await captureCertificate(ref.current),{includePreview:false});
    const reader=new FileReader();reader.onerror=()=>failed(new Error('Could not prepare certificate PDF.'));reader.onload=()=>ready(String(reader.result).split(',')[1]);reader.readAsDataURL(pdfBlob);
  }catch(e){failed(e);}})();},[]);
  return <div className="request-export-sheet" aria-hidden="true"><CertificatePreview certificate={document} settings={settings} renderOnlySheet showActions={false} divRef={ref}/></div>;
}
