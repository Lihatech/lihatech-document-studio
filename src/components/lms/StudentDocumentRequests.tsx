import React, { useEffect, useState, type FormEvent } from 'react';
import { Award, FileText, RefreshCw, Send } from 'lucide-react';
import { batchDateLabel, rpc, type Row } from '../../lib/lms';
import { requestStatus, requestTitle, type DocumentRequest } from '../../lib/documentRequests';
import ListFilters from './ListFilters';

export default function StudentDocumentRequests({ student, enrollment }: { student: Row; enrollment?: Row }) {
  const [kind, setKind] = useState<DocumentRequest['kind']>('certificate');
  const [details, setDetails] = useState('');
  const [suggesting,setSuggesting] = useState<string|null>(null),[suggestion,setSuggestion] = useState('');
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [query, setQuery] = useState(''), [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function reload() {
    setLoading(true); setError('');
    try { setRequests(await rpc<DocumentRequest[]>('lms_student_document_requests')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  const configured = !!enrollment?.course_name && !!enrollment?.batch_start_date && !!enrollment?.batch_end_date
    && !enrollment?.left_at && enrollment?.status !== 'revoked' && enrollment?.batch_status !== 'cancelled'
    && (kind === 'certificate' || !!enrollment?.offer_type && !!enrollment?.designation && !!enrollment?.document_department);
  const shown = requests.filter(row => (status === 'all' || row.status === status)
    && `${requestTitle(row)} ${row.candidate_name} ${row.admin_note}`.toLowerCase().includes(query.toLowerCase()));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      await rpc('lms_request_document', { p_request: { kind, details } });
      setRequests(await rpc<DocumentRequest[]>('lms_student_document_requests'));
      setDetails(''); setNotice('Request sent. Admin will review your details and any suggested corrections.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your request.'); }
    finally { setBusy(false); }
  }
  return <div className="document-request-page">
    <section className="panel request-form-panel">
      <div className="request-panel-intro"><span className="request-panel-icon"><FileText size={24}/></span><div><h2>Request your document</h2><p>Your profile and batch supply the official details. Admin reviews and prepares the final document.</p></div></div>
      <div className="request-kind-grid" role="group" aria-label="Document type">
        <button type="button" className={kind === 'certificate' ? 'selected' : ''} aria-pressed={kind === 'certificate'} onClick={() => setKind('certificate')}><Award size={23}/><strong>Certificate</strong><small>For your assigned programme</small></button>
        <button type="button" className={kind === 'offer_letter' ? 'selected' : ''} aria-pressed={kind === 'offer_letter'} onClick={() => setKind('offer_letter')}><FileText size={23}/><strong>Offer letter</strong><small>Using the offer details set by admin</small></button>
      </div>
      <form onSubmit={submit} className="request-form">
        <div className="request-official-details"><h3>Details from your profile and batch</h3><dl className="request-facts">
          <div><dt>Full name</dt><dd>{student.full_name}</dd></div><div><dt>Registered email</dt><dd>{student.email}</dd></div>
          <div><dt>Batch</dt><dd>{enrollment?.name || 'Not assigned'}</dd></div><div><dt>Course / programme</dt><dd>{enrollment?.course_name || 'Admin setup needed'}</dd></div>
          <div><dt>Start date</dt><dd>{batchDateLabel(enrollment?.batch_start_date)}</dd></div><div><dt>End date</dt><dd>{batchDateLabel(enrollment?.batch_end_date)}</dd></div>
          {kind === 'certificate' ? <div><dt>Certificate type</dt><dd>{enrollment?.certificate_type || 'Course Completion'}</dd></div> : <>
            <div><dt>Offer type</dt><dd>{enrollment?.offer_type || 'Admin setup needed'}</dd></div><div><dt>Role</dt><dd>{enrollment?.designation || 'Admin setup needed'}</dd></div><div><dt>Department / domain</dt><dd>{enrollment?.document_department || 'Admin setup needed'}</dd></div>
          </>}
          {student.college_name && <div><dt>College</dt><dd>{student.college_name}</dd></div>}
        </dl></div>
        {!configured && <p className="request-error">Your batch or document details need admin setup before you can request this document.</p>}
        <label>Suggested corrections or a message to admin (optional)<textarea maxLength={1000} rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Tell admin if a name, date or other detail needs correction."/></label>
        <p className="request-help">Suggestions are reviewed by admin. They do not change the official details shown above.</p>
        {error && <p className="request-error" role="alert">{error}</p>}{notice && <p className="request-notice" role="status">{notice}</p>}
        <button className="primary-button" disabled={busy || !configured} type="submit"><Send size={17}/>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </section>
    <section className="panel request-history"><div className="request-history-heading"><h2>Your requests <span>{requests.length}</span></h2><button type="button" onClick={() => void reload()} disabled={loading} aria-label="Refresh document requests"><RefreshCw size={18}/></button></div>
      <ListFilters query={query} onQuery={setQuery} placeholder="Search your requests" filters={[{label:'Status',value:status,onChange:setStatus,options:[{value:'all',label:'All statuses'},...(['pending','approved','declined','fulfilled'] as const).map(value=>({value,label:requestStatus(value)}))]}]}/>
      {loading ? <p>Loading your requests…</p> : shown.length ? <div className="request-history-list">{shown.map(row => <article key={row.id}><div><strong>{requestTitle(row)}</strong><small>Sent {new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(row.created_at))}</small></div><span className={`request-status ${row.status}`}>{requestStatus(row.status)}</span><p>{row.candidate_name} · {batchDateLabel(row.start_date??undefined)} – {batchDateLabel(row.end_date??undefined)}</p>{row.details && <p>Your suggestion: {row.details}</p>}{row.admin_note && <p>Admin note: {row.admin_note}</p>}{['pending','approved'].includes(row.status)&&(suggesting===row.id?<form className="request-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await rpc('lms_suggest_document_correction',{p_id:row.id,p_suggestion:suggestion});setSuggesting(null);await reload();setNotice('Suggestion sent to admin. Official details stay unchanged until reviewed.');}catch(e){setError(e instanceof Error?e.message:'Could not send suggestion.');}finally{setBusy(false);}}}><label>Correction suggestion<textarea required maxLength={1000} value={suggestion} onChange={e=>setSuggestion(e.target.value)}/></label>{error&&<p className="request-error" role="alert">{error}</p>}<div className="request-admin-actions"><button type="submit" disabled={busy}>Send suggestion</button><button type="button" onClick={()=>setSuggesting(null)}>Cancel</button></div></form>:<button className="outline-button" type="button" onClick={()=>{setError('');setSuggesting(row.id);setSuggestion(row.details);}}>Suggest a correction</button>)}</article>)}</div> : <p>{requests.length ? 'No requests match your filters.' : 'Your requests will appear here after you send one.'}</p>}
    </section>
  </div>;
}
