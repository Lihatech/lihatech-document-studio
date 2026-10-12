import { useEffect, useState, type FormEvent } from 'react';
import { GraduationCap, Mail, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { LMS_API_BASE_URL, lmsRequest } from '../lib/lmsApi';

type TeamRole = 'instructor' | 'admin';
type StaffProfile = { firebase_uid: string; email: string; full_name: string; role: TeamRole; is_active: boolean };
type StaffInvitation = { id: string; email: string; full_name: string; role: TeamRole; expires_at: string };

export default function TeamManagement() {
  const [role, setRole] = useState<TeamRole>('instructor');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!LMS_API_BASE_URL) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    lmsRequest<{ staff: StaffProfile[]; invitations: StaffInvitation[] }>(`/admin/users?role=${role}`, { signal: controller.signal })
      .then((result) => { setStaff(result.staff); setInvitations(result.invitations); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load staff.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [role]);

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!LMS_API_BASE_URL) {
      setMessage({ text: 'The invite screen is ready, but account creation needs the FastAPI backend and Firebase Admin SDK. No account was created.', error: true });
      return;
    }

    setBusy(true);
    try {
      const invitation = await lmsRequest<StaffInvitation>('/admin/users/invitations', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), role }),
      });
      setInvitations((current) => [invitation, ...current.filter((item) => item.id !== invitation.id)]);
      setMessage({ text: `Access invite created. Share the panel URL; ${email.trim()} must sign in with this exact Google email before ${new Date(invitation.expires_at).toLocaleDateString()}.`, error: false });
      setFullName('');
      setEmail('');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not send the invitation.', error: true });
    } finally {
      setBusy(false);
    }
  }

  const isInstructor = role === 'instructor';

  return <div className="mx-auto max-w-6xl space-y-6 py-2">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-cyan-300"><UsersRound size={13} /> Team administration</div><h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">Instructors & admins</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Invite staff to the LMS and choose the access level they need.</p></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div aria-label="Select staff role" className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
          <button type="button" aria-pressed={isInstructor} onClick={() => { setRole('instructor'); setMessage(null); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${isInstructor ? 'bg-white text-sky-800 shadow-sm dark:bg-slate-800 dark:text-cyan-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}><GraduationCap size={17} />Instructors</button>
          <button type="button" aria-pressed={!isInstructor} onClick={() => { setRole('admin'); setMessage(null); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${!isInstructor ? 'bg-white text-sky-800 shadow-sm dark:bg-slate-800 dark:text-cyan-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}><ShieldCheck size={17} />Admins</button>
        </div>

        <div className="mb-5"><h2 className="text-lg font-extrabold text-slate-950 dark:text-white">Invite a new {role}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">They’ll use their Google account to sign in after the invitation is created.</p></div>
        <form onSubmit={submitInvitation} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name<input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Alex Perera" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Google account email<span className="relative mt-2 block"><Mail size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></span></label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">Access level</p><p className="mt-1 text-sm font-bold capitalize text-slate-900 dark:text-white">{role}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{isInstructor ? 'Can teach assigned courses and support assigned batches.' : 'Can manage LMS operations and staff access.'}</p></div>
          {message && <div role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-5 ${message.error ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>{message.text}</div>}
          <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#078EDB] px-4 text-sm font-bold text-white transition hover:bg-[#07547E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"><UserPlus size={17} />{busy ? 'Creating access invite…' : `Invite ${role}`}</button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">{role === 'admin' ? 'Admins' : 'Instructors'}</h3>
          {loading ? <p className="py-6 text-sm text-slate-500">Loading staff…</p> : loadError ? <p role="alert" className="py-4 text-sm text-rose-700 dark:text-rose-300">{loadError}</p> : <>
            {staff.length > 0 ? <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{staff.map((member) => <li key={member.firebase_uid} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{member.full_name || member.email}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${member.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{member.is_active ? 'Active' : 'Inactive'}</span></li>)}</ul> : <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No active {role}s yet.</p>}
            {invitations.length > 0 && <><h4 className="mt-5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Pending access invites</h4><ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">{invitations.map((invite) => <li key={invite.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{invite.full_name}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{invite.email}</p></div><span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Pending</span></li>)}</ul></>}
          </>}
        </div>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-sky-700 dark:text-cyan-300" /><h2 className="text-sm font-extrabold text-slate-950 dark:text-white">No-email onboarding</h2></div><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Create an access invite here, then share the admin-panel URL yourself. The person must sign in with Google using the exact invited email. FastAPI verifies their Firebase ID token and activates their profile; no password is created or emailed.</p><div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">{LMS_API_BASE_URL ? 'Backend connected. Invitations expire after 7 days.' : 'Set VITE_LMS_API_BASE_URL and start the FastAPI service to enable invites.'}</div></aside>
    </div>
  </div>;
}
