import React, { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Award, Download, Eye, FileText, RefreshCw, Send } from 'lucide-react';
import { batchDateLabel, rpc, type Row } from '../../lib/lms';
import { requestStatus, requestTitle, type DocumentRequest } from '../../lib/documentRequests';
import ListFilters from './ListFilters';
import { StudentIdentityFields } from './StudentProfileForm';
import { documentName, profileValues, type StudentProfileValues } from '../../lib/studentProfile';
import { type RequestDocumentContent } from '../../lib/requestDocumentPreview';

const DocumentPreviewDialog=React.lazy(()=>import('./RequestDocumentPreview').then(module=>({default:module.DocumentPreviewDialog})));

export default function StudentDocumentRequests({ student, enrollment, onProfileSaved }: { student: Row; enrollment?: Row; onProfileSaved?: () => Promise<void> }) {
  const [certificateType,setCertificateType]=useState<'Course Completion'|'Internship Completion'>(()=>enrollment?.certificate_type==='Internship Completion'?'Internship Completion':'Course Completion');
  const [domain,setDomain]=useState<string>(enrollment?.designation||'');
  const [personal,setPersonal] = useState(()=>profileValues(student));
  const changePersonal=(key:keyof StudentProfileValues,value:string)=>setPersonal(current=>({...current,[key]:value}));
  const [suggesting,setSuggesting] = useState<string|null>(null),[suggestion,setSuggestion] = useState('');
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [query, setQuery] = useState(''), [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [viewer,setViewer]=useState<{content:RequestDocumentContent;downloadOnOpen?:boolean}|null>(null),[opening,setOpening]=useState<string|null>(null);
  const [downloadError,setDownloadError]=useState('');
  async function openPublished(row:DocumentRequest,downloadOnOpen=false) {
    setOpening(row.id);setDownloadError('');
    try {setViewer({content:await rpc<RequestDocumentContent>('lms_request_document_content',{p_id:row.id}),downloadOnOpen});}
    catch(e){setDownloadError(e instanceof Error?e.message:'Could not open your document.');}
    finally{setOpening(null);}
  }
  async function reload() {
    setLoading(true); setError('');
    try { setRequests(await rpc<DocumentRequest[]>('lms_student_document_requests')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void reload();const openNotification=()=>void reload();window.addEventListener('lihatech-notification-open',openNotification);return()=>window.removeEventListener('lihatech-notification-open',openNotification);},[]);
  const missingSetup = [!enrollment?.course_name?.trim() && 'course / programme name'].filter(Boolean) as string[];
  const assignmentAvailable = !!enrollment && !enrollment.left_at && enrollment.status !== 'revoked' && enrollment.batch_status !== 'cancelled';
  const configured = assignmentAvailable && missingSetup.length === 0;
  const shown = requests.filter(row => (status === 'all' || row.status === status)
    && `${requestTitle(row)} ${row.candidate_name} ${row.admin_note}`.toLowerCase().includes(query.toLowerCase()));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      await rpc('lms_request_document', { p_request: { kind:'certificate', certificate_type:certificateType, designation:certificateType==='Internship Completion'?domain.trim():'', profile:{salutation:profileValues(personal).salutation,full_name:profileValues(personal).full_name} } });
      await onProfileSaved?.();
      setRequests(await rpc<DocumentRequest[]>('lms_student_document_requests'));
      setNotice('Request sent. Admin will review and approve your certificate.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your request.'); }
    finally { setBusy(false); }
  }
  return <div className="document-request-page">
    <section className="panel request-form-panel">
      <div className="request-panel-intro"><span className="request-panel-icon"><FileText size={24}/></span><div><h2>Request your document</h2><p>Confirm your title and name, then choose your completion certificate. After approval, preview and download your PDF below.</p></div></div>
      <div className="request-kind-grid" role="group" aria-label="Document type">
        <button type="button" className={certificateType === 'Course Completion' ? 'selected' : ''} aria-pressed={certificateType === 'Course Completion'} onClick={() => setCertificateType('Course Completion')}><Award size={23}/><strong>Course completion</strong><small>For your assigned course</small></button>
        <button type="button" className={certificateType === 'Internship Completion' ? 'selected' : ''} aria-pressed={certificateType === 'Internship Completion'} onClick={() => setCertificateType('Internship Completion')}><FileText size={23}/><strong>Internship completion</strong><small>For your internship domain or role</small></button>
      </div>
      <form onSubmit={submit} className="request-form">
        {student.student_code&&<p className="request-help">Your student ID: <strong>{student.student_code}</strong></p>}
        <section className="request-personal-details"><h3>Name on your certificate</h3><p className="request-help">Correct your title or name if needed. No other profile details are required here.</p><StudentIdentityFields values={personal} change={changePersonal}/><p className="request-help">Name on document: <strong>{documentName(personal)||'Enter your full name'}</strong>. Name spacing and all-lowercase or all-uppercase names are cleaned up automatically. Check the spelling before sending.</p></section>
        {certificateType==='Internship Completion'&&<label>Internship domain / role <strong>Required</strong><input required maxLength={120} value={domain} onChange={event=>setDomain(event.target.value)} placeholder="e.g. Web Development or Developer Intern"/><span className="request-help">Admin will check this before approving your internship certificate.</span></label>}
        <section className="request-personal-details"><h3>Course</h3><p className="request-help">Your certificate will be issued for the course recorded by LihaTech.</p><dl className="request-facts"><div><dt>Course / programme</dt><dd>{enrollment?.course_name || 'Admin setup needed'}</dd></div></dl></section>
        {!configured && <p className="request-error">{!assignmentAvailable ? 'Ask admin to assign your completed course before requesting this document.' : `Ask admin to complete the course setup: ${missingSetup.join(', ')}. Your request will become available after it is saved.`}</p>}
        <p className="request-help">Your student ID is generated automatically if you do not already have one. No batch details or identity documents are required.</p>
        {error && <p className="request-error" role="alert">{error}</p>}{notice && <p className="request-notice" role="status">{notice}</p>}
        <button className="primary-button" disabled={busy || !configured} title={!configured ? 'Ask admin to complete the course setup first.' : undefined} type="submit"><Send size={17}/>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </section>
    <section className="panel request-history"><div className="request-history-heading"><h2>Your requests <span>{requests.length}</span></h2><button type="button" onClick={() => void reload()} disabled={loading} aria-label="Refresh document requests"><RefreshCw size={18}/></button></div>
      {downloadError&&<p className="request-error" role="alert">{downloadError}</p>}
      <ListFilters query={query} onQuery={setQuery} placeholder="Search your requests" filters={[{label:'Status',value:status,onChange:setStatus,options:[{value:'all',label:'All statuses'},...(['pending','approved','declined','fulfilled'] as const).map(value=>({value,label:requestStatus(value)}))]}]}/>
      {loading ? <p>Loading your requests…</p> : shown.length ? <div className="request-history-list">{shown.map(row => <article key={row.id}><div><strong>{requestTitle(row)}</strong><small>Sent {new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(row.created_at))}</small></div><span className={`request-status ${row.status}`}>{requestStatus(row.status)}</span><p>{row.candidate_name} · {batchDateLabel((row.published_at?row.start_date:row.requested_start_date??row.start_date)??undefined)} – {batchDateLabel((row.published_at?row.end_date:row.requested_end_date??row.end_date)??undefined)}</p>{row.details && <p>Your suggestion: {row.details}</p>}{row.admin_note && <p>Admin note: {row.admin_note}</p>}{row.published_at?<div className="request-student-doc-actions"><button type="button" className="outline-button" disabled={opening===row.id} onClick={()=>void openPublished(row)}><Eye size={16}/>Preview</button><button type="button" className="primary-button" disabled={opening===row.id} onClick={()=>void openPublished(row,true)}><Download size={16}/>{opening===row.id?'Opening…':'Download PDF'}</button></div>:<p className="request-help">{row.status==='approved'?'Your request is awaiting final approval. Preview and download will appear once approved.':row.status==='fulfilled'?'Contact admin for a downloadable copy of this document.':row.status==='pending'?'Your request is awaiting review. Once approved, you can preview and download the final PDF here.':''}</p>}{['pending','approved'].includes(row.status)&&(suggesting===row.id?<form className="request-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await rpc('lms_suggest_document_correction',{p_id:row.id,p_suggestion:suggestion});setSuggesting(null);await reload();setNotice('Suggestion sent to admin. Official details stay unchanged until reviewed.');}catch(e){setError(e instanceof Error?e.message:'Could not send suggestion.');}finally{setBusy(false);}}}><label>Correction suggestion<textarea required maxLength={1000} value={suggestion} onChange={e=>setSuggestion(e.target.value)}/></label>{error&&<p className="request-error" role="alert">{error}</p>}<div className="request-admin-actions"><button type="submit" disabled={busy}>Send suggestion</button><button type="button" onClick={()=>setSuggesting(null)}>Cancel</button></div></form>:<button className="outline-button" type="button" onClick={()=>{setError('');setSuggesting(row.id);setSuggestion(row.details);}}>Suggest a correction</button>)}</article>)}</div> : <p>{requests.length ? 'No requests match your filters.' : 'Your requests will appear here after you send one.'}</p>}
    </section>
    {viewer&&<Suspense fallback={<p role="status">Opening document…</p>}><DocumentPreviewDialog {...viewer} onClose={()=>setViewer(null)}/></Suspense>}
  </div>;
}
