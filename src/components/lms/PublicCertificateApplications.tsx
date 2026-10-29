import React, { useEffect, useRef, useState } from 'react';
import { lmsRequest } from '../../lib/lmsApi';
import type { Certificate, CompanySettings, Letter } from '../../types';
import type { DocumentRequest } from '../../lib/documentRequests';
import CertificatePreview from '../certificate/CertificatePreview';
import { captureCertificate, createCertificatePdf } from '../../utils/certificateExport';

type Application={id:string;full_name:string;course_name:string;status:'pending'|'approved'|'declined';admin_note:string;email_status:string;created_at:string;document:Certificate|null;certificate_applicants:{email:string;student_code:string}};
type Props={settings:CompanySettings;renderReview:(row:DocumentRequest,saved:Certificate|Letter|null,approve:(document:Certificate|Letter)=>Promise<boolean>)=>React.ReactNode};
const endpoint='/admin/certificate-applications';
export default function PublicCertificateApplications({settings,renderReview}:Props){
  const [rows,setRows]=useState<Application[]>([]),[selected,setSelected]=useState<Application|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
  const [exporting,setExporting]=useState<{document:Certificate;resolve:(pdf:string)=>void;reject:(e:unknown)=>void}|null>(null);
  const lock=useRef(false);
  async function reload(){try{setRows(await lmsRequest<Application[]>(endpoint));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load public applications.');}}
  useEffect(()=>{void reload();},[]);
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
      setSelected(null);setNotice(result.email_sent?'Approved. The certificate PDF was emailed to the applicant.':'Approved and saved. Email failed; check Hostinger settings, then use Retry email.');await reload();return true;
    }catch(e){setError(e instanceof Error?e.message:'Could not approve the certificate.');return false;}
    finally{setExporting(null);lock.current=false;setBusy(false);}
  }
  async function decline(){
    if(!selected||lock.current||!note.trim())return;lock.current=true;setBusy(true);setError('');
    try{await lmsRequest(`${endpoint}/${selected.id}/decline`,{method:'POST',body:JSON.stringify({note})});setSelected(null);setNote('');setNotice('Application declined.');await reload();}
    catch(e){setError(e instanceof Error?e.message:'Could not decline.');}finally{lock.current=false;setBusy(false);}
  }
  const draft:DocumentRequest|null=selected?{id:selected.id,kind:'certificate',candidate_name:selected.full_name,program_name:selected.course_name,certificate_type:'Course Completion',offer_type:null,designation:'',department:'',start_date:null,end_date:null,details:'',status:'pending',admin_note:'',created_at:selected.created_at,student_code:selected.certificate_applicants.student_code,student_email:selected.certificate_applicants.email}:null;
  return <section className="panel" style={{marginBottom:24}}>
    <h2>Public certificate applications</h2><p>Former students applying without a batch or LMS account.</p><p><a href="/certificate-request" target="_blank" rel="noopener noreferrer">Open public application form</a></p>
    <button type="button" className="outline-button" disabled={busy} onClick={()=>void reload()}>Refresh applications</button>
    {error&&<p role="alert" className="request-error">{error}</p>}{notice&&<p role="status" className="request-notice">{notice}</p>}
    {!rows.length?<p>No public applications yet.</p>:<div className="request-admin-list">{rows.map(row=><article className="request-admin-card" key={row.id}><h3>{row.full_name} · {row.course_name}</h3><p>{row.certificate_applicants.email} · Student ID: {row.certificate_applicants.student_code}</p><p>Status: {row.status}{row.status==='approved'?` · Email: ${row.email_status}`:''}</p>{row.admin_note&&<p>{row.admin_note}</p>}{row.status==='pending'&&<button type="button" className="primary-button" disabled={busy} onClick={()=>{setSelected(row);setNote('');setError('');}}>Review application</button>}{row.status==='approved'&&['not_sent','failed','sending'].includes(row.email_status)&&<button type="button" className="outline-button" disabled={busy} onClick={()=>void send(row)}>Retry email</button>}</article>)}</div>}
    {selected&&draft&&<ApplicationDialog busy={busy} onClose={()=>setSelected(null)}>
      <h2>Review public certificate application</h2><p>{selected.full_name} · {selected.certificate_applicants.email}</p><p>Confirm course completion, edit certificate details as needed, then approve to email the PDF.</p>
      {error&&<p role="alert" className="request-error">{error}</p>}
      {renderReview({...draft,certificate_number:`LT-CERT-P-${selected.id.replace(/-/g,'').toUpperCase()}`},selected.document,approve)}
      <label>Reason for declining<textarea maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label><button type="button" className="request-danger" disabled={busy||!note.trim()} onClick={()=>void decline()}>Decline application</button>
    </ApplicationDialog>}
    {exporting&&<ExportSheet document={exporting.document} settings={settings} ready={exporting.resolve} failed={exporting.reject}/>}
  </section>;
}
function ApplicationDialog({children,busy,onClose}:{children:React.ReactNode;busy:boolean;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="request-review-dialog" aria-label="Review public certificate" onCancel={e=>{if(busy)e.preventDefault();}} onClose={onClose}><button type="button" className="outline-button" disabled={busy} onClick={()=>ref.current?.close()}>Close</button>{children}</dialog>;
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
