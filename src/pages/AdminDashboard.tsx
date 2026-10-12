import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

const learners = [
  { name: 'Aarav Perera', email: 'aarav.perera@example.com', programme: 'AI Engineering', progress: 82, status: 'On track', lastActive: 'Today' },
  { name: 'Shahid Himmat Shaikh', email: 'shahidshaikh3332@gmail.com', programme: 'Full Stack & AI', progress: 68, status: 'On track', lastActive: 'Today' },
  { name: 'Nethmi Fernando', email: 'nethmi.fernando@example.com', programme: 'Data Analytics', progress: 54, status: 'Needs review', lastActive: 'Yesterday' },
  { name: 'Ruwan Jayasuriya', email: 'ruwan.j@example.com', programme: 'AI Engineering', progress: 31, status: 'Needs review', lastActive: '4 days ago' },
];

const activity = [
  ['Certificate request', 'Aarav Perera requested an AI Engineering certificate', '12 min ago'],
  ['New enrolment', 'Nethmi Fernando joined Data Analytics · Batch 07', '48 min ago'],
  ['Document generated', 'Offer letter generated for Ruwan Jayasuriya', '2 hours ago'],
];

export default function AdminDashboard({ navigate }: AdminDashboardProps) {
  const [query, setQuery] = useState('');
  const [synced, setSynced] = useState(false);

  const filteredLearners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return learners;
    return learners.filter((learner) =>
      `${learner.name} ${learner.email} ${learner.programme}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  return (
    <div className="space-y-7 animate-fade-in py-2" id="lms-admin-dashboard">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
              LMS admin console
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Demo data
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Keep the learning engine moving.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Manage learners, programmes, certificates, and operational documents from one control centre.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSynced(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:text-teal-300"
          >
            <RefreshCw size={16} className={synced ? 'text-emerald-600' : ''} />
            {synced ? 'Synced just now' : 'Sync LMS'}
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#078EDB] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#07547E]"
          >
            <FileStack size={16} />
            Open Document Studio
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="LMS summary">
        <MetricCard icon={<UsersRound size={19} />} label="Active learners" value="248" note="+18 this month" tone="teal" />
        <MetricCard icon={<BookOpen size={19} />} label="Active programmes" value="12" note="4 cohorts starting soon" tone="blue" />
        <MetricCard icon={<GraduationCap size={19} />} label="Avg. completion" value="68%" note="+6% vs last month" tone="amber" />
        <MetricCard icon={<Award size={19} />} label="Pending certificates" value="19" note="7 need review" tone="rose" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Learner operations</p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">Progress that needs your attention</h2>
            </div>
            <label className="relative block sm:w-64">
              <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search learners"
                aria-label="Search learners"
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr><th className="pb-3 pr-4">Learner</th><th className="pb-3 pr-4">Programme</th><th className="pb-3 pr-4">Progress</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Active</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLearners.map((learner) => (
                  <tr key={learner.email} className="group hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
                    <td className="py-4 pr-4"><div className="font-bold text-slate-900 dark:text-white">{learner.name}</div><div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{learner.email}</div></td>
                    <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">{learner.programme}</td>
                    <td className="py-4 pr-4"><div className="flex items-center gap-3"><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-teal-500" style={{ width: `${learner.progress}%` }} /></div><span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{learner.progress}%</span></div></td>
                    <td className="py-4 pr-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${learner.status === 'On track' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>{learner.status}</span></td>
                    <td className="py-4 text-xs text-slate-500 dark:text-slate-400">{learner.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredLearners.length && <p className="py-8 text-center text-sm text-slate-500">No learners match “{query}”.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Recent activity</p><h2 className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">What changed today</h2></div><CheckCircle2 className="text-emerald-500" size={21} /></div>
          <div className="space-y-5">{activity.map(([title, detail, time]) => <div key={title} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500 ring-4 ring-teal-500/10" /><div><p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p><time className="mt-1 block text-[11px] font-medium text-slate-400">{time}</time></div></div>)}</div>
          <button onClick={() => navigate('/certificate/old')} className="mt-6 inline-flex min-h-10 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:text-teal-300">Review certificate queue <ChevronRight size={15} /></button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Workspace modules</p><h2 className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">Run the LMS from one place</h2></div><span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">FastAPI-ready integration seams</span></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ModuleCard icon={<FileStack size={20} />} title="Document Studio" detail="Invoices, certificates, letters, and payslips" action="Open module" onClick={() => navigate('/documents')} tone="blue" />
          <ModuleCard icon={<UsersRound size={20} />} title="Learners & cohorts" detail="Track enrolments, progress, and attention flags" action="Connect to API next" tone="teal" />
          <ModuleCard icon={<BookOpen size={20} />} title="Programmes" detail="Manage course presets and upcoming batches" action="Connect to API next" tone="amber" />
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">This dashboard currently uses local demo data. The UI is intentionally ready for a FastAPI service without coupling the document generators to the LMS database.</p>
    </div>
  );
}

function MetricCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: 'teal' | 'blue' | 'amber' | 'rose' }) {
  const tones = { teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300', blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300', rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className={`mb-5 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><div className="mt-1 flex items-end justify-between gap-3"><strong className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{value}</strong><span className="text-right text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{note}</span></div></div>;
}

function ModuleCard({ icon, title, detail, action, onClick, tone }: { icon: React.ReactNode; title: string; detail: string; action: string; onClick?: () => void; tone: 'blue' | 'teal' | 'amber' }) {
  const tones = { blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300', teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' };
  return <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"><div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div><h3 className="text-base font-extrabold text-slate-950 dark:text-white">{title}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">{detail}</p>{onClick ? <button onClick={onClick} className="mt-5 inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-teal-700 transition group-hover:gap-3 dark:text-teal-300">{action}<ArrowUpRight size={15} /></button> : <span className="mt-5 inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-slate-400 dark:text-slate-500">{action}<ArrowUpRight size={15} /></span>}</article>;
}
