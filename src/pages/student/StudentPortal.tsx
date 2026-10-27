import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, CircleUserRound, ExternalLink, FileText, GraduationCap, LayoutDashboard, LogOut, LockKeyhole, Video, X } from 'lucide-react';
import { batchDateLabel, displayDate, lmsApi, openMaterial, rpc, type Row, type StudentHome } from '../../lib/lms';
import { materialPreviewUrl } from '../../lib/materialPreview';
import { StudioLink } from '../../components/layout/DocumentNavigation';
import MockCalendar from '../../components/lms/MockCalendar';
import ListFilters from '../../components/lms/ListFilters';
import { currentEnrollment } from '../../lib/batches';
import StudentProfileForm, { type StudentProfileValues } from '../../components/lms/StudentProfileForm';
import StudentDocumentRequests from '../../components/lms/StudentDocumentRequests';
import { studentMaterialsEnabled } from '../../lib/studentFeatures';
import StudentNotifications, { NotificationBadge } from '../../components/lms/StudentNotifications';
import '../../styles/student.css';
import '../../styles/documentRequests.css';

const navItems = [
  {path:'/student',label:'Overview',icon:LayoutDashboard},
  {path:'/student/learning',label:'My learning',icon:BookOpen},
  {path:'/student/mocks',label:'Mock interviews',icon:CalendarDays},
  {path:'/student/documents',label:'Documents',icon:FileText},
  {path:'/student/profile',label:'My profile',icon:CircleUserRound},
].filter(item=>studentMaterialsEnabled||item.path!=='/student/learning');
type MaterialViewer = { title: string; loading?: boolean; kind?: 'pdf' | 'image' | 'link' | 'unsupported'; url?: string;originalUrl?:string;filename?:string; blob?: Blob; error?: string };
const PdfMaterialPreview = React.lazy(() => import('../../components/lms/PdfMaterialPreview'));
// Reuses the LihaTech Learn sidebar, hero, cards and responsive styles from lihatech-lms.
export default function StudentPortal({path:requestedPath,navigate,onLogout}:{path:string;navigate:(path:string)=>void;onLogout:()=>void}) {
  const path=!studentMaterialsEnabled&&requestedPath==='/student/learning'?'/student':requestedPath;
  useEffect(()=>{if(path!==requestedPath)navigate(path);},[requestedPath,path]);
  const [data,setData] = useState<StudentHome|null>(null);
  const [error,setError] = useState(''),[actionError,setActionError] = useState(''),[busy,setBusy] = useState(false),[notice,setNotice] = useState('');
  const [materialQuery,setMaterialQuery] = useState(''),[materialKind,setMaterialKind] = useState('all'),[materialAccess,setMaterialAccess] = useState('all');
  const [editingProfile,setEditingProfile] = useState(false);
  const [interviewDuration,setInterviewDuration] = useState(35);
  const mounted=useRef(true), request=useRef(0);
  const [viewer,setViewer]=useState<MaterialViewer|null>(null);
  const viewerDialog=useRef<HTMLDialogElement>(null), viewerRequest=useRef(0), viewerBlobUrl=useRef<string|null>(null), viewerTrigger=useRef<HTMLButtonElement|null>(null);
  const viewerRow=useRef<Row|null>(null);
  useEffect(()=>{if(!viewer)return;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;};},[!!viewer]);
  async function reload() {
    const sequence=++request.current;
    try {const result=await rpc<StudentHome>('lms_student_home');if(mounted.current&&sequence===request.current){setData(result);setError('');}}
    catch(e){if(mounted.current&&sequence===request.current){setError(e instanceof Error?e.message:'Could not load your learning space.');}}
  }
  useEffect(()=>{
    mounted.current=true;void reload();
    const timer=window.setInterval(()=>void reload(),30000);
    const focus=()=>void reload();window.addEventListener('focus',focus);window.addEventListener('lihatech-notification-open',focus);
    return()=>{mounted.current=false;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('lihatech-notification-open',focus);if(viewerBlobUrl.current)URL.revokeObjectURL(viewerBlobUrl.current);};
  },[]);
  useEffect(()=>{void rpc<number>('lms_mock_interview_duration').then(value=>{if(Number.isFinite(value)&&value>0)setInterviewDuration(value);}).catch(()=>undefined);},[]);
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
    viewerTrigger.current?.focus({preventScroll:true});
  }
  function openViewerTab() {
    if (!viewer) return;
    const url=viewer.originalUrl || viewer.url || viewerBlobUrl.current;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
  function downloadFile(){if(!viewer?.blob||!viewerBlobUrl.current)return;const link=document.createElement('a');link.href=viewerBlobUrl.current;link.download=viewer.filename||viewer.title;viewerDialog.current?.appendChild(link);link.click();link.remove();}
  async function open(row:Row,button:HTMLButtonElement) {
    const sequence=++viewerRequest.current;
    viewerTrigger.current=button;
    viewerRow.current=row;
    if(viewerBlobUrl.current)URL.revokeObjectURL(viewerBlobUrl.current);
    viewerBlobUrl.current=null;
    setViewer({title:row.title,loading:true});
    viewerDialog.current?.showModal();
    try {
      const material=await openMaterial(row.id);
      if(sequence!==viewerRequest.current) return;
      if(material.blob)viewerBlobUrl.current=URL.createObjectURL(material.blob);
      if(material.url) setViewer({title:row.title,kind:'link',url:materialPreviewUrl(material.url),originalUrl:material.url});
      else if(material.blob?.type==='application/pdf') setViewer({title:row.title,kind:'pdf',blob:material.blob,filename:material.filename});
      else if(material.blob?.type.startsWith('image/')) {
        setViewer({title:row.title,kind:'image',url:viewerBlobUrl.current!,blob:material.blob,filename:material.filename});
      } else setViewer({title:row.title,kind:'unsupported',blob:material.blob,filename:material.filename});
    } catch(e) {
      if(sequence===viewerRequest.current) setViewer({title:row.title,error:e instanceof Error?e.message:'This material could not be opened.'});
    }
  }
  const enrollments=data?.enrollments??[], student=data?.student;
  const enrollment=currentEnrollment(enrollments);
  const selectedEnrollments=enrollment?[enrollment]:[];
  const selectedEligible=selectedEnrollments.filter(e=>e.accessible);
  const notStarted=enrollment?.batch_start_date&&data&&Date.parse(`${enrollment.batch_start_date}T00:00:00+05:30`)>Date.parse(data.server_time);
  const closed=selectedEnrollments.filter(e=>e.batch_status==='completed'||e.batch_end_date && data && Date.parse(`${e.batch_end_date}T18:30:00Z`)<=Date.parse(data.server_time));
  const materials=(data?.materials??[]).filter(m=>m.batch_id===enrollment?.batch_id);
  const materialMap = new Map<string,Row>();
  for (const material of materials) if (!materialMap.has(material.id) || material.accessible) materialMap.set(material.id,material);
  const uniqueMaterials=[...materialMap.values()];
  const shownMaterials=uniqueMaterials.filter(m=>`${m.title} ${m.description??''} ${m.module_name??''}`.toLowerCase().includes(materialQuery.toLowerCase())&&(materialKind==='all'||m.kind===materialKind)&&(materialAccess==='all'||(materialAccess==='available'?m.accessible:!m.accessible)));
  const bookings=data?.bookings??[];
  const nextInterview=bookings.filter(b=>['requested','approving','booked'].includes(b.status)&&Date.parse(b.starts_at)>Date.now()).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0];
  const featuredMaterials=uniqueMaterials.filter(m=>m.accessible).slice(0,3);
  const initials=student?.profile_completed_at?(student.full_name??'Student').split(' ').slice(0,2).map((n:string)=>n[0]).join(''):'?';
  const batchName=(id:string)=>enrollments.find(e=>e.batch_id===id)?.name??'Your batch';
  const overview=path==='/student'||!navItems.some(n=>n.path===path);
  return <div className="student-portal"><div className="app-shell">
    <a className="student-skip" href="#student-content">Skip to learning content</a>
    <aside className="sidebar"><div className="brand-lockup"><img src="/lihatech-logo-official.png" alt="LihaTech"/><div><strong>LihaTech</strong><span>LEARN</span></div></div><div className="sidebar-label">LEARNING SPACE</div>
      <nav className="sidebar-nav" aria-label="Student navigation">{navItems.filter(item=>item.path!=='/student/profile').map(({path:p,label,icon:Icon})=><StudioLink key={p} href={p} navigate={navigate} className={`nav-item ${path===p?'active':''}`}><Icon size={18}/><span>{label}</span><NotificationBadge path={p}/></StudioLink>)}</nav>
      <div className="sidebar-bottom"><StudioLink href="/student/profile" navigate={navigate} className={`student-sidebar-profile ${path==='/student/profile'?'active':''}`}><span className="avatar">{initials}</span><span className="student-sidebar-profile-name"><strong>{student?.profile_completed_at?student.full_name:'Complete your profile'}</strong><small>View your profile</small></span><ChevronRight size={17}/></StudioLink><button className="nav-item student-signout" onClick={onLogout}><LogOut size={17}/>Sign out</button></div>
    </aside>
    <div className="app-main"><header className="topbar"><strong>LihaTech Learn</strong><StudentNotifications navigate={navigate}/></header>
      <nav className="student-mobile-nav" style={{gridTemplateColumns:`repeat(${navItems.length},minmax(0,1fr))`}} aria-label="Student navigation">{navItems.map(({path:p,label,icon:Icon})=><StudioLink key={p} href={p} navigate={navigate} className={path===p?'active':''}><Icon size={18}/><span>{label}</span></StudioLink>)}</nav>
      <main id="student-content" tabIndex={-1} className="page-content">
        {error && <div role="alert" className="student-error">{error}<button className="outline-button" onClick={reload}>Retry</button></div>}
        {actionError && <div role="alert" className="student-error">{actionError}<button className="outline-button" onClick={()=>setActionError('')}>Dismiss</button></div>}
        {notice && <p role="status" className="student-notice">{notice}</p>}
        {!data&&!error&&<p role="status">Loading your learning space…</p>}
        {data && <>
          <div className="page-header"><div><p className="eyebrow">LIHATECH LEARN</p><h1>{overview?(student.profile_completed_at?`Welcome, ${student.full_name.split(' ')[0]}.`:'Welcome to LihaTech Learn.'):navItems.find(n=>n.path===path)?.label}</h1><p className="page-intro">{path==='/student/mocks'?`Choose a date and ${interviewDuration}-minute time slot. Admin will confirm and send the Meet invitation.`:path==='/student/learning'?'Materials shared with your batch appear here during its access period.':path==='/student/documents'?'Request a certificate or offer letter and follow its progress here.':overview?studentMaterialsEnabled?'Open your materials and manage your mock interviews in one place.':'Manage interviews, documents and your profile in one place.':'Your registered details and batch access.'}</p></div>
            {enrollment&&path==='/student/learning'&&<span className="pill blue">{enrollment.name}</span>}
          </div>
          {!student.profile_completed_at ? <StudentProfileForm student={student} firstLogin busy={busy} onSave={saveProfile}/> : <>
          {student.status!=='active' && <section className="panel"><h2>Your account is {student.status}</h2><p>Contact admin to review or restore your access.</p></section>}
          {student.status==='active'&&!selectedEligible.length && path!=='/student/mocks' && path!=='/student/documents' && <section className="panel" role="status"><h2>{closed.length===selectedEnrollments.length&&closed.length?`Your ${closed.length===1?'batch has':'batches have'} closed`:notStarted?'Your batch starts soon':enrollments.length?'No active batch access':'No batch assigned yet'}</h2><p>{closed.length===selectedEnrollments.length&&closed.length?studentMaterialsEnabled?'The batch end date has passed. Materials are no longer available. Contact admin if you need more time.':'The batch end date has passed. Contact admin if your batch details need updating.':notStarted?`Your learning access opens on ${batchDateLabel(enrollment?.batch_start_date)} (IST).`:'Contact admin to review your batch assignment or access status.'}</p></section>}
          {overview && <><section className="student-home-hero"><div className="student-home-hero-content"><span className="student-home-kicker"><Video size={16}/> YOUR NEXT INTERVIEW</span><h2>{nextInterview ? nextInterview.status==='booked'?'Your interview is confirmed.':'Your request is in progress.':'Ready for a practice interview?'}</h2><p>{nextInterview?`${displayDate(nextInterview.starts_at)} · ${nextInterview.status==='booked'?'Your Meet link is ready when it is time to join.':'We will show the Meet link here after admin confirms.'}`:'Choose a one-hour slot that works for you. We will confirm it and send a Google Meet invitation.'}</p><div className="student-home-actions">{nextInterview?.status==='booked'&&nextInterview.meeting_url&&<a className="student-home-join" href={nextInterview.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={17}/> Join interview <ExternalLink size={15}/></a>}<button className="student-home-secondary" onClick={()=>navigate('/student/mocks')}>{nextInterview?'View interview calendar':'Request an interview'} <ChevronRight size={17}/></button></div></div><div className="student-home-hero-art" aria-hidden="true"><CalendarDays size={76}/></div></section><div className="student-home-layout" style={studentMaterialsEnabled?undefined:{gridTemplateColumns:'1fr'}}>{studentMaterialsEnabled&&<section className="panel student-home-materials"><div className="student-home-section-head"><div><span className="student-home-section-kicker">YOUR LIBRARY</span><h2>Materials for you</h2></div><button className="student-home-text-link" onClick={()=>navigate('/student/learning')}>View all <ChevronRight size={17}/></button></div>{featuredMaterials.length?<div className="student-home-material-list">{featuredMaterials.map(m=><article className="student-home-material" key={m.id}><span className="student-home-material-icon"><BookOpen size={20}/></span><div><strong>{m.title}</strong><small>{batchName(m.batch_id)} · {m.kind==='link'?'Drive / web link':'Private file'}</small></div><button type="button" onClick={e=>void open(m,e.currentTarget)} aria-label={`Open ${m.title}`}><ExternalLink size={18}/></button></article>)}</div>:<div className="student-home-empty"><BookOpen size={24}/><p>No materials are available right now. Check your batch access or ask admin when the next materials will be released.</p></div>}</section>}<section className="panel student-home-shortcuts"><span className="student-home-section-kicker">QUICK ACCESS</span><h2>Keep moving</h2>{studentMaterialsEnabled&&<button onClick={()=>navigate('/student/learning')}><BookOpen size={19}/><span><strong>Study materials</strong><small>Open files and Drive links</small></span><ChevronRight size={18}/></button>}<button onClick={()=>navigate('/student/documents')}><FileText size={19}/><span><strong>Your documents</strong><small>Request certificates and download approved PDFs</small></span><ChevronRight size={18}/></button><button onClick={()=>navigate('/student/mocks')}><CalendarDays size={19}/><span><strong>Mock interviews</strong><small>Choose a time or check your request</small></span><ChevronRight size={18}/></button><button onClick={()=>navigate('/student/profile')}><CircleUserRound size={19}/><span><strong>Your profile</strong><small>Review your details and access</small></span><ChevronRight size={18}/></button></section></div><section className="panel student-batches"><div className="student-home-section-head"><div><span className="student-home-section-kicker">ACCESS</span><h2>Your batch</h2></div><GraduationCap size={21}/></div>{selectedEnrollments.map(e=><Enrollment key={e.batch_id} row={e} serverTime={data.server_time}/>)}{!enrollments.length&&<p>No batch assigned yet. Contact admin.</p>}</section></>}
          {studentMaterialsEnabled&&path==='/student/learning' && <>
            <ListFilters query={materialQuery} onQuery={setMaterialQuery} placeholder="Search materials or sections" filters={[
              {label:'Source',value:materialKind,onChange:setMaterialKind,options:[{value:'all',label:'All sources'},{value:'file',label:'Private files'},{value:'link',label:'Drive / web links'}]},
              {label:'Access',value:materialAccess,onChange:setMaterialAccess,options:[{value:'all',label:'All materials'},{value:'available',label:'Available now'},{value:'scheduled',label:'Scheduled / unavailable'}]}
            ]}/>
            <div className="course-grid">{shownMaterials.map(m=><article className="course-card" key={m.id}><div className="course-card-cover blue"><BookOpen size={24}/><span>{m.module_name||'Learning material'}</span></div><div className="course-card-body"><h2>{m.title}</h2><p>{m.description}</p><p>{batchName(m.batch_id)} · {m.kind==='link'?'External link':'Private file'}</p>
              {m.accessible?<div className="student-card-actions"><button className="primary-button" disabled={busy} onClick={e=>void open(m,e.currentTarget)}>Open material <ChevronRight size={17}/></button></div>:<p className="student-locked"><LockKeyhole size={16}/>{m.available_from&&Date.parse(m.available_from)>Date.parse(data.server_time)?`Available from ${displayDate(m.available_from)}.`:m.expires_at&&Date.parse(m.expires_at)<=Date.parse(data.server_time)?`Access ended ${displayDate(m.expires_at)}.`:'Unavailable for your batch. Contact admin if needed.'}</p>}
            </div></article>)}</div>{!shownMaterials.length&&<p className="panel">No materials match your search or filters.</p>}
          </>}
          {path==='/student/mocks' && <MockCalendar durationMinutes={interviewDuration} bookings={bookings} busy={busy}
            loadDay={(day,bookingId)=>lmsApi(`/student/mocks/availability?day=${day}${bookingId?`&exclude_booking_id=${bookingId}`:''}`,'GET')}
            loadMonth={month=>lmsApi(`/student/mocks/month?month=${month}`,'GET')}
            loadTopics={bookingId=>lmsApi(`/student/mocks/${bookingId}/topics`,'GET')}
            onRequest={(startsAt,preparedTopics,bookingId)=>action(()=>lmsApi(bookingId?`/student/mocks/${bookingId}/reschedule`:'/student/mocks/request','POST',{starts_at:startsAt,prepared_topics:preparedTopics}),bookingId?'Reschedule request sent. Your current interview remains scheduled until admin approval.':'Request sent. Admin will review it.')}
            onCancel={booking=>void action(()=>lmsApi(`/student/mocks/${booking.id}/cancel`),booking.status==='requested'?'Request withdrawn.':'Interview cancelled.')}/>}
          {path==='/student/documents' && student.status==='active' && <StudentDocumentRequests student={student} enrollment={enrollment} onProfileSaved={reload}/>}
          {path==='/student/profile' && (editingProfile ? <StudentProfileForm student={student} firstLogin={false} busy={busy} onSave={saveProfile} onCancel={()=>setEditingProfile(false)}/> : <section className="profile-layout"><div className="panel profile-card"><div className="profile-hero"><span className="avatar large">{initials}</span><div><h2>{student.full_name}</h2><p>{student.email}</p><span className="pill blue">{student.status.toUpperCase()} STUDENT</span></div></div><div className="student-profile-summary"><h3>Your details</h3><button className="outline-button" onClick={()=>setEditingProfile(true)}>Edit details</button></div><dl className="student-profile-details"><div><dt>Phone</dt><dd>{student.phone||'Not shared'}</dd></div><div><dt>Address</dt><dd>{student.address||'Not shared'}</dd></div><div><dt>About you</dt><dd>{student.profile_type==='student'?'Student':student.profile_type==='working'?'Professional':'Not shared'}</dd></div>{student.profile_type==='student'&&<><div><dt>College</dt><dd>{student.college_name||'Not shared'}</dd></div><div><dt>Branch / field of study</dt><dd>{student.department||'Not shared'}</dd></div><div><dt>College location</dt><dd>{student.college_location||'Not shared'}</dd></div></>}{student.profile_type==='working'&&<><div><dt>Company</dt><dd>{student.office_name||'Not shared'}</dd></div><div><dt>Position</dt><dd>{student.job_title||'Not shared'}</dd></div><div><dt>Company location</dt><dd>{student.office_location||'Not shared'}</dd></div></>}</dl><h2>Batch access</h2>{selectedEnrollments.map(e=><Enrollment key={e.batch_id} row={e} serverTime={data.server_time}/>)}<button className="outline-button" onClick={onLogout}><LogOut size={18}/>Sign out</button></div><section className="panel"><h2>Need a change?</h2><p>You can update these optional details any time. Contact admin to change your registered email, batch assignment or access dates.</p></section></section>)}
          </>}
        </>}
      </main>
    </div>
    <dialog ref={viewerDialog} className="student-material-dialog" aria-label={viewer?.title??'Learning material'} onClose={viewerClosed}>
      <div className="student-material-head"><h2>{viewer?.title??'Learning material'}</h2><div className="student-material-head-actions">{viewer?.blob&&<button className="outline-button" type="button" onClick={downloadFile}>Download file</button>}{viewer?.kind&&viewer.kind!=='unsupported'&&<button className="outline-button" type="button" onClick={openViewerTab}><ExternalLink size={16}/>Open in new tab</button>}<button className="icon-button" type="button" onClick={closeViewer} aria-label="Close material preview"><X size={22}/></button></div></div>
      {viewer?.loading?<p role="status" className="student-material-message">Opening material…</p>:viewer?.error?<div role="alert" className="student-material-message"><p>{viewer.error}</p><button className="outline-button" onClick={()=>{if(viewerRow.current&&viewerTrigger.current)void open(viewerRow.current,viewerTrigger.current);}}>Retry</button></div>:viewer?.kind==='pdf'&&viewer.blob?<React.Suspense fallback={<p role="status" className="student-material-message">Preparing PDF preview…</p>}><PdfMaterialPreview blob={viewer.blob}/></React.Suspense>:viewer?.kind==='image'?<div className="student-material-image"><img src={viewer.url} alt={viewer.title}/></div>:viewer?.kind==='link'?<><iframe className="student-material-frame" src={viewer.url} title={viewer.title} sandbox="allow-scripts allow-same-origin allow-forms"/><p className="student-material-hint">Use Open in new tab if this preview stays blank or asks you to sign in. Access to a restricted Drive link must also be granted by your admin.</p></>:viewer?.kind==='unsupported'?<p className="student-material-message">This file is ready to download. Use Download file to open it in the appropriate app.</p>:null}
    </dialog>
  </div></div>;
}
function Enrollment({row,serverTime}:{row:Row;serverTime:string;key?:string}) {const earlier=row.individual_expires_at&&(!row.expires_at||new Date(row.individual_expires_at).getTime()<=new Date(row.expires_at).getTime());const closed=row.batch_status==='completed'||row.batch_end_date&&Date.parse(`${row.batch_end_date}T18:30:00Z`)<=Date.parse(serverTime);const ended=row.individual_expires_at&&Date.parse(row.individual_expires_at)<=Date.parse(serverTime);return <article className="student-booking"><h3>{row.name}</h3><p>{row.accessible?'Access active':row.left_at?'Batch access removed':closed?'Batch closed':ended?'Your batch access has ended':row.batch_status==='paused'?'Batch paused':row.status==='active'&&row.batch_start_date&&Date.parse(row.starts_at)>Date.parse(serverTime)?'Access opens on the batch start date':row.status==='active'?'Not currently available':row.status}</p><p>Starts {displayDate(row.starts_at)} · ends {earlier?displayDate(row.individual_expires_at):row.batch_end_date?batchDateLabel(row.batch_end_date):displayDate(row.expires_at)}</p></article>;}
