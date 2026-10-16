import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Video } from 'lucide-react';
import { type Row } from '../../lib/lms';
import ListFilters from './ListFilters';
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
type Availability = { date: string; calendar_connected: boolean; hours: TimeSlot[]; busy_periods?: { starts_at: string; ends_at: string }[] };
type MonthAvailability = { month: string; calendar_connected: boolean; busy_days: string[] };

export default function MockCalendar({ bookings, busy, loadDay, loadMonth, onRequest, onCancel }: {
  bookings: Row[]; busy: boolean;
  loadDay: (day: string) => Promise<Availability>;
  loadMonth: (month: string) => Promise<MonthAvailability>;
  onRequest: (startsAt: string) => Promise<boolean>;
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
  const [interviewQuery,setInterviewQuery] = useState(''),[interviewStatus,setInterviewStatus] = useState('all');
  const requesting = useRef(false);
  const confirmDialog = useRef<HTMLDialogElement>(null);

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
  const activeBookings = bookings.filter(row => ['requested', 'approving', 'booked'].includes(row.status));
  const upcoming = activeBookings.filter(row => Date.parse(row.starts_at) > Date.now())
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const shownInterviews = upcoming.filter(row => (interviewStatus==='all'||row.status===interviewStatus)
    && `${dateLabel(kolhapurKey(new Date(row.starts_at)))} ${row.starts_at} ${time(row.starts_at)}`.toLowerCase().includes(interviewQuery.toLowerCase()));
  const available = availability?.hours.filter(row => row.available) ?? [];
  const chosen = available.find(row => row.starts_at === selectedStart);
  const bookingKey = bookings.map(row => `${row.id}:${row.status}:${row.starts_at}`).join('|');

  useEffect(() => {
    if (chosen && !confirmDialog.current?.open) confirmDialog.current?.showModal();
    if (!chosen && confirmDialog.current?.open) confirmDialog.current.close();
  }, [chosen]);

  useEffect(() => {
    let active = true;
    setAvailability(null);
    setDayError('');
    setSelectedStart('');
    loadDay(selected).then(result => { if (active) setAvailability(result); })
      .catch(error => { if (active) setDayError(error instanceof Error ? error.message : 'Could not load times.'); });
    return () => { active = false; };
  }, [selected, refresh, bookingKey]);

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
    if (!chosen || busy || requesting.current) return;
    requesting.current = true;
    try {
      if (await onRequest(chosen.starts_at)) setRefresh(value => value + 1);
    } finally {
      requesting.current = false;
    }
  }

  return <section className="booking" aria-label="Mock interview booking">
    <header className="booking-hero">
      <div className="booking-hero-copy"><span className="booking-kicker"><CalendarDays size={15}/> MOCK INTERVIEWS</span><h2>Find a time that works for you.</h2><p>Choose a date and a one-hour slot. LihaTech will confirm your request and send the Meet invitation.</p></div>
      <div className="booking-steps" aria-label="Booking steps"><span><b>1</b> Pick a date</span><span><b>2</b> Choose a time</span><span><b>3</b> Get confirmation</span></div>
    </header>

    <div className="booking-workspace">
      <section className="booking-date-panel" aria-label="Choose a date">
        <div className="booking-section-head"><div><span className="booking-step">01 / DATE</span><h3>Choose your day</h3></div><button className="booking-today" type="button" onClick={() => selectDay(kolhapurToday())}>Today</button></div>
        <div className="booking-month-nav"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={20}/></button><strong>{monthName}</strong><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={20}/></button></div>
        <div className="booking-month-grid" role="group" aria-label={monthName}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(label => <span className="booking-weekday" key={label}>{label}</span>)}
          {days.map(date => {
            const key = dayKey(date);
            const mine = activeBookings.some(row => kolhapurKey(new Date(row.starts_at)) === key);
            const calendarBusy = monthAvailability?.busy_days.includes(key) ?? false;
            const inMonth = date.getMonth() === month.getMonth();
            return <button type="button" key={key} className={`booking-date ${key === selected ? 'selected' : ''} ${key === today ? 'today' : ''} ${inMonth ? '' : 'outside'}`} aria-pressed={key === selected}
              aria-label={`${dateLabel(key)}${mine ? ', your interview' : ''}${calendarBusy ? ', calendar busy' : ''}`}
              onClick={() => selectDay(date)}><span>{date.getDate()}</span><i aria-hidden="true" className="booking-date-markers">{mine && <em className="mine"/>}{calendarBusy && <em className="busy"/>}</i></button>;
          })}
        </div>
        <div className="booking-date-key"><span><i className="mine"/> Your interview</span><span><i className="busy"/> Calendar busy</span></div>
        {monthError && <div className="booking-inline-alert" role="alert">Calendar markers could not load. <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {!monthError && !monthAvailability && <p className="booking-small-status" role="status">Checking calendar…</p>}
        {monthAvailability && !monthAvailability.calendar_connected && <p className="booking-small-status">Calendar sync is not connected yet.</p>}
      </section>

      <section className="booking-time-panel" aria-label="Choose a time">
        <div className="booking-section-head"><div><span className="booking-step">02 / TIME</span><h3>{dateLabel(selected)}</h3><p>Each interview lasts one hour. Times shown in Kolhapur time (IST).</p></div><span className="booking-duration"><Clock3 size={16}/> 60 min</span></div>
        {dayError && <div className="booking-inline-alert" role="alert">{dayError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {!availability && !dayError && <p className="booking-loading" role="status">Checking available times…</p>}
        {availability && <>
          {!availability.calendar_connected && <div className="booking-inline-alert">Google Calendar is not connected yet. You can request a time, but confirmation needs admin setup.</div>}
          {!!availability.busy_periods?.length && <section className="booking-calendar-periods" aria-label="Google Calendar busy periods">
            <strong><Clock3 size={15} aria-hidden="true"/> Calendar busy periods</strong>
            <ul>{availability.busy_periods.map(period => <li key={`${period.starts_at}-${period.ends_at}`}>{time(period.starts_at)}–{time(period.ends_at)}</li>)}</ul>
          </section>}
          {availability.hours.length > 0 ? <>
            <div className="booking-available-head"><strong>Choose an interview time</strong><span>{available.length} available · starts every 15 minutes</span></div>
            <p className="booking-overlap-hint">Each option is a full one-hour interview. Red options overlap an existing booking, even if they start before it.</p>
            <div className="booking-slot-key"><span><i className="is-open"/> Available</span><span><i className="is-busy"/> Overlaps a booking</span><span><i className="is-past"/> Outside booking window</span></div>
            <div className="booking-time-grid">{availability.hours.map(slot => {
              const overlaps = slot.reason === 'calendar_busy' || slot.reason === 'reserved';
              const label = slot.available ? 'Available' : overlaps ? 'Overlaps a booking' : 'Unavailable';
              return <button type="button" key={slot.starts_at} disabled={!slot.available}
                className={`booking-time-option ${selectedStart === slot.starts_at ? 'selected' : ''} ${!slot.available ? overlaps ? 'is-busy' : 'is-past' : ''}`}
                aria-pressed={slot.available ? selectedStart === slot.starts_at : undefined}
                aria-label={`${time(slot.starts_at)} to ${time(slot.ends_at)}, ${label}`}
                onClick={() => setSelectedStart(slot.starts_at)}>
                <span>{time(slot.starts_at)}–{time(slot.ends_at)}</span>
                <small>{label}</small>
                {selectedStart === slot.starts_at && <Check size={17} aria-hidden="true"/>}
              </button>;
            })}</div>
            {!available.length && <p className="booking-select-hint">No times are open on this date. Choose another day.</p>}
          </> : <div className="booking-no-times"><CalendarDays size={22}/><strong>No interview times on this day</strong><p>Choose another date from the calendar.</p></div>}
        </>}
        {availability && available.length > 0 && <p className="booking-select-hint">Select a time to review and send your request.</p>}
      </section>
    </div>

    <dialog ref={confirmDialog} className="booking-confirm" aria-labelledby="booking-confirm-title" onClose={() => setSelectedStart('')}>
      {chosen && <><span className="booking-step">03 / REVIEW</span><h3 id="booking-confirm-title">Request this interview?</h3><p>LihaTech will review your request. After approval, you’ll receive the Google Meet invitation.</p><div className="booking-confirm-summary"><span><CalendarDays size={17}/>{dateLabel(selected)}</span><strong><Clock3 size={17}/>{time(chosen.starts_at)}–{time(chosen.ends_at)}</strong></div><div className="booking-confirm-actions"><button type="button" onClick={() => confirmDialog.current?.close()}>Choose another time</button><button type="button" disabled={busy} onClick={() => void requestSelected()}>{busy ? 'Sending…' : 'Send request'} <ChevronRight size={18}/></button></div></>}
    </dialog>

    <section className="booking-upcoming" aria-label="Your upcoming interviews"><div className="booking-upcoming-head"><div><span className="booking-step">YOUR INTERVIEWS</span><h3>Upcoming requests</h3></div><span>{upcoming.length}</span></div>{upcoming.length>0&&<ListFilters query={interviewQuery} onQuery={setInterviewQuery} placeholder="Search interview date or time" filters={[{label:'Status',value:interviewStatus,onChange:setInterviewStatus,options:[{value:'all',label:'All statuses'},...['requested','approving','booked'].map(value=>({value,label:statusLabel[value]}))]}]}/>} {shownInterviews.length ? <div className="booking-upcoming-list">{shownInterviews.map(row => <article key={row.id} className="booking-interview"><span className="booking-interview-date"><CalendarDays size={17}/>{dateLabel(kolhapurKey(new Date(row.starts_at)))}</span><strong>{time(row.starts_at)}–{time(row.ends_at)}</strong><span className="booking-interview-status">{statusLabel[row.status] ?? row.status}</span><div>{row.status === 'booked' && row.meeting_url && <a href={row.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={16}/> Join Meet</a>}{['requested', 'booked'].includes(row.status) && <button type="button" disabled={busy} onClick={() => onCancel(row)}>{row.status === 'requested' ? 'Withdraw' : 'Cancel'}</button>}</div></article>)}</div> : <p className="booking-no-upcoming">{upcoming.length?'No interviews match your filters.':'You have no upcoming interviews. Choose a date above to get started.'}</p>}</section>
  </section>;
}
