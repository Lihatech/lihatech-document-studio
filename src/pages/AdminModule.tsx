import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FilePlus2,
  Layers3,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';

export type AdminModuleKey = 'students' | 'batches' | 'courses' | 'lectures' | 'mocks' | 'certificates' | 'reports';

type ModuleRow = {
  id: string;
  cells: string[];
  status: string;
};

type ModuleConfig = {
  label: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  primaryAction: string;
  columns: string[];
  operations: string[];
  actions: string[];
  rows: ModuleRow[];
};

const moduleConfigs: Record<AdminModuleKey, ModuleConfig> = {
  students: {
    label: 'Students', eyebrow: 'STUDENT MANAGEMENT', description: 'Create accounts, control access, assign batches, and review learner progress.', icon: UsersRound, primaryAction: 'Add student', columns: ['Student', 'Batch', 'Progress', 'Access', 'Last active'], operations: ['Create account', 'Send invitation', 'Edit details', 'Suspend or activate', 'Reset access', 'Move batch', 'View progress', 'Add internal note'], actions: ['Edit', 'Suspend', 'Reset access'], rows: [
      { id: 's1', cells: ['Aarav Perera\naarav.perera@example.com', 'AI Engineering · 04', '82%', 'Active', 'Today'], status: 'Active' },
      { id: 's2', cells: ['Shahid Himmat Shaikh\nshahidshaikh3332@gmail.com', 'Full Stack & AI · 03', '68%', 'Active', 'Today'], status: 'Active' },
      { id: 's3', cells: ['Nethmi Fernando\nnethmi.fernando@example.com', 'Data Analytics · 07', '54%', 'Review', 'Yesterday'], status: 'Review' },
      { id: 's4', cells: ['Ruwan Jayasuriya\nruwan.j@example.com', 'AI Engineering · 04', '31%', 'Suspended', '4 days ago'], status: 'Suspended' },
    ],
  },
  batches: {
    label: 'Batches', eyebrow: 'BATCH MANAGEMENT', description: 'Plan cohorts, assign instructors and courses, and monitor batch progress.', icon: Layers3, primaryAction: 'Create batch', columns: ['Batch', 'Dates', 'Students', 'Instructor', 'Status'], operations: ['Create batch', 'Edit dates', 'Assign courses', 'Assign instructor', 'Add or remove students', 'Pause or complete', 'Extend duration', 'View progress'], actions: ['Edit', 'View progress'], rows: [
      { id: 'b1', cells: ['AI Engineering · Batch 04', '01 Sep – 30 Nov 2026', '28 students', 'Mihir Fernando', 'Active'], status: 'Active' },
      { id: 'b2', cells: ['Full Stack & AI · Batch 03', '15 Aug – 15 Dec 2026', '36 students', 'Shoaib Qaisar', 'Active'], status: 'Active' },
      { id: 'b3', cells: ['Data Analytics · Batch 07', '01 Oct – 30 Dec 2026', '22 students', 'Nethmi Perera', 'Starting'], status: 'Starting' },
    ],
  },
  courses: {
    label: 'Courses', eyebrow: 'COURSE & CONTENT MANAGEMENT', description: 'Build course structures, manage linked content, and publish the learning path.', icon: BookOpen, primaryAction: 'Create course', columns: ['Course', 'Content', 'Duration', 'Assigned batches', 'Status'], operations: ['Create course', 'Edit information', 'Add modules and lessons', 'Add videos and links', 'Add syllabus and notes', 'Add project instructions', 'Reorder lessons', 'Publish or hide'], actions: ['Edit content', 'Manage access'], rows: [
      { id: 'c1', cells: ['Agentic AI Engineering', '8 modules · 42 lessons', '12 weeks', 'AI Engineering · 04', 'Published'], status: 'Published' },
      { id: 'c2', cells: ['Full Stack Web Development', '10 modules · 58 lessons', '16 weeks', 'Batch 03', 'Published'], status: 'Published' },
      { id: 'c3', cells: ['Data Analytics Foundations', '6 modules · 24 lessons', '10 weeks', 'Batch 07', 'Draft'], status: 'Draft' },
    ],
  },
  lectures: {
    label: 'Live lectures', eyebrow: 'LIVE LECTURE MANAGEMENT', description: 'Schedule sessions, attach Meet links and materials, and keep learners informed.', icon: Video, primaryAction: 'Create lecture', columns: ['Lecture', 'Batch', 'Instructor', 'Date & time', 'Status'], operations: ['Create lecture', 'Assign batch', 'Add instructor', 'Add Meet link', 'Add notes and materials', 'Add recording later', 'Reschedule', 'Cancel or complete'], actions: ['Edit', 'Reschedule', 'Cancel'], rows: [
      { id: 'l1', cells: ['Building RAG applications', 'AI Engineering · 04', 'Mihir Fernando', '13 Oct · 6:00 PM', 'Scheduled'], status: 'Scheduled' },
      { id: 'l2', cells: ['Portfolio review workshop', 'Full Stack & AI · 03', 'Shoaib Qaisar', '15 Oct · 5:30 PM', 'Scheduled'], status: 'Scheduled' },
      { id: 'l3', cells: ['Python data pipelines', 'Data Analytics · 07', 'Nethmi Perera', '08 Oct · 6:00 PM', 'Completed'], status: 'Completed' },
    ],
  },
  mocks: {
    label: 'Mock interviews', eyebrow: 'MOCK INTERVIEW MANAGEMENT', description: 'Create mentor slots, manage bookings, and capture interview feedback.', icon: MessagesSquare, primaryAction: 'Create mock slot', columns: ['Slot', 'Mentor', 'Batch', 'Capacity', 'Status'], operations: ['Create available slot', 'Assign mentor', 'Set capacity', 'Assign batch', 'View bookings', 'Cancel or reschedule', 'Mark completed', 'Add mentor feedback'], actions: ['View bookings', 'Reschedule', 'Complete'], rows: [
      { id: 'm1', cells: ['13 Oct · 4:00 PM', 'Mihir Fernando', 'AI Engineering · 04', '3 / 5 booked', 'Open'], status: 'Open' },
      { id: 'm2', cells: ['18 Oct · 11:00 AM', 'Shoaib Qaisar', 'Full Stack & AI · 03', '5 / 5 booked', 'Full'], status: 'Full' },
      { id: 'm3', cells: ['21 Oct · 3:00 PM', 'Nethmi Perera', 'Data Analytics · 07', '0 / 4 booked', 'Open'], status: 'Open' },
    ],
  },
  certificates: {
    label: 'Certificate requests', eyebrow: 'CERTIFICATE REQUEST MANAGEMENT', description: 'Check eligibility, review requests, generate certificates, and maintain the issued record.', icon: BadgeCheck, primaryAction: 'Review queue', columns: ['Student', 'Course', 'Requested', 'Eligibility', 'Status'], operations: ['View request', 'Check completion', 'Edit details', 'Request corrections', 'Approve or reject', 'Send to Document Studio', 'Download or send', 'Issue or revoke'], actions: ['Review', 'Generate', 'Reject'], rows: [
      { id: 'r1', cells: ['Aarav Perera', 'Agentic AI Engineering', 'Today', 'Eligible · 92%', 'Pending review'], status: 'Pending' },
      { id: 'r2', cells: ['Shahid Himmat Shaikh', 'Full Stack & AI', 'Yesterday', 'Eligible · 88%', 'Approved'], status: 'Approved' },
      { id: 'r3', cells: ['Nethmi Fernando', 'Data Analytics', '04 Oct 2026', 'Needs 2 lessons', 'Correction needed'], status: 'Correction' },
    ],
  },
  reports: {
    label: 'Reports', eyebrow: 'DASHBOARD & REPORTING', description: 'Review operational signals across students, batches, lectures, mocks, and certificates.', icon: BarChart3, primaryAction: 'Export report', columns: ['Report', 'Coverage', 'Updated', 'Owner', 'Status'], operations: ['Total students', 'Active batches', 'Course completion', 'Upcoming lectures', 'Upcoming mocks', 'Pending certificates', 'Suspended students', 'Admin activity'], actions: ['View report', 'Export CSV'], rows: [
      { id: 'p1', cells: ['Student progress report', '248 students', 'Today · 09:40', 'Admin', 'Ready'], status: 'Ready' },
      { id: 'p2', cells: ['Batch completion report', '12 active batches', 'Yesterday · 18:20', 'Admin', 'Ready'], status: 'Ready' },
      { id: 'p3', cells: ['Certificate issuance report', '19 pending requests', 'Today · 09:35', 'Admin', 'Ready'], status: 'Ready' },
    ],
  },
};

interface AdminModuleProps {
  module: AdminModuleKey;
  navigate: (path: string) => void;
}

export default function AdminModule({ module, navigate }: AdminModuleProps) {
  const config = moduleConfigs[module];
  const Icon = config.icon;
  const [rows, setRows] = useState(config.rows);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showComposer, setShowComposer] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [notice, setNotice] = useState('');

  const statuses = ['All', ...new Set(rows.map((row) => row.status))];
  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = !query || row.cells.join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [query, rows, statusFilter]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  function createRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!draftName.trim()) return;
    setRows((current) => [{ id: `new-${Date.now()}`, cells: [draftName.trim(), 'Not assigned', '—', 'Draft', 'Just now'], status: 'Draft' }, ...current]);
    setDraftName('');
    setShowComposer(false);
    showNotice(`${config.label.slice(0, -1)} created in demo data.`);
  }

  function runAction(row: ModuleRow, action: string) {
    if (action === 'Suspend') {
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: 'Suspended', cells: item.cells.map((cell, index) => index === 3 ? 'Suspended' : cell) } : item));
    }
    showNotice(`${action} queued for ${row.cells[0].split('\n')[0]}.`);
  }

  return (
    <div className="space-y-6 animate-fade-in py-2">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"><Icon size={13} /> {config.eyebrow}</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{config.label}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{config.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {module !== 'reports' && <button onClick={() => setShowComposer((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#078EDB] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#07547E]"><Plus size={16} /> {config.primaryAction}</button>}
          {module === 'reports' && <button onClick={() => showNotice('Report export prepared in demo mode.')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#078EDB] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#07547E]"><Download size={16} /> {config.primaryAction}</button>}
          <button onClick={() => navigate('/')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:text-teal-300"><ShieldCheck size={16} /> Admin overview</button>
        </div>
      </section>

      {showComposer && <form onSubmit={createRecord} className="flex flex-col gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-800 dark:bg-teal-950/30 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-bold text-teal-900 dark:text-teal-200">Name or title<input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={`e.g. ${config.label === 'Students' ? 'New learner' : `New ${config.label.slice(0, -1).toLowerCase()}`}`} className="mt-2 min-h-11 w-full rounded-xl border border-teal-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-teal-800 dark:bg-slate-950 dark:text-white" /></label><button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800"><Check size={16} /> Create</button><button type="button" onClick={() => setShowComposer(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 text-sm font-bold text-teal-800 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-300"><X size={16} /> Cancel</button></form>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon={<Icon size={18} />} label="Total records" value={String(rows.length)} />
        <SummaryCard icon={<Check size={18} />} label="Active or ready" value={String(rows.filter((row) => ['Active', 'Published', 'Scheduled', 'Open', 'Approved', 'Ready'].includes(row.status)).length)} />
        <SummaryCard icon={<Pencil size={18} />} label="Needs attention" value={String(rows.filter((row) => !['Active', 'Published', 'Scheduled', 'Open', 'Approved', 'Ready', 'Completed'].includes(row.status)).length)} />
        <SummaryCard icon={<UserPlus size={18} />} label="This month" value="+18" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-extrabold text-slate-950 dark:text-white">Operational records</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Demo data now; FastAPI-backed records next.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.label.toLowerCase()}`} aria-label={`Search ${config.label}`} className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:w-56" /></label><label className="relative"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status" className="min-h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:w-36">{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></label></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:text-slate-400"><tr>{config.columns.map((column) => <th key={column} className="pb-3 pr-4">{column}</th>)}<th className="pb-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredRows.map((row) => <tr key={row.id} className="group hover:bg-teal-50/50 dark:hover:bg-teal-950/20"><td className="py-4 pr-4 font-bold text-slate-900 dark:text-white">{row.cells[0].split('\n').map((line, index) => <React.Fragment key={line}>{index > 0 && <span className="block mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400" />}{line}</React.Fragment>)}</td>{row.cells.slice(1).map((cell, index) => <td key={`${row.id}-${index}`} className="py-4 pr-4 text-slate-600 dark:text-slate-300">{index === row.cells.length - 2 ? <StatusBadge status={cell} /> : cell}</td>)}<td className="py-4 text-right"><div className="flex flex-wrap justify-end gap-1.5">{config.actions.map((action) => <button key={action} onClick={() => runAction(row, action)} className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-700 dark:hover:text-teal-300">{action}</button>)}</div></td></tr>)}</tbody></table>{!filteredRows.length && <p className="py-10 text-center text-sm text-slate-500">No records match your filters.</p>}</div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"><div className="mb-4 flex items-center gap-2"><FilePlus2 size={17} className="text-teal-600" /><h2 className="text-sm font-extrabold text-slate-950 dark:text-white">Admin operations</h2></div><ul className="space-y-2.5">{config.operations.map((operation) => <li key={operation} className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />{operation}</li>)}</ul><div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Only administrators can change these records. Students receive the result through the LMS.</div></aside>
      </section>
      {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl"><Check size={16} className="text-emerald-400" />{notice}</div>}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">{icon}</div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><strong className="mt-1 block text-2xl font-extrabold text-slate-950 dark:text-white">{value}</strong></div>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['Active', 'Published', 'Scheduled', 'Open', 'Approved', 'Ready', 'Completed'].includes(status) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : status === 'Suspended' || status === 'Correction' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{status}</span>;
}
