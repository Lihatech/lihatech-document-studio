import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, ChevronRight, FileText } from 'lucide-react';
import { displayDate, rpc, type Row } from '../../lib/lms';
import { requestStatus, requestTitle, type DocumentRequest } from '../../lib/documentRequests';

const interviewStatus: Record<string, string> = {
  requested: 'Awaiting admin confirmation',
  approving: 'Being confirmed',
  booked: 'Interview confirmed',
  cancelled: 'Interview cancelled',
  rejected: 'Request declined',
  completed: 'Interview completed',
  no_show: 'Interview marked missed',
};

export default function StudentNotifications({ bookings, navigate }: { bookings: Row[]; navigate: (path: string) => void }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (details.current?.open && !details.current.contains(event.target as Node)) details.current.open = false;
    };
    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, []);
  async function loadRequests() {
    setLoading(true); setRequestError(false);
    try { setRequests(await rpc<DocumentRequest[]>('lms_student_document_requests')); }
    catch { setRequestError(true); }
    finally { setLoading(false); }
  }
  function go(path: string) { if (details.current) details.current.open = false; navigate(path); }
  const recentBookings = [...bookings].sort((a, b) => Date.parse(b.created_at || b.starts_at) - Date.parse(a.created_at || a.starts_at)).slice(0, 3);
  return <details ref={details} className="student-notifications" onToggle={event => { if (event.currentTarget.open) void loadRequests(); }} onKeyDown={event => { if (event.key === 'Escape' && details.current?.open) { details.current.open = false; details.current.querySelector('summary')?.focus(); } }}>
    <summary aria-label="Notifications" title="Notifications"><Bell size={20}/></summary>
    <div className="student-notifications-panel">
      <h2>Updates</h2>
      <p className="student-notifications-caption">Your latest interview and document activity.</p>
      {recentBookings.map(row => <button type="button" key={row.id} onClick={() => go('/student/mocks')}><span className="student-notification-icon"><CalendarDays size={16}/></span><span><strong>{interviewStatus[row.status] || 'Mock interview update'}</strong><small>{displayDate(row.starts_at)}</small></span><ChevronRight size={16}/></button>)}
      {loading && <p className="student-notifications-message" role="status">Loading document updates…</p>}
      {!loading && requests.slice(0, 3).map(row => <button type="button" key={row.id} onClick={() => go('/student/documents')}><span className="student-notification-icon"><FileText size={16}/></span><span><strong>{requestTitle(row)}</strong><small>{requestStatus(row.status)}</small></span><ChevronRight size={16}/></button>)}
      {!loading && requestError && <p className="student-notifications-message">Document updates are unavailable right now.</p>}
      {!loading && !requestError && !recentBookings.length && !requests.length && <p className="student-notifications-message">No updates yet.</p>}
    </div>
  </details>;
}
