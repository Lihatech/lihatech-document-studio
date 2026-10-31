import { useState } from 'react';
import { History } from 'lucide-react';
import Modal from '../Modal';
import { displayDate, type Row } from '../../lib/lms';
import { interviewDay, interviewLabel, interviewRoster, interviewSummary } from '../../lib/interviewHistory';

type Props={bookings:Row[];slots:Row[];students:Row[];batches:Row[];members:Row[];batch:string;student:string;busy:boolean;onFeedback:(row:Row)=>void;onDetails:(row:Row)=>void;onReview:(row:Row)=>void};
export default function AdminInterviewHistory({bookings,slots,students,batches,members,batch,student,busy,onFeedback,onDetails,onReview}:Props){
  const [view,setView]=useState<'interviews'|'students'>('interviews'),[query,setQuery]=useState('');
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[status,setStatus]=useState('all'),[feedback,setFeedback]=useState('all');
  const [participation,setParticipation]=useState('all'),[open,setOpen]=useState(false);
  const [historyBatch,setHistoryBatch]=useState(batch),[historyStudent,setHistoryStudent]=useState(student);
  const openAction=(handler:(row:Row)=>void,row:Row)=>{setOpen(false);handler(row);};
  const roster=interviewRoster(students,members,historyBatch,historyStudent),ids=new Set(roster.map(row=>row.id));
  const records=bookings.flatMap<Row>(row=>{const slot=slots.find(slot=>slot.id===row.slot_id);return slot?[{...slot,...row,starts_at:slot.starts_at,ends_at:slot.ends_at}]:[];})
    .filter(row=>ids.has(row.student_id)&&(!from||interviewDay(row.starts_at)>=from)&&(!to||interviewDay(row.starts_at)<=to));
  const stats=interviewSummary(roster,records),now=Date.now();
  const name=(row:Row)=>row.profile_completed_at?row.full_name:row.email||row.full_name||'Student';
  const matches=(row:Row)=>`${name(row)} ${row.email} ${row.student_code||''}`.toLowerCase().includes(query.toLowerCase());
  const shown=records.filter(row=>(status==='all'||(status==='unrecorded'?row.status==='booked'&&Date.parse(row.ends_at)<now:row.status===status))&&(feedback==='all'||(feedback==='sent'?!!row.feedback?.trim():['booked','completed','no_show'].includes(row.status)&&!row.feedback?.trim()))&&matches(students.find(s=>s.id===row.student_id)||{}))
    .sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at));
  const shownStudents=roster.filter(matches).filter(row=>{
    const own=records.filter(record=>record.student_id===row.id);
    return participation==='all'||(participation==='not_completed'?!own.some(r=>r.status==='completed'):participation==='completed'?own.some(r=>r.status==='completed'):participation==='pending'?own.some(r=>['requested','approving'].includes(r.status)||(r.status==='booked'&&Date.parse(r.ends_at)>=now)):participation==='none'?!own.length:own.some(r=>r.status==='booked'&&Date.parse(r.ends_at)<now));
  });
  const choose=(value:string)=>{setView('students');setParticipation(value);};
  return <div className="interview-history-launcher">
    <button type="button" className="studio-secondary" onClick={()=>{setHistoryBatch(batch);setHistoryStudent(student);setOpen(true);}}><History size={18}/> Interview history &amp; analysis</button>
    {open&&<Modal title="Interview history & batch analysis" wide busy={busy} onClose={()=>setOpen(false)}><div className="admin-calendar interview-history-modal">
      <p className="interview-history-note">{historyBatch==='all'?'All registered students':batches.find(row=>row.id===historyBatch)?.name} · Current batch assignments; unique students, not interview totals.</p>
      <div className="interview-history-filters">
        <label>Batch<select aria-label="History batch" value={historyBatch} onChange={event=>{setHistoryBatch(event.target.value);setHistoryStudent('all');}}><option value="all">All batches</option>{batches.map(row=><option value={row.id} key={row.id}>{row.name} · {row.code}</option>)}</select></label>
        <label>Student<select aria-label="History student" value={historyStudent} onChange={event=>setHistoryStudent(event.target.value)}><option value="all">All students</option>{interviewRoster(students,members,historyBatch).map(row=><option value={row.id} key={row.id}>{name(row)} · {row.student_code}</option>)}</select></label>
      </div>
      <div className="interview-history-filters">
        <label>From date<input type="date" value={from} max={to||undefined} onChange={event=>setFrom(event.target.value)}/></label>
        <label>To date<input type="date" value={to} min={from||undefined} onChange={event=>setTo(event.target.value)}/></label>
      </div>
      {from&&to&&from>to&&<p role="alert" className="admin-calendar-conflict">The end date must be on or after the start date.</p>}
      <div className="interview-stat-grid">
        {[['all','Students',stats.total],['completed','Completed an interview',stats.completed],['not_completed','No completed interview',stats.notCompleted],['pending','Scheduled / pending',stats.pending],['none',from||to?'No interview in range':'No interview recorded',stats.none],['unrecorded','Completion unrecorded',stats.unrecorded]].map(([value,label,count])=><button type="button" key={value} onClick={()=>choose(String(value))} className={view==='students'&&participation===value?'selected':''}><strong>{count}</strong><span>{label}</span></button>)}
      </div>
      <p className="interview-history-note">Feedback: {stats.feedbackSent} sent · {stats.feedbackPending} pending (interviews). Participation groups may overlap.</p>
      <div className="interview-history-tabs" role="group" aria-label="History view"><button type="button" aria-pressed={view==='interviews'} onClick={()=>setView('interviews')}>Interview records</button><button type="button" aria-pressed={view==='students'} onClick={()=>setView('students')}>Students</button></div>
      <label className="interview-history-search">Search students<input type="search" value={query} placeholder="Name, email or student ID" onChange={event=>setQuery(event.target.value)}/></label>
      {view==='interviews'?<><div className="interview-history-filters"><label>Interview status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All statuses</option>{['requested','approving','booked','completed','no_show','cancelled','rejected','unrecorded'].map(value=><option key={value} value={value}>{value==='unrecorded'?'Past — completion unrecorded':interviewLabel({status:value})}</option>)}</select></label><label>Feedback<select value={feedback} onChange={event=>setFeedback(event.target.value)}><option value="all">All feedback</option><option value="sent">Feedback sent</option><option value="pending">Feedback pending</option></select></label></div>
        <p className="interview-history-note">{shown.length} interview records</p><div className="interview-history-list">{shown.map(row=><article key={row.id} className={['requested','approving'].includes(row.status)?'interview-record request':'interview-record'}><strong>{name(students.find(s=>s.id===row.student_id)||{})}</strong><small>{students.find(s=>s.id===row.student_id)?.student_code} · {displayDate(row.starts_at)}</small><span className="admin-calendar-status">{interviewLabel(row)}</span><div className="admin-calendar-actions">{['requested','approving'].includes(row.status)&&<button className="studio-primary" disabled={busy} onClick={()=>openAction(onReview,row)}>Review request</button>}{['booked','completed','no_show'].includes(row.status)&&<button className="studio-primary" disabled={busy} onClick={()=>openAction(onFeedback,row)}>{row.feedback?'Edit feedback':'Give feedback'}</button>}<button className="studio-secondary" disabled={busy} onClick={()=>openAction(onDetails,row)}>View details</button></div></article>)}</div>{!shown.length&&<p className="admin-calendar-empty">No interviews match these filters.</p>}</>:
        <><label className="interview-history-search">Participation<select value={participation} onChange={event=>setParticipation(event.target.value)}><option value="all">All students</option><option value="completed">Completed an interview</option><option value="not_completed">No completed interview</option><option value="pending">Scheduled / pending</option><option value="none">No interview recorded in range</option><option value="unrecorded">Completion unrecorded</option></select></label><div className="interview-history-list">{shownStudents.map(row=>{const own=records.filter(record=>record.student_id===row.id);return <article className="interview-record" key={row.id}><strong>{name(row)}</strong><small>{row.email} · {row.student_code}</small><span>{own.filter(r=>r.status==='completed').length} completed · {own.length} total records</span><small>{own.length?own.some(r=>r.status==='booked'&&Date.parse(r.ends_at)<now)?'Past interview — completion unrecorded':own.map(r=>interviewLabel(r)).filter((value,index,array)=>array.indexOf(value)===index).join(' · '):'No interview recorded in this date range'}</small><button type="button" className="studio-secondary" onClick={()=>{setQuery(row.email||name(row));setView('interviews');setStatus('all');setFeedback('all');}}>View interview records</button></article>;})}</div>{!shownStudents.length&&<p className="admin-calendar-empty">No students match these filters.</p>}</>}
    </div></Modal>}
  </div>;
}
