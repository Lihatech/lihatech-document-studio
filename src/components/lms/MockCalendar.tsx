import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Video } from 'lucide-react';
import { type Row } from '../../lib/lms';
import ListFilters from './ListFilters';
import InterviewTimeSlots from './InterviewTimeSlots';
import '../../styles/mockBooking.css';

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const kolhapurKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const kolhapurToday = () => new Date(`${kolhapurKey(new Date())}T12:00:00`);
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const time = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${value}T12:00:00+05:30`));
const statusLabel: Record<string, string> = {
  requested: 'Awaiting approval', approving: 'Creating Meet', booked: 'Confirmed',
  rejected: 'Declined', cancelled: 'Cancelled', completed: 'Completed', no_show: 'No show',
};

type TimeSlot = { starts_at: string; ends_at: string; available: boolean; reason?: string | null };
type Availability = import('./InterviewTimeSlots').InterviewAvailability;
type MonthAvailability = { month: string; calendar_connected: boolean; busy_days: string[] };

export default function MockCalendar({ bookings, busy, durationMinutes = 35, loadDay, loadMonth, loadTopics, onRequest, onCancel }: {
  bookings: Row[]; busy: boolean; durationMinutes?: number;
  loadDay: (day: string, bookingId?: string) => Promise<Availability>;
  loadMonth: (month: string) => Promise<MonthAvailability>;
  loadTopics: (bookingId: string) => Promise<{ prepared_topics: string }>;
  onRequest: (startsAt: string, preparedTopics: string, bookingId?: string) => Promise<boolean>;
  onCancel: (booking: Row) => void;
}) {
  const [month, setMonth] = useState(() => { const today = kolhapurToday(); return new Date(today.getFullYear(), today.getMonth(), 1); });
  const [selected, setSelected] = useState(() => kolhapurKey(new Date()));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [monthAvailability, setMonthAvailability] = useState<MonthAvailability | null>(null);
  const [dayError, setDayError] = useState('');
  const [monthError, setMonthError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedStart, setSelectedStart] = useState('');
  const [preparedTopics, setPreparedTopics] = useState('');
  const [requestError, setRequestError] = useState('');
  const [sentSlot, setSentSlot] = useState<TimeSlot|null>(null);
  const [showSent, setShowSent] = useState(false);
  const [sentWasReschedule, setSentWasReschedule] = useState(false);
  const [rescheduling, setReschedulingState] = useState<Row | null>(null);
  const [interviewQuery,setInterviewQuery] = useState(''),[interviewStatus,setInterviewStatus] = useState('all');
  const requesting = useRef(false);
  const topicRequest = useRef('');
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const feedbackDialog = useRef<HTMLDialogElement>(null);
  const [feedbackView,setFeedbackView] = useState<Row|null>(null);
  useEffect(()=>{if(feedbackView&&!feedbackDialog.current?.open)feedbackDialog.current?.showModal();},[feedbackView]);

  function setRescheduling(row: Row | null) {
    setReschedulingState(row);
    topicRequest.current = row?.id || '';
    setPreparedTopics(row?.prepared_topics || '');
    setRequestError('');
    if (row) {
      selectDay(new Date(row.starts_at));
      window.setTimeout(() => document.querySelector<HTMLElement>('.booking-time-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      void loadTopics(row.id).then(result => {
        if (topicRequest.current === row.id) setPreparedTopics(result.prepared_topics || '');
      }).catch(() => undefined);
    }
  }

  const today = kolhapurKey(new Date());
  const lastRequestDay = kolhapurKey(new Date(Date.now() + 60 * 86400000));
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const pendingLocal=sentSlot&&!bookings.some(row=>Date.parse(row.starts_at)===Date.parse(sentSlot.starts_at))?[{id:'just-sent',...sentSlot,status:'requested'}]:[];
  const activeBookings = [...bookings,...pendingLocal].filter(row => ['requested', 'approving', 'booked'].includes(row.status));
  const upcoming = activeBookings.filter(row => Date.parse(row.starts_at) > Date.now())
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const completedInterviews = bookings.filter(row => row.feedback || ['completed', 'no_show'].includes(row.status))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  const shownInterviews = upcoming.filter(row => (interviewStatus==='all'||row.status===interviewStatus)
    && `${dateLabel(kolhapurKey(new Date(row.starts_at)))} ${row.starts_at} ${time(row.starts_at)}`.toLowerCase().includes(interviewQuery.toLowerCase()));
  const available = availability?.hours.filter(row => row.available) ?? [];
  const shownDuration = availability?.duration_minutes ?? durationMinutes;
  const chosen = available.find(row => row.starts_at === selectedStart);
  const bookingKey = bookings.map(row => `${row.id}:${row.status}:${row.starts_at}:${row.ends_at}`).join('|');

  useEffect(() => {
    const update = () => { if (!document.hidden && !confirmDialog.current?.open) setRefresh(value => value + 1); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);

  useEffect(() => {
    if (chosen && !confirmDialog.current?.open) confirmDialog.current?.showModal();
    if (!chosen && confirmDialog.current?.open) confirmDialog.current.close();
  }, [chosen]);

  useEffect(() => {
    let active = true;
    setAvailability(null);
    setDayError('');
    setSelectedStart('');
    loadDay(selected, rescheduling?.id).then(result => { if (active) setAvailability(result); })
      .catch(error => { if (active) setDayError(error instanceof Error ? error.message : 'Could not load times.'); });
    return () => { active = false; };
  }, [selected, refresh, bookingKey, rescheduling?.id]);

  useEffect(() => {
    let active = true;
    setMonthAvailability(null);
    setMonthError('');
    loadMonth(monthKey(month)).then(result => { if (active) setMonthAvailability(result); })
      .catch(error => { if (active) setMonthError(error instanceof Error ? error.message : 'Could not sync the month.'); });
    return () => { active = false; };
  }, [month, refresh]);

  function selectDay(date: Date) {
    setSelected(dayKey(date));
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    const current = kolhapurToday();
    setSelected(dayKey(next.getFullYear() === current.getFullYear() && next.getMonth() === current.getMonth() ? current : next));
  }

  async function requestSelected() {
    if (!chosen || !preparedTopics.trim() || busy || requesting.current) return;
    requesting.current = true;
    setRequestError('');
    try {
      const requestedSlot=chosen;
      if (await onRequest(requestedSlot.starts_at, preparedTopics.trim(), rescheduling?.id)) {
        setSentWasReschedule(!!rescheduling);
        setSentSlot(requestedSlot);
        setShowSent(true);
        confirmDialog.current?.close();
        setPreparedTopics('');
        setRescheduling(null);
        setRefresh(value => value + 1);
      } else setRequestError('Could not send your request. Check your connection and the page message, then try again.');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not send your request. Please try again.');
    } finally {
      requesting.current = false;
    }
  }

  return <section className="booking" aria-label="Mock interview booking">
    <header className="booking-hero">
      <div className="booking-hero-copy"><span className="booking-kicker"><CalendarDays size={15}/> MOCK INTERVIEWS</span><h2>Find a time that works for you.</h2><p>Choose a {durationMinutes}-minute slot. LihaTech will confirm your request and send the Meet invitation.</p></div>
      <div className="booking-steps" aria-label="Booking steps"><span><b>1</b> Pick a date</span><span><b>2</b> Choose a time</span><span><b>3</b> Get confirmation</span></div>
    </header>

    {showSent&&sentSlot&&<div className="booking-sent" role="status"><Check size={22}/><div><strong>{sentWasReschedule ? 'Reschedule request sent' : 'Interview request sent'}</strong><p>{dateLabel(kolhapurKey(new Date(sentSlot.starts_at)))} · {time(sentSlot.starts_at)}–{time(sentSlot.ends_at)}. {sentWasReschedule ? 'Your current interview is still scheduled. The new time will be applied only after admin approval.' : 'Your request has been received. Your slot is gray while awaiting approval and turns green when confirmed.'}</p></div><button type="button" aria-label="Dismiss request confirmation" onClick={()=>setShowSent(false)}>Dismiss</button></div>}
    {rescheduling&&<div className="booking-inline-alert" role="status">Choose a date and time to reschedule. Your current interview stays scheduled until admin approves the new time. <button type="button" onClick={()=>{setRescheduling(null);setPreparedTopics('');}}>Keep current time</button></div>}
    <div className="booking-workspace">
      <div className="booking-left-column">
      <section className="booking-date-panel" aria-label="Choose a date">
        <div className="booking-section-head"><div><span className="booking-step">01 / DATE</span><h3>Choose your day</h3></div><button className="booking-today" type="button" onClick={() => selectDay(kolhapurToday())}>Today</button></div>
        <div className="booking-month-nav"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={20}/></button><strong>{monthName}</strong><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={20}/></button></div>
        <div className="booking-month-grid" role="group" aria-label={monthName}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(label => <span className="booking-weekday" key={label}>{label}</span>)}
          {days.map(date => {
            const key = dayKey(date);
            const myBookings = activeBookings.filter(row => kolhapurKey(new Date(row.starts_at)) === key);
            const pending = myBookings.some(row=>row.status!=='booked');
            const confirmed = myBookings.some(row=>row.status==='booked');
            const calendarBusy = monthAvailability?.busy_days.includes(key) ?? false;
            const inMonth = date.getMonth() === month.getMonth();
            return <button type="button" key={key} className={`booking-date ${key === selected ? 'selected' : ''} ${key === today ? 'today' : ''} ${inMonth ? '' : 'outside'}`} aria-pressed={key === selected}
              aria-label={`${dateLabel(key)}${pending ? ', your request awaiting approval' : ''}${confirmed ? ', your confirmed interview' : ''}${calendarBusy ? ', calendar busy' : ''}`}
              onClick={() => selectDay(date)}><span>{date.getDate()}</span><i aria-hidden="true" className="booking-date-markers">{pending && <em className="pending"/>}{confirmed && <em className="confirmed"/>}{calendarBusy && <em className="busy"/>}</i></button>;
          })}
        </div>
        <div className="booking-date-key"><span><i className="pending"/> Requested</span><span><i className="confirmed"/> Confirmed</span><span><i className="busy"/> Calendar busy</span></div>
        {monthError && <div className="booking-inline-alert" role="alert">Calendar markers could not load. <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {!monthError && !monthAvailability && <p className="booking-small-status" role="status">Checking calendar…</p>}
        {monthAvailability && !monthAvailability.calendar_connected && <p className="booking-small-status">Calendar sync is not connected yet.</p>}
      </section>

    <section className="booking-upcoming" aria-label="Your upcoming interviews"><div className="booking-upcoming-head"><div><span className="booking-step">YOUR INTERVIEWS</span><h3>Your interviews</h3></div><span>{upcoming.length}</span></div>{upcoming.length>0&&<ListFilters query={interviewQuery} onQuery={setInterviewQuery} placeholder="Search interview date or time" filters={[{label:'Status',value:interviewStatus,onChange:setInterviewStatus,options:[{value:'all',label:'All statuses'},...['requested','approving','booked'].map(value=>({value,label:statusLabel[value]}))]}]}/>} {shownInterviews.length ? <div className="booking-upcoming-list">{shownInterviews.map(row => <article key={row.id} className={`booking-interview ${row.status==='booked'?'is-confirmed':'is-requested'}`}><span className="booking-interview-date"><CalendarDays size={17}/>{dateLabel(kolhapurKey(new Date(row.starts_at)))}</span><strong>{time(row.starts_at)}–{time(row.ends_at)}</strong><span className="booking-interview-status">{statusLabel[row.status] ?? row.status}</span><div>{row.status === 'booked' && row.meeting_url && <a href={row.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={16}/> Join Meet</a>}{row.id!=='just-sent'&&['requested', 'booked'].includes(row.status) && <><button type="button" disabled={busy} onClick={() => {setRescheduling(row);setRequestError('');}}>Reschedule</button><button type="button" disabled={busy} onClick={() => onCancel(row)}>{row.status === 'requested' ? 'Withdraw' : 'Cancel'}</button></>}</div></article>)}</div> : <p className="booking-no-upcoming">{upcoming.length?'No interviews match your filters.':'You have no upcoming interviews. Choose a date above to get started.'}</p>}</section>
      {completedInterviews.length>0&&<section className="booking-feedback" aria-label="Interview feedback"><div className="booking-upcoming-head"><div><span className="booking-step">YOUR PROGRESS</span><h3>Interview feedback</h3></div><span>{completedInterviews.length}</span></div><p className="booking-feedback-intro">Read feedback shared by the LihaTech team.</p><div className="booking-feedback-list">{completedInterviews.map(row=><article className="booking-feedback-card" key={row.id}><div className="booking-feedback-card-head"><div><strong>{dateLabel(kolhapurKey(new Date(row.starts_at)))}</strong><span>{time(row.starts_at)}–{time(row.ends_at)}</span></div><span className="booking-interview-status">Feedback</span></div>{row.feedback?<><p className="booking-feedback-preview">{row.feedback}</p><button type="button" className="booking-feedback-open" onClick={()=>setFeedbackView(row)} aria-label={`View full feedback for ${dateLabel(kolhapurKey(new Date(row.starts_at)))}`}>View feedback <ChevronRight size={16} aria-hidden="true"/></button></>:<p className="booking-feedback-empty">Feedback has not been added yet. Please check back later.</p>}</article>)}</div></section>}
      </div>
      <section className="booking-time-panel" aria-label="Choose a time">
        <div className="booking-section-head"><div><span className="booking-step">02 / TIME</span><h3>{dateLabel(selected)}</h3><p>New interviews last 35 minutes. Only admin can adjust the duration. Times shown in Kolhapur time (IST).</p></div><span className="booking-duration"><Clock3 size={16}/> {shownDuration} min</span></div>
        {dayError && <div className="booking-inline-alert" role="alert">{dayError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {!availability && !dayError && <p className="booking-loading" role="status">Checking available times…</p>}
        {availability && <>
          {!availability.calendar_connected && <div className="booking-inline-alert">Google Calendar is not connected yet. You can request a time, but confirmation needs admin setup.</div>}
          <InterviewTimeSlots availability={availability} selected={selectedStart} disabled={busy} onSelect={setSelectedStart}/>
        </>}
        {availability && available.length > 0 && <p className="booking-select-hint">{rescheduling && !selectedStart ? 'Select a date and time to reschedule.' : 'Select a time to review and send your request.'}</p>}
      </section>
    </div>

    <dialog ref={feedbackDialog} className="booking-feedback-dialog" aria-labelledby="feedback-dialog-title" onClose={()=>setFeedbackView(null)}>
      <header><h3 id="feedback-dialog-title">Interview feedback</h3><button autoFocus type="button" aria-label="Close feedback" onClick={()=>feedbackDialog.current?.close()}>Close</button></header>
      {feedbackView&&<><p className="booking-feedback-meta">{dateLabel(kolhapurKey(new Date(feedbackView.starts_at)))} · {time(feedbackView.starts_at)}–{time(feedbackView.ends_at)}</p>{feedbackView.mentor_name&&<p className="booking-feedback-meta">With {feedbackView.mentor_name}</p>}<div className="booking-feedback-full">{feedbackView.feedback}</div></>}
    </dialog>
    <dialog ref={confirmDialog} className="booking-confirm" aria-labelledby="booking-confirm-title" onClose={() => setSelectedStart('')}>
      {chosen && <form onSubmit={event=>{event.preventDefault();void requestSelected();}}><span className="booking-step">03 / REVIEW</span><h3 id="booking-confirm-title">{rescheduling ? 'Reschedule this interview?' : 'Request this interview?'}</h3><p>LihaTech will review your request. After approval, you’ll receive the Google Meet invitation.</p><div className="booking-confirm-summary"><span><CalendarDays size={17}/>{dateLabel(selected)}</span><strong><Clock3 size={17}/>{time(chosen.starts_at)}–{time(chosen.ends_at)}</strong></div><label className="booking-topics" htmlFor="prepared-topics">Topics you’ve prepared <span>(required)</span></label><textarea id="prepared-topics" className="booking-topics-input" required maxLength={2000} rows={4} value={preparedTopics} disabled={busy} onChange={event=>setPreparedTopics(event.target.value)} placeholder="For example: Java basics, OOP, SQL joins, React hooks" aria-describedby="prepared-topics-help"/><p id="prepared-topics-help">List the topics you’re ready to discuss. These will be shared with your interviewer in the calendar invitation.</p>{requestError&&<p className="booking-inline-alert" role="alert">{requestError}</p>}<div className="booking-confirm-actions"><button type="button" disabled={busy} onClick={() => {setRequestError('');confirmDialog.current?.close();}}>Choose another time</button><button type="submit" disabled={busy||!preparedTopics.trim()}>{busy ? 'Sending…' : rescheduling ? 'Request new time' : 'Send request'} <ChevronRight size={18}/></button></div></form>}
    </dialog>


  </section>;
}
