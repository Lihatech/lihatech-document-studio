import React, { useEffect, useState } from 'react';
import { ArrowRight, FileCheck2, RefreshCw } from 'lucide-react';
import { rpc } from '../../lib/lms';
import { requestStatus, requestTitle, type DocumentRequest } from '../../lib/documentRequests';
import ListFilters from '../../components/lms/ListFilters';
import RecordForm, { type Field } from '../../components/lms/RecordForm';
import { getCertificateCategoryOptions } from '../../utils/certificateUtils';
import '../../styles/documentRequests.css';
import '../../styles/lms.css';

export default function DocumentRequestsAdmin({ onPrepare,certificateCategories=[] }: { onPrepare: (request: DocumentRequest) => void;certificateCategories?:string[] }) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [query,setQuery] = useState(''),[kindFilter,setKindFilter] = useState('all'),[statusFilter,setStatusFilter] = useState('all');
  const [editing,setEditing] = useState<DocumentRequest|null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function reload() {
    setLoading(true); setError('');
    try { setRequests(await rpc<DocumentRequest[]>('lms_admin_document_requests')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load document requests.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function review(row: DocumentRequest, status: 'approved' | 'declined' | 'fulfilled') {
    const note = notes[row.id] ?? row.admin_note ?? '';
    if (status === 'declined' && !note.trim()) { setError('Add a reason before declining a request.'); return; }
    setBusy(row.id); setError(''); setNotice('');
    try {
      await rpc('lms_review_document_request', { p_id: row.id, p_status: status, p_note: note });
      setRequests(await rpc<DocumentRequest[]>('lms_admin_document_requests'));
      setNotice(`${row.candidate_name}'s request is now ${requestStatus(status).toLowerCase()}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update this request.'); }
    finally { setBusy(null); }
  }
  const shown = requests.filter(row => (filter==='all'||row.status==='pending'||row.status==='approved')
    && (kindFilter==='all'||row.kind===kindFilter) && (statusFilter==='all'||row.status===statusFilter)
    && `${row.candidate_name} ${row.student_email} ${row.program_name} ${row.designation} ${row.batch_name??''}`.toLowerCase().includes(query.toLowerCase()));
  const editFields:Field[]=editing?[
    {key:'candidate_name',label:'Official full name',required:true},
    ...(editing.kind==='certificate'?[{key:'program_name',label:'Course / programme name',required:true},{key:'certificate_type',label:'Certificate type',required:true,options:getCertificateCategoryOptions(certificateCategories,editing.certificate_type)}]:[
      {key:'offer_type',label:'Offer type',required:true,options:['Internship Offer','Job Offer'].map(value=>({value,label:value}))},
      {key:'designation',label:'Role / designation',required:true},{key:'department',label:'Department / domain',required:true}]),
    {key:'start_date',label:'Start date',type:'date',required:true},{key:'end_date',label:'End date',type:'date',required:true}
  ]:[];
  return <div className="admin-document-requests">
    <header className="request-admin-head"><div><p className="request-kicker">LEARNING OPERATIONS</p><h1>Document requests</h1><p>Review student details, prepare documents in Studio and record when you share them.</p></div><button className="request-refresh" onClick={() => void reload()} disabled={loading}><RefreshCw size={17}/>{loading ? 'Loading…' : 'Refresh'}</button></header>
    {error && <p className="request-error" role="alert">{error}</p>}{notice && <p className="request-notice" role="status">{notice}</p>}
    <div className="request-admin-toolbar"><div><button className={filter === 'open' ? 'active' : ''} aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Needs action <span>{requests.filter(row => row.status === 'pending' || row.status === 'approved').length}</span></button><button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All requests <span>{requests.length}</span></button></div></div>
    <ListFilters query={query} onQuery={setQuery} placeholder="Search student, email, programme or batch" filters={[
      {label:'Document',value:kindFilter,onChange:setKindFilter,options:[{value:'all',label:'All documents'},{value:'certificate',label:'Certificates'},{value:'offer_letter',label:'Offer letters'}]},
      {label:'Status',value:statusFilter,onChange:value=>{setStatusFilter(value);setFilter('all');},options:[{value:'all',label:'All statuses'},...(['pending','approved','declined','fulfilled'] as const).map(value=>({value,label:requestStatus(value)}))]}
    ]}/>
    {editing&&<div key={editing.id} className="lms-workspace"><RecordForm title="Review and correct official document details" fields={editFields} initial={editing} onCancel={()=>setEditing(null)} onSave={async fields=>{
      await rpc('lms_admin_update_document_request',{p_id:editing.id,p_fields:fields});setEditing(null);await reload();setNotice('Official details updated. The student can view the corrections.');
    }}/></div>}
    {loading && !requests.length ? <p className="request-empty">Loading requests…</p> : shown.length ? <div className="request-admin-list">{shown.map(row => <article className="request-admin-card" key={row.id}>
      <div className="request-admin-card-head"><div><span className="request-doc-icon"><FileCheck2 size={21}/></span><div><h2>{requestTitle(row)}</h2><p>{row.candidate_name} · {row.student_email}</p></div></div><span className={`request-status ${row.status}`}>{requestStatus(row.status)}</span></div>
      <dl className="request-facts">{row.batch_name&&<div><dt>Batch</dt><dd>{row.batch_name}</dd></div>}<div><dt>Requested</dt><dd>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(row.created_at))}</dd></div>{row.kind === 'certificate' ? <><div><dt>Type</dt><dd>{row.certificate_type || 'Certificate'}</dd></div><div><dt>Program</dt><dd>{row.program_name}</dd></div></> : <><div><dt>Role</dt><dd>{row.designation}</dd></div><div><dt>Department</dt><dd>{row.department || row.student_department || '—'}</dd></div></>}{row.start_date && <div><dt>Start date</dt><dd>{row.start_date}</dd></div>}{row.end_date && <div><dt>End date</dt><dd>{row.end_date}</dd></div>}{row.college_name && <div><dt>College</dt><dd>{row.college_name}</dd></div>}{row.student_phone && <div><dt>Phone</dt><dd>{row.student_phone}</dd></div>}</dl>
      {row.details && <p className="request-student-note"><strong>Student suggestion / message</strong>{row.details}</p>}
      {row.status === 'pending' || row.status === 'approved' ? <div className="request-review"><label htmlFor={`request-note-${row.id}`}>Message to student {row.status === 'pending' ? '(required when declining)' : '(optional)'}</label><textarea id={`request-note-${row.id}`} maxLength={1000} rows={2} value={notes[row.id] ?? row.admin_note} onChange={e => setNotes(current => ({ ...current, [row.id]: e.target.value }))} placeholder="Add a reason or sharing instructions"/><div className="request-admin-actions"><button className="request-secondary" disabled={busy===row.id} onClick={()=>setEditing(row)}>Edit official details</button>{row.status === 'pending' ? <button className="request-primary" disabled={busy === row.id} onClick={() => void review(row, 'approved')}>Approve request</button> : <><button className="request-primary" onClick={() => { if(!row.candidate_name.trim()||!row.start_date||!row.end_date||(row.kind==='offer_letter'&&(!row.department||!row.designation))){setEditing(row);setError('Complete the official document details before preparing it.');return;} onPrepare(row); }}>Prepare in Studio <ArrowRight size={16}/></button><button className="request-secondary" disabled={busy === row.id} onClick={() => void review(row, 'fulfilled')}>Mark shared</button></>}<button className="request-danger" disabled={busy === row.id} onClick={() => void review(row, 'declined')}>Decline</button></div></div> : row.admin_note && <p className="request-student-note"><strong>Message sent to student</strong>{row.admin_note}</p>}
    </article>)}</div> : <p className="request-empty">{requests.length ? 'No requests match the selected filters.' : 'No document requests yet.'}</p>}
  </div>;
}
