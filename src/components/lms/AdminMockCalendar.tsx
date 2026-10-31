import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Clock3, RefreshCw, Users, Video } from 'lucide-react';
import { lmsApi, type Row } from '../../lib/lms';
import Modal from '../Modal';
import AdminInterviewHistory from './AdminInterviewHistory';
import { interviewRoster, interviewLabel } from '../../lib/interviewHistory';
import InterviewTimeSlots, { interviewMinutes, type InterviewAvailability } from './InterviewTimeSlots';
import '../../styles/adminCalendar.css';
import '../../styles/interviewWorkspace.css';

type CalendarEvent={id:string;title:string;starts_at:string;ends_at:string;all_day:boolean;busy:boolean;url?:string};
type Entry={id:string;title:string;starts_at:string;ends_at:string;kind:string;booking?:Row;event?:CalendarEvent;proposal?:boolean};
const todayKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const istDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date(value));
const time=(value:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value));
const dateLabel=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
const overlaps=(a:{starts_at:string;ends_at:string},b:{starts_at:string;ends_at:string})=>Date.parse(a.starts_at)<Date.parse(b.ends_at)&&Date.parse(a.ends_at)>Date.parse(b.starts_at);
const statusLabel:Record<string,string>={requested:'Awaiting review',approving:'Creating meeting',booked:'Confirmed',rejected:'Declined',cancelled:'Cancelled',completed:'Completed',no_show:'Missed'};
type Availability=InterviewAvailability;
export default function AdminMockCalendar({bookings,slots,students,batches,members,busy,configured,actionError,onFeedback,onApprove,onDecline,onApproveReschedule,onDeclineReschedule,onCancel,onReschedule,onDetails,onRefresh}:{
  bookings:Row[];slots:Row[];students:Row[];batches:Row[];members:Row[];onFeedback:(row:Row)=>void;busy:boolean;configured:boolean;actionError?:string;
  onApprove:(row:Row)=>void;onDecline:(row:Row)=>void;onApproveReschedule:(row:Row)=>void;onDeclineReschedule:(row:Row)=>void;onCancel:(row:Row)=>void;onReschedule:(row:Row,startsAt:string)=>void;onDetails:(row:Row)=>void;onRefresh:()=>Promise<void>;
}){
  const [selected,setSelected]=useState(todayKey),[month,setMonth]=useState(()=>todayKey().slice(0,7));
  const [events,setEvents]=useState<CalendarEvent[]>([]),[loadedMonth,setLoadedMonth]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[reviewId,setReviewId]=useState<string|null>(null),[rescheduling,setRescheduling]=useState<Row|null>(null),[rescheduleDay,setRescheduleDay]=useState(''),[rescheduleAvailability,setRescheduleAvailability]=useState<Availability|null>(null),[rescheduleError,setRescheduleError]=useState(''),[rescheduleSlot,setRescheduleSlot]=useState('');
  const [dayAvailability,setDayAvailability]=useState<InterviewAvailability|null>(null),[dayError,setDayError]=useState('');
  const [durationDraft,setDurationDraft]=useState('35'),[savingDuration,setSavingDuration]=useState(false),[durationError,setDurationError]=useState('');
  const [batchFilter,setBatchFilter]=useState('all'),[studentFilter,setStudentFilter]=useState('all');
  const roster=interviewRoster(students,members,batchFilter,studentFilter),rosterIds=new Set(roster.map(row=>row.id));
  const batchNames=(studentId:string)=>members.filter(link=>link.student_id===studentId&&!link.left_at&&link.status!=='revoked').map(link=>batches.find(batch=>batch.id===link.batch_id)?.name).filter(Boolean).join(', ')||'No current batch';
  const keyboardFocus=useRef(false);
  useLayoutEffect(()=>{if(keyboardFocus.current){document.querySelector<HTMLButtonElement>(`[data-calendar-day="${selected}"]`)?.focus({preventScroll:true});keyboardFocus.current=false;}},[selected,month]);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    lmsApi<{events:CalendarEvent[]}>(`/admin/mocks/events?month=${month}`,'GET').then(result=>{if(active){setEvents(result.events);setLoadedMonth(month);}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load calendar events.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[month,refresh,bookings.map(row=>`${row.id}:${row.status}`).join('|')]);
  useEffect(()=>{const update=()=>setRefresh(value=>value+1);const timer=window.setInterval(()=>{if(!document.hidden&&!busy)update();},60000);window.addEventListener('focus',update);return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);};},[busy]);
  const person=(row:Row)=>{const student=students.find(student=>student.id===row.student_id);return student?.profile_completed_at?student.full_name:student?.email||'Student';};
  const local:Entry[]=bookings.flatMap(row=>{const slot=slots.find(slot=>slot.id===row.slot_id);if(!slot)return [];const current={id:row.id,title:person(row),starts_at:slot.starts_at,ends_at:slot.ends_at,kind:['requested','approving'].includes(row.status)?'request':row.status==='booked'?'confirmed':'history',booking:row};const proposal=row.reschedule_starts_at&&row.reschedule_ends_at?{id:`${row.id}-reschedule`,title:person(row),starts_at:row.reschedule_starts_at,ends_at:row.reschedule_ends_at,kind:'request',booking:row,proposal:true}:null;return proposal?[current,proposal]:[current];});
  const entries:Entry[]=[...local,...(loadedMonth===month?events:[]).filter(event=>!bookings.some(row=>event.id===row.calendar_event_id||event.id==='lms'+row.id.replaceAll('-',''))).map(event=>({...event,kind:'google',event}))];
  const visible=entries.filter(entry=>(!entry.booking||rosterIds.has(entry.booking.student_id))&&(filter==='all'||entry.kind===filter)&&`${entry.title} ${entry.booking?.prepared_topics||''} ${entry.booking?students.find(row=>row.id===entry.booking!.student_id)?.email||'':''} ${entry.starts_at}`.toLowerCase().includes(query.trim().toLowerCase()));
  const range=(day:string)=>({starts_at:day+'T00:00:00+05:30',ends_at:new Date(Date.parse(day+'T00:00:00+05:30')+86400000).toISOString()});
  const dayEntries=visible.filter(entry=>overlaps(entry,range(selected))).sort((a,b)=>Number(b.kind==='request')-Number(a.kind==='request')||Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const first=new Date(month+'-01T12:00:00'),start=new Date(first);start.setDate(1-first.getDay());
  const days=Array.from({length:Math.ceil((first.getDay()+new Date(first.getFullYear(),first.getMonth()+1,0).getDate())/7)*7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  const pending=local.filter(entry=>entry.kind==='request'&&rosterIds.has(entry.booking!.student_id)).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const review=local.find(entry=>entry.id===reviewId&&entry.kind==='request');
  useEffect(()=>{if(reviewId&&!review)setReviewId(null);},[reviewId,!!review]);
  useEffect(()=>{
    if(!rescheduling||!rescheduleDay)return;
    let active=true;setRescheduleAvailability(null);setRescheduleError('');setRescheduleSlot('');
    lmsApi<Availability>(`/admin/mocks/availability?day=${rescheduleDay}&exclude_booking_id=${rescheduling.id}`,'GET')
      .then(result=>{if(active)setRescheduleAvailability(result);})
      .catch(error=>{if(active){setRescheduleError(error instanceof Error?error.message:'Could not load available times.');setRescheduleAvailability({date:rescheduleDay,calendar_connected:false,hours:[]});}});
    return()=>{active=false;};
  },[rescheduling,rescheduleDay]);
  useEffect(()=>{
    let active=true;setDayAvailability(null);setDayError('');
    lmsApi<InterviewAvailability>(`/admin/mocks/availability?day=${selected}`,'GET')
      .then(value=>{if(active)setDayAvailability(value);})
      .catch(error=>{if(active)setDayError(error instanceof Error?error.message:'Could not load available times.');});
    return()=>{active=false;};
  },[selected,refresh,slots.map(row=>row.id+row.starts_at+row.ends_at+row.status).join('|'),bookings.map(row=>row.id+row.status).join('|')]);
  async function saveDuration(entry:Entry){
    const minutes=Number(durationDraft);
    if(!Number.isInteger(minutes)||minutes<5||minutes>180){setDurationError('Enter a whole number from 5 to 180 minutes.');return;}
    setSavingDuration(true);setDurationError('');
    try{
      await lmsApi(`/admin/mocks/${entry.booking!.id}/duration`,'POST',{duration_minutes:minutes,proposal:!!entry.proposal});
      await reload();
    }catch(error){setDurationError(error instanceof Error?error.message:'Could not save duration.');}
    finally{setSavingDuration(false);}
  }
  function selectDay(day:string){setSelected(day);setMonth(day.slice(0,7));}
  function moveMonth(offset:number){const d=new Date(first);d.setMonth(d.getMonth()+offset);selectDay(dayKey(d));}
  function moveDay(offset:number){const d=new Date(selected+'T12:00:00');d.setDate(d.getDate()+offset);selectDay(dayKey(d));}
  function reviewRequest(entry:Entry){setDurationDraft(String(interviewMinutes(entry)));setDurationError('');setFilter('all');selectDay(istDay(entry.starts_at));setReviewId(entry.id);}
  function startReschedule(row:Row,startsAt:string){setRescheduling(row);setRescheduleDay(istDay(startsAt));setRescheduleSlot('');setRescheduleAvailability(null);selectDay(istDay(startsAt));}
  function closeReschedule(){setRescheduling(null);setRescheduleAvailability(null);setRescheduleError('');setRescheduleSlot('');}
  async function reload(){setRefresh(value=>value+1);await onRefresh();}
  const conflicts=(entry:Entry)=>entries.filter(other=>other.id!==entry.id&&other.booking?.id!==entry.booking?.id&&other.kind!=='history'&&(other.kind==='confirmed'||other.event?.busy)&&overlaps(entry,other));
  function calendarKey(event:KeyboardEvent<HTMLButtonElement>,date:Date){
    const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(!(event.key in offsets))return;
    event.preventDefault();const target=new Date(date);target.setDate(target.getDate()+offsets[event.key]);const key=dayKey(target);
    keyboardFocus.current=true;selectDay(key);
  }
  function actions(entry:Entry){const row=entry.booking!;return <div className="admin-calendar-actions">
    {entry.kind==='request'&&<button className="studio-primary" disabled={busy||savingDuration||(reviewId===entry.id&&Number(durationDraft)!==interviewMinutes(entry))||loading||!!error||!configured||conflicts(entry).length>0||Date.parse(entry.starts_at)<=Date.now()} onClick={()=>entry.proposal?onApproveReschedule(row):onApprove(row)}>{entry.proposal?'Accept reschedule':row.status==='approving'?'Retry approval':'Accept & create Meet'}</button>}
    {entry.kind==='request'&&<button className="lms-danger-button" disabled={busy||savingDuration} onClick={()=>entry.proposal?onDeclineReschedule(row):onDecline(row)}>{entry.proposal?'Decline reschedule':'Decline request'}</button>}
    <button className="studio-secondary" disabled={busy||savingDuration} onClick={()=>{setReviewId(null);onDetails(row);}}>View details</button>
    {entry.kind==='confirmed'&&!entry.proposal&&<button className="lms-danger-button" disabled={busy} onClick={()=>onCancel(row)}>Cancel interview</button>}
  </div>;}
  function requestHelp(entry:Entry){return <>
     {entry.proposal&&<p className="admin-calendar-available">Proposed replacement time. The current interview stays scheduled until you accept.</p>}
     {(entry.proposal?entry.booking?.reschedule_prepared_topics:entry.booking?.prepared_topics)&&<div className="admin-calendar-topics"><span>TOPICS PREPARED</span><p>{entry.proposal?entry.booking?.reschedule_prepared_topics:entry.booking?.prepared_topics}</p></div>}
    {conflicts(entry).length>0&&entry.kind==='request'&&<div className="admin-calendar-conflict"><strong>Calendar conflict.</strong><p>This request overlaps {conflicts(entry).map(event=>`${event.title} (${time(event.starts_at)}–${time(event.ends_at)})`).join(', ')}. Decline the request or resolve the calendar conflict before accepting.</p></div>}
    {entry.kind==='request'&&Date.parse(entry.starts_at)<=Date.now()&&<p className="admin-calendar-conflict">This requested time has passed. You can decline it, but it cannot be accepted.</p>}
    {entry.booking?.calendar_error&&<p className="admin-calendar-conflict">{entry.booking.calendar_error}</p>}
    {entry.kind==='request'&&(error||!configured)&&<p className="admin-calendar-conflict">{error||'Connect the calendar before accepting this request.'}</p>}
  </>;}
  return <section className="admin-calendar" aria-label="Admin interview calendar">
    <div className="interview-workspace-filters">
      <label>Batch<select value={batchFilter} onChange={event=>{setBatchFilter(event.target.value);setStudentFilter('all');}}><option value="all">All batches</option>{batches.map(row=><option key={row.id} value={row.id}>{row.name} · {row.code}</option>)}</select></label>
      <label>Student<select value={studentFilter} onChange={event=>setStudentFilter(event.target.value)}><option value="all">All students</option>{interviewRoster(students,members,batchFilter).map(row=><option value={row.id} key={row.id}>{person({student_id:row.id})} · {row.student_code}</option>)}</select></label>
      <label>Search<input type="search" placeholder="Student, email, topic or event" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <label>Show<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All events &amp; interviews</option><option value="request">Awaiting review</option><option value="confirmed">Confirmed interviews</option><option value="google">Google Calendar events</option><option value="history">Past decisions</option></select></label>
      <div className="interview-toolbar-actions">
      <button type="button" className="interview-request-shortcut" disabled={!pending.length} onClick={()=>{setFilter('request');setQuery('');if(pending[0])selectDay(istDay(pending[0].starts_at));}}>Awaiting review <strong>{pending.length}</strong></button>
    <AdminInterviewHistory bookings={bookings} slots={slots} students={students} batches={batches} members={members} batch={batchFilter} student={studentFilter} busy={busy} onFeedback={onFeedback} onDetails={onDetails} onReview={row=>{const entry=local.find(item=>item.booking?.id===row.id&&item.kind==='request');if(entry)reviewRequest(entry);}}/>
      </div>
    </div>
    {!configured&&<p className="admin-calendar-conflict" role="status">Calendar connection is unavailable. Approval needs a working connection.</p>}
    <div className="admin-interview-workspace">
    <section className="admin-calendar-agenda admin-calendar-priority-agenda" aria-label="Selected day events"><div className="admin-calendar-section-head"><div><span className="admin-calendar-eyebrow">{selected===todayKey()?"TODAY’S EVENTS & INTERVIEWS":"DAY EVENTS & INTERVIEWS"}</span><h2>{dateLabel(selected)}</h2></div><div className="admin-calendar-day-nav"><button aria-label="Previous day" onClick={()=>moveDay(-1)}><ChevronLeft size={18}/></button><label>Go to date<input type="date" value={selected} onChange={event=>{if(event.target.value)selectDay(event.target.value);}}/></label><button aria-label="Next day" onClick={()=>moveDay(1)}><ChevronRight size={18}/></button></div></div>
      <div className="admin-calendar-day-layout"><div><h3 className="admin-calendar-column-title"><Users size={18}/> Interviews <span>{dayEntries.filter(entry=>entry.booking).length}</span></h3>{!dayEntries.some(entry=>entry.booking)&&<p className="admin-calendar-empty">No interviews on this day{query||filter!=='all'?' match your filters':''}.</p>}
        {rescheduling&&<section className="admin-calendar-reschedule-panel" aria-label="Choose a reschedule slot"><div className="admin-calendar-section-head"><div><span className="admin-calendar-eyebrow">RESCHEDULE INTERVIEW</span><h2>{person(rescheduling)}</h2><p>Choose a new time. This interview keeps its scheduled duration.</p></div><button className="studio-secondary" type="button" onClick={closeReschedule}>Keep current time</button></div><label className="admin-calendar-date-input">New date<input type="date" required value={rescheduleDay} min={todayKey()} onChange={event=>{setRescheduleDay(event.target.value);selectDay(event.target.value);}}/></label>{rescheduleError&&<p className="admin-calendar-conflict" role="alert">{rescheduleError}</p>}{!rescheduleAvailability&&!rescheduleError&&<p role="status">Checking available times…</p>}{rescheduleAvailability&&<><InterviewTimeSlots availability={rescheduleAvailability} selected={rescheduleSlot} disabled={busy} onSelect={setRescheduleSlot}/></>}<div className="admin-calendar-actions"><button type="button" className="studio-secondary" onClick={closeReschedule}>Cancel</button><button type="button" className="studio-primary" disabled={busy||!rescheduleSlot} onClick={()=>{const chosen=rescheduleAvailability?.hours.find(slot=>slot.starts_at===rescheduleSlot);if(chosen){closeReschedule();onReschedule(rescheduling,chosen.starts_at);}}}>Request new time</button></div></section>}
        {dayEntries.filter(entry=>entry.booking).map(entry=><article key={entry.id} className={`admin-calendar-event ${entry.kind}`}><div className="interview-card-tools">{entry.kind==='request'&&<button type="button" className="studio-primary" disabled={busy} onClick={()=>reviewRequest(entry)}>Review {entry.proposal?'reschedule':'request'}</button>}{!entry.proposal&&['booked','completed','no_show'].includes(entry.booking!.status)&&<button type="button" className="studio-primary" disabled={busy} onClick={()=>onFeedback(entry.booking!)}>{entry.booking!.feedback?'Edit feedback':'Give feedback'}</button>}</div><p className="interview-card-batch">{batchNames(entry.booking!.student_id)} · {students.find(row=>row.id===entry.booking!.student_id)?.student_code}</p><details open={entry.kind==='request'}><summary><span className="admin-calendar-time"><Clock3 size={16}/>{time(entry.starts_at)}–{time(entry.ends_at)}</span><span className="admin-calendar-event-name"><strong>{entry.title}</strong><span className={`admin-calendar-status ${entry.kind}`}>{entry.proposal?'Reschedule awaiting review':interviewLabel({...entry.booking,ends_at:entry.ends_at})}</span></span>{entry.kind==='confirmed'&&!entry.proposal&&<span className="admin-calendar-quick-actions"><button type="button" className="admin-calendar-quick-button" disabled={busy} onClick={event=>{event.preventDefault();event.stopPropagation();startReschedule(entry.booking!,entry.starts_at);}}>Reschedule</button>{entry.booking!.meeting_url&&<a className="admin-calendar-quick-button" href={entry.booking!.meeting_url} target="_blank" rel="noopener noreferrer" onClick={event=>event.stopPropagation()}><Video size={15}/> Join Meet</a>}</span>}<ChevronRight size={18} className="admin-calendar-expand"/></summary><div className="admin-calendar-event-body">{requestHelp(entry)}{actions(entry)}</div></details></article>)}
      </div><div><h3 className="admin-calendar-column-title"><CalendarDays size={18}/> Google Calendar <span>{dayEntries.filter(entry=>entry.event).length}</span></h3>{!dayEntries.some(entry=>entry.event)&&<p className="admin-calendar-empty">{loading?'Loading calendar events…':error?'Calendar events could not be loaded.':'No other calendar events for this date and filter.'}</p>}{dayEntries.filter(entry=>entry.event).map(entry=><article key={entry.id} className="admin-calendar-google-event"><span className="admin-calendar-external-time">{entry.event!.all_day?'All day':time(entry.starts_at)}</span><div><h3>{entry.title}</h3><p>{entry.event!.all_day?'All-day event':`${time(entry.starts_at)}–${time(entry.ends_at)} IST`} · {entry.event!.busy?'Busy':'Free'}</p>{entry.event!.url&&<a href={entry.event!.url} target="_blank" rel="noopener noreferrer">Open in Google Calendar <ArrowUpRight size={14}/></a>}</div></article>)}</div></div>
    </section>

    <section className="admin-calendar-month" aria-label="Monthly schedule">
      <div className="admin-calendar-nav"><div><span className="admin-calendar-eyebrow">INTERVIEW SCHEDULE</span><h2>{first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h2></div><div className="admin-calendar-nav-actions"><button aria-label="Previous calendar month" onClick={()=>moveMonth(-1)}><ChevronLeft size={20}/></button><button onClick={()=>selectDay(todayKey())}>Today</button><button aria-label="Next calendar month" onClick={()=>moveMonth(1)}><ChevronRight size={20}/></button><button aria-label="Refresh calendar" disabled={busy||loading} onClick={()=>void reload()}><RefreshCw size={18} className={loading?'is-syncing':''}/></button></div></div>

      {error&&<div className="admin-calendar-conflict" role="alert">{error} <button className="studio-secondary" onClick={()=>setRefresh(value=>value+1)}>Retry calendar</button></div>}
      <div className="admin-calendar-grid" aria-label="Calendar month">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span className="admin-calendar-weekday" key={day}>{day}</span>)}{days.map(date=>{const key=dayKey(date),items=visible.filter(entry=>overlaps(entry,range(key))).sort((a,b)=>Number(b.kind==='request')-Number(a.kind==='request')||Date.parse(a.starts_at)-Date.parse(b.starts_at));return <button type="button" key={key} data-calendar-day={key} tabIndex={key===selected?0:-1} className={`admin-calendar-day ${key===selected?'selected':''} ${key===todayKey()?'today':''} ${key.slice(0,7)!==month?'outside':''}`} aria-pressed={key===selected} aria-label={`${key}, ${items.length} events${items.length?', '+items.map(item=>`${item.title}, ${item.booking?statusLabel[item.booking.status]:'Google Calendar event'}`).join('; '):''}`} onKeyDown={event=>calendarKey(event,date)} onClick={()=>selectDay(key)}><strong>{date.getDate()}</strong>{items.some(item=>item.kind==='request')&&<span className="admin-calendar-request-count">{items.filter(item=>item.kind==='request').length} to review</span>}<span className="admin-calendar-day-previews">{items.slice(0,2).map(item=><span key={item.id} className={`admin-calendar-preview ${item.kind}`}><i/><span>{item.event?.all_day?'All day':time(item.starts_at)} · {item.title}</span></span>)}{items.length>2&&<span className="admin-calendar-more">+{items.length-2} more</span>}</span>{items.length>0&&<span className="admin-calendar-mobile-count">{items.length}<span className="admin-calendar-mobile-dots">{[...new Set(items.map(item=>item.kind))].map(kind=><i key={kind} className={kind}/>)}</span></span>}</button>;})}</div>
      <div className="admin-calendar-key"><span className="request"><i/>Pending request</span><span className="confirmed"><i/>Confirmed</span><span className="google"><i/>Google event</span><span className="history"><i/>Past decision</span><small>Use arrow keys to move between dates.</small></div>
    </section>


    <details className="admin-availability-disclosure"><summary><span><Clock3 size={18}/> Available interview slots · {dateLabel(selected)}</span><ChevronDown size={18}/></summary>
    <section className="admin-calendar-agenda admin-calendar-availability" aria-label="Day availability"><div className="admin-calendar-section-head"><div><span className="admin-calendar-eyebrow">DAY AVAILABILITY</span><h2>{dateLabel(selected)}</h2><p>Availability uses the whole calendar, including events outside the selected batch.</p></div></div>{pending.filter(entry=>overlaps(entry,range(selected))).map(entry=><button type="button" className="availability-request-tag request" key={entry.id} disabled={busy} onClick={()=>reviewRequest(entry)}><span><strong>{time(entry.starts_at)}–{time(entry.ends_at)}</strong> · {entry.title}</span><span>Review {entry.proposal?'reschedule':'request'} <ArrowUpRight size={14}/></span></button>)}{dayError?<p role="alert" className="admin-calendar-conflict">{dayError}</p>:dayAvailability?<InterviewTimeSlots availability={dayAvailability} readOnly/>:<p role="status">Checking availability…</p>}</section>


    </details>
    </div>
    {review&&<Modal title="Review interview request" busy={busy||savingDuration} onClose={()=>{if(!savingDuration)setReviewId(null);}}><div className="admin-calendar admin-calendar-review"><span className="admin-calendar-status request">Awaiting approval</span><h2>{review.title}</h2><p className="admin-calendar-review-email">{students.find(student=>student.id===review.booking!.student_id)?.email}</p><div className="admin-calendar-review-date"><CalendarDays size={22}/><div><strong>{dateLabel(istDay(review.starts_at))}</strong><p>{time(review.starts_at)}–{time(review.ends_at)} IST · {interviewMinutes(review)} minutes</p></div></div>{(review.booking!.status==='requested'||review.proposal)&&<form className="interview-duration-form" onSubmit={event=>{event.preventDefault();void saveDuration(review);}}>
      <label>Interview duration (minutes)<input type="number" min="5" max="180" step="1" required value={durationDraft} disabled={busy||savingDuration} onChange={event=>setDurationDraft(event.target.value)}/></label>
      <p>Ends at {Number(durationDraft)>=5&&Number(durationDraft)<=180?time(new Date(Date.parse(review.starts_at)+Number(durationDraft)*60000).toISOString()):'—'} IST. Save the duration before accepting.</p>
      {durationError&&<p role="alert" className="admin-calendar-conflict">{durationError}</p>}
      <button className="studio-secondary" type="submit" disabled={busy||savingDuration||Number(durationDraft)===interviewMinutes(review)}>{savingDuration?'Saving…':'Save duration'}</button>
    </form>}{requestHelp(review)}{!conflicts(review).length&&!loading&&!error&&<p className="admin-calendar-available">No calendar conflicts for this time.</p>}{loading&&<p role="status">Checking the calendar before approval…</p>}{actionError&&<p className="admin-calendar-conflict" role="alert">{actionError}</p>}{actions(review)}<p className="admin-calendar-review-note">Accepting creates the Meet link and sends the calendar invitation to the student.</p></div></Modal>}
  </section>;
}
