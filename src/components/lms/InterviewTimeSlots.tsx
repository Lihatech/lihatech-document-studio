import { Clock3, Check } from 'lucide-react';
import '../../styles/interviewTimes.css';

export type InterviewPeriod = { starts_at: string; ends_at: string };
export type InterviewAvailability = {
  date: string; calendar_connected: boolean; duration_minutes?: number;
  hours: (InterviewPeriod & { available: boolean; reason?: string | null })[];
  booked_periods?: InterviewPeriod[]; busy_periods?: InterviewPeriod[];
};
export const interviewTime = (value: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date(value));
export const interviewMinutes = (period: InterviewPeriod) =>
  Math.round((Date.parse(period.ends_at) - Date.parse(period.starts_at)) / 60000);

export default function InterviewTimeSlots({ availability, selected, onSelect, disabled = false, readOnly = false }: {
  availability: InterviewAvailability; selected?: string; onSelect?: (startsAt: string) => void; disabled?: boolean; readOnly?: boolean;
}) {
  const occupied = new Map<string, InterviewPeriod & { label: string }>();
  for (const [rows, label] of [[availability.busy_periods, 'Calendar busy'], [availability.booked_periods, 'Reserved interview']] as const) {
    for (const row of rows ?? []) occupied.set(Date.parse(row.starts_at) + ':' + Date.parse(row.ends_at), { ...row, label });
  }
  const periods = [...occupied.values()].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const available = availability.hours.filter(row => row.available);
  return <div className="interview-times">
    <section aria-label="Booked and unavailable times" className="interview-occupied">
      <div className="interview-times-heading"><h4><Clock3 size={16}/> Booked &amp; unavailable</h4><span>IST</span></div>
      {periods.length ? <ul>{periods.map(row => <li key={row.starts_at + row.ends_at}>
        <strong>{interviewTime(row.starts_at)}–{interviewTime(row.ends_at)}</strong><span>{row.label}</span>
      </li>)}</ul> : <p>No reserved times on this date.</p>}
    </section>
    <section aria-label="Available interview times">
      <div className="interview-times-heading"><h4>Available times</h4><span>{available.length} open</span></div>
      <p className="interview-times-help">{availability.duration_minutes ?? 35}-minute interviews · times shown in IST</p>
      {available.length ? <div className="interview-open-grid">{available.map(slot => readOnly ? <div className="interview-open-summary" key={slot.starts_at}><strong>{interviewTime(slot.starts_at)}–{interviewTime(slot.ends_at)}</strong><span>Available</span></div> : <button
        type="button" key={slot.starts_at} disabled={disabled} aria-pressed={selected === slot.starts_at}
        aria-label={interviewTime(slot.starts_at) + ' to ' + interviewTime(slot.ends_at) + ', Available'}
        className={selected === slot.starts_at ? 'selected' : ''} onClick={() => onSelect?.(slot.starts_at)}>
        <strong>{interviewTime(slot.starts_at)}–{interviewTime(slot.ends_at)}</strong>
        <span>{selected === slot.starts_at ? <><Check size={14}/> Selected</> : 'Available'}</span>
      </button>)}</div> : <p className="interview-times-empty">No available times. Choose another date.</p>}
    </section>
  </div>;
}
