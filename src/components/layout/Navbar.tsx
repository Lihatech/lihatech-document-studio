import { useState } from 'react';
import {
  BarChart3,
  BadgeCheck,
  BookOpen,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import type { CompanySettings } from '../../types';
import companyLogo from '../../../only_logo-removebg-preview.png';

interface NavbarProps {
  path: string;
  navigate: (toPath: string) => void;
  settings: CompanySettings;
  userEmail: string | null;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onLogout: () => void;
}

const navGroups = [
  { label: 'Workspace', items: [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
  ] },
  { label: 'Learning', items: [
    { path: '/students', label: 'Students', icon: UsersRound },
    { path: '/batches', label: 'Batches', icon: Layers3 },
    { path: '/courses', label: 'Courses', icon: BookOpen },
    { path: '/lectures', label: 'Live lectures', icon: Video },
    { path: '/mock-interviews', label: 'Mock interviews', icon: MessagesSquare },
  ] },
  { label: 'Operations', items: [
    { path: '/certificate-requests', label: 'Certificates', icon: BadgeCheck },
    { path: '/documents', label: 'Document Studio', icon: FileStack },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
  ] },
  { label: 'Administration', items: [
    { path: '/team', label: 'Instructors & admins', icon: GraduationCap },
    { path: '/settings', label: 'Settings', icon: Settings },
  ] },
];

const pageTitles = navGroups.flatMap((group) => group.items).reduce<Record<string, string>>((titles, item) => {
  titles[item.path] = item.label;
  return titles;
}, {});

export default function Navbar({ path, navigate, settings, userEmail, darkMode, setDarkMode, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDocumentPath = path === '/documents' || ['/invoice/', '/certificate/', '/letter/', '/payslip/'].some((prefix) => path.startsWith(prefix));
  const currentTitle = pageTitles[path] || (isDocumentPath ? 'Document Studio' : 'LMS Admin');

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      <button onClick={() => { navigate('/'); setMobileOpen(false); }} className="flex min-h-[76px] items-center gap-3 border-b border-slate-200 px-5 text-left dark:border-slate-800" aria-label="Go to overview">
        <img src={companyLogo} alt="" className="h-10 w-10 object-contain" />
        <span className="min-w-0"><span className="block truncate text-sm font-extrabold text-slate-950 dark:text-white">{settings.name}</span><span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-cyan-300">LMS Admin</span></span>
      </button>

      <nav aria-label="Admin navigation" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = path === item.path || (item.path === '/documents' && isDocumentPath) || (item.path === '/' && path === '/lms');
                return <button key={item.path} onClick={() => { navigate(item.path); setMobileOpen(false); }} aria-current={active ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${active ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-cyan-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}><Icon size={18} className={active ? 'text-sky-600 dark:text-cyan-300' : 'text-slate-400'} /><span>{item.label}</span></button>;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-800 dark:bg-sky-950 dark:text-cyan-300">{(userEmail?.[0] || 'A').toUpperCase()}</div>
          <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">Admin account</p><p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{userEmail || 'Authenticated'}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}{darkMode ? 'Light' : 'Dark'}</button>
          <button onClick={onLogout} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"><LogOut size={16} />Sign out</button>
        </div>
      </div>
    </div>
  );

  return <>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 shadow-sm dark:border-slate-800 lg:block">{sidebar}</aside>

    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6 lg:ml-64 lg:px-8">
      <button onClick={() => setMobileOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
      <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">{currentTitle}</p><p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">LihaTech learning operations</p></div>
      <div className="ml-auto hidden items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 sm:flex"><ShieldCheck size={15} />Secure admin session</div>
    </header>

    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation"><button className="absolute inset-0 h-full w-full bg-slate-950/60" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /><aside className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] shadow-2xl">{sidebar}<button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close navigation"><X size={18} /></button></aside></div>}
  </>;
}
