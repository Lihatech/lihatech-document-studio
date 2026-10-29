import React, { Suspense, useEffect, useRef, useState } from 'react';
import { FileCheck2, RefreshCw, X } from 'lucide-react';
import { rpc } from '../../lib/lms';
import { requestStatus, requestTitle, type DocumentRequest } from '../../lib/documentRequests';
import type { Certificate, Letter, CompanySettings } from '../../types';
import PublicCertificateApplications from '../../components/lms/PublicCertificateApplications';
import type { StudioRecord } from '../../lib/documentStudio';
import type { RequestDocumentContent } from '../../lib/requestDocumentPreview';
import ListFilters from '../../components/lms/ListFilters';
import '../../styles/documentRequests.css';
import '../../styles/lms.css';

const DocumentPreviewDialog=React.lazy(()=>import('../../components/lms/RequestDocumentPreview').then(module=>({default:module.DocumentPreviewDialog})));
type Document = Certificate | Letter;
type Props = {
  settings: CompanySettings;
  cachedRequests: DocumentRequest[] | null;
  onRequestsChange: (rows: DocumentRequest[]) => void;
  onIssued: (record: StudioRecord) => void;
  renderReview: (row: DocumentRequest, saved: Document | null, approve: (document: Document) => Promise<boolean>) => React.ReactNode;
};
export default function DocumentRequestsAdmin({settings,cachedRequests,onRequestsChange,onIssued,renderReview}:Props) {
  const [requests,setRequests]=useState<DocumentRequest[]>(cachedRequests||[]);
  const [filter,setFilter]=useState<'open'|'all'>('open');
  const [query,setQuery]=useState(''),[kindFilter,setKindFilter]=useState('all');
  const [loading,setLoading]=useState(!cachedRequests),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [selected,setSelected]=useState<{row:DocumentRequest;saved:Document|null}|null>(null);
  const [note,setNote]=useState('');
  const [preview,setPreview]=useState<RequestDocumentContent|null>(null);
  const inFlight=useRef(false);
  function replaceRequests(rows:DocumentRequest[]) {setRequests(rows);onRequestsChange(rows);}
  async function reload() {
    setLoading(true);setError('');
    try {replaceRequests(await rpc<DocumentRequest[]>('lms_admin_document_requests'));}
    catch(e){setError(e instanceof Error?e.message:'Could not load document requests.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reload();const openNotification=()=>void reload();window.addEventListener('lihatech-notification-open',openNotification);return()=>window.removeEventListener('lihatech-notification-open',openNotification);},[]);
  async function open(row:DocumentRequest) {
    setError('');setNotice('');
    if(!row.published_at&&!row.draft_available){setSelected({row,saved:null});setNote(row.admin_note||'');return;}
    setBusy(true);
    try {
      const content=await rpc<RequestDocumentContent>('lms_request_document_content',{p_id:row.id});
      if(row.published_at)setPreview({...content,draft:false});
      else {setSelected({row,saved:content.document});setNote(row.admin_note||'');}
    } catch(e){setError(e instanceof Error?e.message:'Could not open this request.');}
    finally{setBusy(false);}
  }
  async function approve(document:Document):Promise<boolean> {
    if(!selected||inFlight.current)return false;
    inFlight.current=true;setBusy(true);setError('');
    try {
      const result=await rpc<{request:DocumentRequest;record:StudioRecord}>('lms_approve_document_request',{
        p_id:selected.row.id,p_document:document,p_expected_updated_at:selected.row.updated_at,
        p_expected_version:selected.row.studio_version||0,p_note:note,
      });
      replaceRequests(requests.map(row=>row.id===result.request.id?result.request:row));
      onIssued(result.record);setSelected(null);setNotice('Approved and sent. The student can now preview and download the PDF.');
      return true;
    } catch(e){setError(e instanceof Error?e.message:'Approval failed. Nothing was issued. Please try again.');return false;}
    finally{inFlight.current=false;setBusy(false);}
  }
  async function decline() {
    if(!selected||inFlight.current)return;
    if(!note.trim()){setError('Add a message explaining why you are declining.');return;}
    inFlight.current=true;setBusy(true);setError('');
    try {
      await rpc('lms_review_document_request',{p_id:selected.row.id,p_status:'declined',p_note:note});
      replaceRequests(requests.map(row=>row.id===selected.row.id?{...row,status:'declined',admin_note:note}:row));
      setSelected(null);setNotice('Request declined. Your message is visible to the student.');
    } catch(e){setError(e instanceof Error?e.message:'Could not decline this request.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  const shown=requests.filter(row=>(filter==='all'||['pending','approved'].includes(row.status))
    &&(kindFilter==='all'||row.kind===kindFilter)
    &&`${row.candidate_name} ${row.student_email} ${row.program_name} ${row.designation} ${row.batch_name||''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="admin-document-requests">
    <header className="request-admin-head"><div><p className="request-kicker">LEARNING OPERATIONS</p><h1>Document requests</h1><p>Review public certificate applications and student portal requests.</p></div></header>
    <PublicCertificateApplications settings={settings} renderReview={renderReview}/>
    <header className="request-admin-head"><div><h2 style={{fontSize:24,fontWeight:750}}>Student portal requests</h2><p>Documents requested by students through their learning portal.</p></div><button className="request-refresh" disabled={loading||busy} onClick={()=>void reload()}><RefreshCw size={17}/>{loading?'Refreshing…':'Refresh student requests'}</button></header>
    {!selected&&error&&<p className="request-error" role="alert">{error}</p>}{notice&&<p className="request-notice" role="status">{notice}</p>}
    <div className="request-admin-toolbar"><div><button className={filter==='open'?'active':''} aria-pressed={filter==='open'} onClick={()=>setFilter('open')}>Needs action <span>{requests.filter(row=>['pending','approved'].includes(row.status)).length}</span></button><button className={filter==='all'?'active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All requests <span>{requests.length}</span></button></div></div>
    <ListFilters query={query} onQuery={setQuery} placeholder="Search student, email, programme or batch" filters={[{label:'Document',value:kindFilter,onChange:setKindFilter,options:[{value:'all',label:'All documents'},{value:'certificate',label:'Certificates'},{value:'offer_letter',label:'Offer letters'}]}]}/>
    {loading&&!requests.length?<p className="request-empty">Loading requests…</p>:shown.length?<div className="request-admin-list">{shown.map(row=><article className="request-admin-card" key={row.id}>
      <div className="request-admin-card-head"><div><span className="request-doc-icon"><FileCheck2 size={21}/></span><div><h2>{requestTitle(row)}</h2><p>{row.candidate_name} · {row.student_email}</p></div></div><span className={`request-status ${row.status}`}>{requestStatus(row.status)}</span></div>
      <dl className="request-facts"><div><dt>Batch</dt><dd>{row.batch_name||'—'}</dd></div><div><dt>Programme / role</dt><dd>{row.kind==='certificate'?row.program_name:row.designation}</dd></div><div><dt>Start date</dt><dd>{row.start_date}</dd></div><div><dt>End date</dt><dd>{row.end_date}</dd></div></dl>
      {row.kind==='certificate'&&row.certificate_type==='Internship Completion'&&row.designation&&<p className="request-student-note"><strong>Requested internship domain / role</strong>{row.designation}</p>}
      {row.details&&<p className="request-student-note"><strong>Student message</strong>{row.details}</p>}{row.admin_note&&<p className="request-student-note"><strong>Admin message</strong>{row.admin_note}</p>}
      {row.status!=='declined'&&<div className="request-admin-actions"><button className="request-primary" disabled={busy} onClick={()=>void open(row)}>{row.published_at?'Preview / download PDF':'Open request'}</button></div>}
    </article>)}</div>:<p className="request-empty">{requests.length?'No requests match these filters.':'No document requests yet.'}</p>}
    {selected&&<ReviewDialog busy={busy} onClose={()=>{setSelected(null);setError('');}}>
      <div className="request-review-summary"><h2>Review {selected.row.kind==='certificate'?'certificate':'offer letter'}</h2><p>{selected.row.candidate_name} · {selected.row.student_email}</p><p>Check the preview. Approve and send makes this exact document available to the student.</p>{selected.row.kind==='certificate'&&selected.row.designation&&<p><strong>Requested internship domain / role:</strong> {selected.row.designation}</p>}{selected.row.details&&<p><strong>Student message:</strong> {selected.row.details}</p>}</div>
      {selected.row.student_code&&<p className="request-help">Student ID: <strong>{selected.row.student_code}</strong></p>}
      {selected.row.requested_start_date&&<div className="request-date-comparison"><div><strong>Batch dates</strong><span>{selected.row.start_date} – {selected.row.end_date}</span></div><div><strong>Dates requested by student</strong><span>{selected.row.requested_start_date} – {selected.row.requested_end_date}</span></div></div>}
      {error&&<p className="request-error" role="alert">{error}</p>}
      <Suspense fallback={<p role="status">Opening document…</p>}>{renderReview(selected.row,selected.saved,approve)}</Suspense>
      <div className="request-review-footer"><label>Message to student (optional unless declining)<textarea disabled={busy} rows={2} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/></label><button className="request-danger" disabled={busy} onClick={()=>void decline()}>Decline request</button></div>
    </ReviewDialog>}
    {preview&&<Suspense fallback={<p role="status">Opening document…</p>}><DocumentPreviewDialog content={preview} onClose={()=>setPreview(null)}/></Suspense>}
  </div>;
}
function ReviewDialog({children,busy,onClose}:{children:React.ReactNode;busy:boolean;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="request-review-dialog" aria-label="Review document request" onCancel={event=>{if(busy)event.preventDefault();}} onClose={onClose}><button className="outline-button request-review-close" disabled={busy} aria-label="Close request" onClick={()=>ref.current?.close()}><X size={18}/></button>{children}</dialog>;
}
