import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  BookOpen,
  FileStack,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  ShieldCheck,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';
import { documentSections, getDocumentSection, StudioLink } from './DocumentNavigation';
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
    { path: '/materials', label: 'Materials', icon: BookOpen },
    { path: '/mock-interviews', label: 'Mock interviews', icon: MessagesSquare },
  ] },
  { label: 'Operations', items: [
    { path: '/documents', label: 'Document Studio', icon: FileStack },
  ] },
  { label: 'Administration', items: [
    { path: '/team', label: 'Admins', icon: ShieldCheck },
  ] },
];

const pageTitles = navGroups.flatMap((group) => group.items).reduce<Record<string, string>>((titles, item) => {
  titles[item.path] = item.label;
  return titles;
}, {});

export default function Navbar({ path, navigate, settings, userEmail, darkMode, setDarkMode, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current as HTMLDivElement | null;
    dialog?.querySelector<HTMLButtonElement>('[data-close-navigation]')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')).filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const closeOnDesktop = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', closeOnDesktop);
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', closeOnDesktop);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mobileOpen]);
  const documentSection = getDocumentSection(path);
  const isDocumentPath = Boolean(documentSection);
  const currentTitle = isDocumentPath ? (path === '/documents' ? 'Document Studio' : `Document Studio / ${documentSection!.label}`) : pageTitles[path] || 'LMS Admin';

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
                return <div key={item.path}><button onClick={() => { navigate(item.path); setMobileOpen(false); }} aria-current={active ? (item.path === path ? 'page' : 'location') : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${active ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-cyan-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}><Icon size={18} className={active ? 'text-sky-600 dark:text-cyan-300' : 'text-slate-400'} /><span>{item.label}</span></button>
                  {item.path === '/documents' && isDocumentPath && <div className="ml-5 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700">{documentSections.filter(section => section.path !== '/documents').map(section => <StudioLink key={section.path} href={section.path} navigate={to => { navigate(to); setMobileOpen(false); }} aria-current={documentSection?.path === section.path ? 'page' : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${documentSection?.path === section.path ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-cyan-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{section.label}</StudioLink>)}</div>}
                </div>;
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

    {mobileOpen && <div ref={dialogRef} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation"><button className="absolute inset-0 h-full w-full bg-slate-950/60" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /><aside className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] shadow-2xl">{sidebar}<button data-close-navigation onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close navigation"><X size={18} /></button></aside></div>}
  </>;
}
