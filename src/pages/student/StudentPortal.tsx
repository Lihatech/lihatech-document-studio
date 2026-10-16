import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, CircleUserRound, ExternalLink, GraduationCap, LayoutDashboard, LogOut, LockKeyhole, RefreshCw, Video, X } from 'lucide-react';
import { batchDateLabel, displayDate, lmsApi, openMaterial, rpc, type Row, type StudentHome } from '../../lib/lms';
import { materialPreviewUrl } from '../../lib/materialPreview';
import { StudioLink } from '../../components/layout/DocumentNavigation';
import MockCalendar from '../../components/lms/MockCalendar';
import StudentProfileForm, { type StudentProfileValues } from '../../components/lms/StudentProfileForm';
import '../../styles/student.css';

const navItems = [
  {path:'/student',label:'Overview',icon:LayoutDashboard},
  {path:'/student/learning',label:'My learning',icon:BookOpen},
  {path:'/student/mocks',label:'Mock interviews',icon:CalendarDays},
  {path:'/student/profile',label:'My profile',icon:CircleUserRound},
];
type MaterialViewer = { title: string; loading?: boolean; kind?: 'pdf' | 'image' | 'link' | 'unsupported'; url?: string; blob?: Blob; error?: string };
const PdfMaterialPreview = React.lazy(() => import('../../components/lms/PdfMaterialPreview'));
// Reuses the LihaTech Learn sidebar, hero, cards and responsive styles from lihatech-lms.
export default function StudentPortal({path,navigate,onLogout}:{path:string;navigate:(path:string)=>void;onLogout:()=>void}) {
  const [data,setData] = useState<StudentHome|null>(null);
  const [error,setError] = useState(''),[actionError,setActionError] = useState(''),[busy,setBusy] = useState(false),[notice,setNotice] = useState('');
  const [batch,setBatch] = useState('all');
  const [editingProfile,setEditingProfile] = useState(false);
  const mounted=useRef(true), request=useRef(0);
  const [viewer,setViewer]=useState<MaterialViewer|null>(null);
  const viewerDialog=useRef<HTMLDialogElement>(null), viewerRequest=useRef(0), viewerBlobUrl=useRef<string|null>(null), viewerTrigger=useRef<HTMLButtonElement|null>(null);
  async function reload() {
    const sequence=++request.current;
    try {const result=await rpc<StudentHome>('lms_student_home');if(mounted.current&&sequence===request.current){setData(result);setError('');}}
    catch(e){if(mounted.current&&sequence===request.current){setData(null);setError(e instanceof Error?e.message:'Could not load your learning space.');}}
  }
  useEffect(()=>{
    mounted.current=true;void reload();
    const timer=window.setInterval(()=>void reload(),30000);
    const focus=()=>void reload();window.addEventListener('focus',focus);
    return()=>{mounted.current=false;window.clearInterval(timer);window.removeEventListener('focus',focus);if(viewerBlobUrl.current)URL.revokeObjectURL(viewerBlobUrl.current);};
  },[]);
  useEffect(()=>{document.title=`${navItems.find(n=>n.path===path)?.label??'Overview'} | LihaTech Learn`;document.getElementById('student-content')?.focus({preventScroll:true});},[path]);
  async function action(fn:()=>Promise<unknown>,message:string) {
    setBusy(true);setActionError('');setNotice('');
    try{await fn();setNotice(message);await reload();return true;}catch(e){setActionError(e instanceof Error?e.message:'The action could not be completed.');return false;}finally{setBusy(false);}
  }
  async function saveProfile(values:StudentProfileValues) {
    if(await action(()=>rpc('lms_save_student_profile',{p_profile:values}),'Profile saved.')) setEditingProfile(false);
  }
  function closeViewer() {viewerDialog.current?.close();}
  function viewerClosed() {
    viewerRequest.current++;
    if(viewerBlobUrl.current) URL.revokeObjectURL(viewerBlobUrl.current);
    viewerBlobUrl.current=null;
    setViewer(null);
    viewerTrigger.current?.focus();
  }
  function openViewerTab() {
    if (!viewer) return;
    const url=viewer.blob ? URL.createObjectURL(viewer.blob) : viewer.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
  async function open(row:Row,button:HTMLButtonElement) {
    const sequence=++viewerRequest.current;
    viewerTrigger.current=button;
    setViewer({title:row.title,loading:true});
    viewerDialog.current?.showModal();
    try {
      const material=await openMaterial(row.id);
      if(sequence!==viewerRequest.current) return;
      if(material.url) setViewer({title:row.title,kind:'link',url:materialPreviewUrl(material.url)});
      else if(material.blob?.type==='application/pdf') setViewer({title:row.title,kind:'pdf',blob:material.blob});
      else if(material.blob?.type.startsWith('image/')) {
        const url=URL.createObjectURL(material.blob);
        viewerBlobUrl.current=url;
        setViewer({title:row.title,kind:'image',url,blob:material.blob});
      } else setViewer({title:row.title,kind:'unsupported'});
    } catch(e) {
      if(sequence===viewerRequest.current) setViewer({title:row.title,error:e instanceof Error?e.message:'This material could not be opened.'});
    }
  }
  const enrollments=data?.enrollments??[], student=data?.student;
  const selectedEnrollments=enrollments.filter(e=>path!=='/student/learning'||batch==='all'||e.batch_id===batch);
  const selectedEligible=selectedEnrollments.filter(e=>e.accessible);
  const closed=selectedEnrollments.filter(e=>e.batch_end_date && data && Date.parse(`${e.batch_end_date}T18:30:00Z`)<=Date.parse(data.server_time));
  const materials=(data?.materials??[]).filter(m=>path!=='/student/learning'||batch==='all'||m.batch_id===batch);
  const materialMap = new Map<string,Row>();
  for (const material of materials) if (!materialMap.has(material.id) || material.accessible) materialMap.set(material.id,material);
  const uniqueMaterials=[...materialMap.values()];
  const bookings=data?.bookings??[];
  const nextInterview=bookings.filter(b=>['requested','approving','booked'].includes(b.status)&&Date.parse(b.starts_at)>Date.now()).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0];
  const featuredMaterials=uniqueMaterials.filter(m=>m.accessible).slice(0,3);
  const initials=(student?.full_name??'Student').split(' ').slice(0,2).map((n:string)=>n[0]).join('');
  const batchName=(id:string)=>enrollments.find(e=>e.batch_id===id)?.name??'Your batch';
  const overview=path==='/student'||!navItems.some(n=>n.path===path);
  return <div className="student-portal"><div className="app-shell">
    <a className="student-skip" href="#student-content">Skip to learning content</a>
    <aside className="sidebar"><div className="brand-lockup"><img src="/lihatech-logo-official.png" alt="LihaTech"/><div><strong>LihaTech</strong><span>LEARN</span></div></div><div className="sidebar-label">LEARNING SPACE</div>
      <nav className="sidebar-nav" aria-label="Student navigation">{navItems.filter(item=>item.path!=='/student/profile').map(({path:p,label,icon:Icon})=><StudioLink key={p} href={p} navigate={navigate} className={`nav-item ${path===p?'active':''}`}><Icon size={18}/><span>{label}</span></StudioLink>)}</nav>
      <div className="sidebar-bottom"><StudioLink href="/student/profile" navigate={navigate} className={`student-sidebar-profile ${path==='/student/profile'?'active':''}`}><span className="avatar">{initials}</span><span className="student-sidebar-profile-name"><strong>{student?.full_name??'Student'}</strong><small>View your profile</small></span><ChevronRight size={17}/></StudioLink><button className="nav-item student-signout" onClick={onLogout}><LogOut size={17}/>Sign out</button></div>
    </aside>
    <div className="app-main"><header className="topbar"><strong>LihaTech Learn</strong><div className="topbar-actions"><button className="icon-button" disabled={busy} onClick={reload} aria-label="Refresh learning data"><RefreshCw size={20}/></button><StudioLink href="/student/profile" navigate={navigate} className="topbar-profile" aria-label="Open your profile"><span className="avatar">{initials}</span><div><strong>{student?.full_name??'Student'}</strong><small>My profile</small></div></StudioLink></div></header>
      <nav className="student-mobile-nav" aria-label="Student navigation">{navItems.map(({path:p,label,icon:Icon})=><StudioLink key={p} href={p} navigate={navigate} className={path===p?'active':''}><Icon size={18}/><span>{label}</span></StudioLink>)}</nav>
      <main id="student-content" tabIndex={-1} className="page-content">
        {error && <div role="alert" className="student-error">{error}<button className="outline-button" onClick={reload}>Retry</button></div>}
        {actionError && <div role="alert" className="student-error">{actionError}<button className="outline-button" onClick={()=>setActionError('')}>Dismiss</button></div>}
        {notice && <p role="status" className="student-notice">{notice}</p>}
        {!data&&!error&&<p role="status">Loading your learning space…</p>}
        {data && <>
          <div className="page-header"><div><p className="eyebrow">LIHATECH LEARN</p><h1>{overview?`Welcome, ${student.full_name.split(' ')[0]}.`:navItems.find(n=>n.path===path)?.label}</h1><p className="page-intro">{path==='/student/mocks'?'Choose a date and one-hour time slot. Admin will confirm and send the Meet invitation.':path==='/student/learning'?'Materials shared with your batches appear here during their access period.':overview?'Open your materials and manage your mock interviews in one place.':'Your registered details and batch access.'}</p></div>
            {path==='/student/learning'&&<label className="student-batch-filter">Batch<select value={batch} onChange={e=>setBatch(e.target.value)}><option value="all">All my batches</option>{enrollments.map(e=><option value={e.batch_id} key={e.batch_id}>{e.name}</option>)}</select></label>}
          </div>
          {!student.profile_completed_at ? <StudentProfileForm student={student} firstLogin busy={busy} onSave={saveProfile}/> : <>
          {student.status!=='active' && <section className="panel"><h2>Your account is {student.status}</h2><p>Contact admin to review or restore your access.</p></section>}
          {student.status==='active'&&!selectedEligible.length && path!=='/student/mocks' && <section className="panel" role="status"><h2>{closed.length===selectedEnrollments.length&&closed.length?`Your ${closed.length===1?'batch has':'batches have'} closed`:enrollments.length?'No active batch access':'No batch assigned yet'}</h2><p>{closed.length===selectedEnrollments.length&&closed.length?'The batch end date has passed. Materials are no longer available. Contact admin if you need more time.':'Check your batch access dates below, or contact admin.'}</p></section>}
          {overview && <><section className="student-home-hero"><div className="student-home-hero-content"><span className="student-home-kicker"><Video size={16}/> YOUR NEXT INTERVIEW</span><h2>{nextInterview ? nextInterview.status==='booked'?'Your interview is confirmed.':'Your request is in progress.':'Ready for a practice interview?'}</h2><p>{nextInterview?`${displayDate(nextInterview.starts_at)} · ${nextInterview.status==='booked'?'Your Meet link is ready when it is time to join.':'We will show the Meet link here after admin confirms.'}`:'Choose a one-hour slot that works for you. We will confirm it and send a Google Meet invitation.'}</p><div className="student-home-actions">{nextInterview?.status==='booked'&&nextInterview.meeting_url&&<a className="student-home-join" href={nextInterview.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={17}/> Join interview <ExternalLink size={15}/></a>}<button className="student-home-secondary" onClick={()=>navigate('/student/mocks')}>{nextInterview?'View interview calendar':'Request an interview'} <ChevronRight size={17}/></button></div></div><div className="student-home-hero-art" aria-hidden="true"><CalendarDays size={76}/></div></section><div className="student-home-layout"><section className="panel student-home-materials"><div className="student-home-section-head"><div><span className="student-home-section-kicker">YOUR LIBRARY</span><h2>Materials for you</h2></div><button className="student-home-text-link" onClick={()=>navigate('/student/learning')}>View all <ChevronRight size={17}/></button></div>{featuredMaterials.length?<div className="student-home-material-list">{featuredMaterials.map(m=><article className="student-home-material" key={m.id}><span className="student-home-material-icon"><BookOpen size={20}/></span><div><strong>{m.title}</strong><small>{batchName(m.batch_id)} · {m.kind==='link'?'Drive / web link':'Private file'}</small></div><button type="button" onClick={e=>void open(m,e.currentTarget)} aria-label={`Open ${m.title}`}><ExternalLink size={18}/></button></article>)}</div>:<div className="student-home-empty"><BookOpen size={24}/><p>No materials are available right now. Check your batch access or ask admin when the next materials will be released.</p></div>}</section><section className="panel student-home-shortcuts"><span className="student-home-section-kicker">QUICK ACCESS</span><h2>Keep moving</h2><button onClick={()=>navigate('/student/learning')}><BookOpen size={19}/><span><strong>Study materials</strong><small>Open files and Drive links</small></span><ChevronRight size={18}/></button><button onClick={()=>navigate('/student/mocks')}><CalendarDays size={19}/><span><strong>Mock interviews</strong><small>Choose a time or check your request</small></span><ChevronRight size={18}/></button><button onClick={()=>navigate('/student/profile')}><CircleUserRound size={19}/><span><strong>Your profile</strong><small>Review your details and access</small></span><ChevronRight size={18}/></button></section></div><section className="panel student-batches"><div className="student-home-section-head"><div><span className="student-home-section-kicker">ACCESS</span><h2>Your batches</h2></div><GraduationCap size={21}/></div>{enrollments.map(e=><Enrollment key={e.batch_id} row={e} serverTime={data.server_time}/>)}{!enrollments.length&&<p>No batches assigned yet. Contact admin.</p>}</section></>}
          {path==='/student/learning' && <>
            <div className="course-grid">{uniqueMaterials.map(m=><article className="course-card" key={m.id}><div className="course-card-cover blue"><BookOpen size={24}/><span>{m.module_name||'Learning material'}</span></div><div className="course-card-body"><h2>{m.title}</h2><p>{m.description}</p><p>{batchName(m.batch_id)} · {m.kind==='link'?'External link':'Private file'}</p>
              {m.accessible?<div className="student-card-actions"><button className="primary-button" disabled={busy} onClick={e=>void open(m,e.currentTarget)}>Open material <ChevronRight size={17}/></button></div>:<p className="student-locked"><LockKeyhole size={16}/>{m.available_from&&Date.parse(m.available_from)>Date.parse(data.server_time)?`Available from ${displayDate(m.available_from)}.`:m.expires_at&&Date.parse(m.expires_at)<=Date.parse(data.server_time)?`Access ended ${displayDate(m.expires_at)}.`:'Unavailable for your batch. Contact admin if needed.'}</p>}
            </div></article>)}</div>{!uniqueMaterials.length&&<p className="panel">No published materials for this selection yet.</p>}
          </>}
          {path==='/student/mocks' && <MockCalendar bookings={bookings} busy={busy}
            loadDay={day=>lmsApi(`/student/mocks/availability?day=${day}`,'GET')}
            loadMonth={month=>lmsApi(`/student/mocks/month?month=${month}`,'GET')}
            onRequest={startsAt=>action(()=>lmsApi('/student/mocks/request','POST',{starts_at:startsAt}),'Request sent. Admin will review it.')}
            onCancel={booking=>void action(()=>lmsApi(`/student/mocks/${booking.id}/cancel`),booking.status==='requested'?'Request withdrawn.':'Interview cancelled.')}/>}
          {path==='/student/profile' && (editingProfile ? <StudentProfileForm student={student} firstLogin={false} busy={busy} onSave={saveProfile} onCancel={()=>setEditingProfile(false)}/> : <section className="profile-layout"><div className="panel profile-card"><div className="profile-hero"><span className="avatar large">{initials}</span><div><h2>{student.full_name}</h2><p>{student.email}</p><span className="pill blue">{student.status.toUpperCase()} STUDENT</span></div></div><div className="student-profile-summary"><h3>Your details</h3><button className="outline-button" onClick={()=>setEditingProfile(true)}>Edit details</button></div><dl className="student-profile-details"><div><dt>Phone</dt><dd>{student.phone||'Not shared'}</dd></div><div><dt>Address</dt><dd>{student.address||'Not shared'}</dd></div><div><dt>About you</dt><dd>{student.profile_type==='student'?'Student':student.profile_type==='working'?'Professional':'Not shared'}</dd></div>{student.profile_type==='student'&&<><div><dt>College</dt><dd>{student.college_name||'Not shared'}</dd></div><div><dt>Branch / field of study</dt><dd>{student.department||'Not shared'}</dd></div><div><dt>College location</dt><dd>{student.college_location||'Not shared'}</dd></div></>}{student.profile_type==='working'&&<><div><dt>Company</dt><dd>{student.office_name||'Not shared'}</dd></div><div><dt>Position</dt><dd>{student.job_title||'Not shared'}</dd></div><div><dt>Company location</dt><dd>{student.office_location||'Not shared'}</dd></div></>}</dl><h2>Batch access</h2>{enrollments.map(e=><Enrollment key={e.batch_id} row={e} serverTime={data.server_time}/>)}<button className="outline-button" onClick={onLogout}><LogOut size={18}/>Sign out</button></div><section className="panel"><h2>Need a change?</h2><p>You can update these optional details any time. Contact admin to change your registered email, batch assignment or access dates.</p></section></section>)}
          </>}
        </>}
      </main>
    </div>
    <dialog ref={viewerDialog} className="student-material-dialog" aria-label={viewer?.title??'Learning material'} onClose={viewerClosed}>
      <div className="student-material-head"><h2>{viewer?.title??'Learning material'}</h2><div className="student-material-head-actions">{viewer?.kind&&viewer.kind!=='unsupported'&&<button className="outline-button" type="button" onClick={openViewerTab}><ExternalLink size={16}/>Open in new tab</button>}<button className="icon-button" type="button" onClick={closeViewer} aria-label="Close material preview"><X size={22}/></button></div></div>
      {viewer?.loading?<p role="status" className="student-material-message">Opening material…</p>:viewer?.error?<p role="alert" className="student-material-message">{viewer.error}</p>:viewer?.kind==='pdf'&&viewer.blob?<React.Suspense fallback={<p role="status" className="student-material-message">Preparing PDF preview…</p>}><PdfMaterialPreview blob={viewer.blob}/></React.Suspense>:viewer?.kind==='image'?<div className="student-material-image"><img src={viewer.url} alt={viewer.title}/></div>:viewer?.kind==='link'?<><iframe className="student-material-frame" src={viewer.url} title={viewer.title} sandbox="allow-scripts allow-same-origin allow-forms"/><p className="student-material-hint">If this stays blank, the linked site may not allow previews inside the LMS. Ask your admin for a previewable link.</p></>:viewer?.kind==='unsupported'?<p className="student-material-message">This file type cannot be previewed in the browser. Ask your admin for a PDF or previewable Drive link.</p>:null}
    </dialog>
  </div></div>;
}
function Enrollment({row,serverTime}:{row:Row;serverTime:string;key?:string}) {const earlier=row.individual_expires_at&&(!row.expires_at||new Date(row.individual_expires_at).getTime()<=new Date(row.expires_at).getTime());const closed=row.batch_end_date&&Date.parse(`${row.batch_end_date}T18:30:00Z`)<=Date.parse(serverTime);const ended=row.individual_expires_at&&Date.parse(row.individual_expires_at)<=Date.parse(serverTime);return <article className="student-booking"><h3>{row.name}</h3><p>{row.accessible?'Access active':row.left_at?'Batch access removed':closed?'Batch closed':ended?'Your batch access has ended':row.status==='active'?'Not currently available':row.status} · {row.batch_status}</p><p>Starts {displayDate(row.starts_at)} · ends {earlier?displayDate(row.individual_expires_at):row.batch_end_date?batchDateLabel(row.batch_end_date):displayDate(row.expires_at)}</p></article>;}
