import { NotificationBadge } from '../lms/StudentNotifications';
import type { ComponentProps, MouseEvent } from 'react';
import { ArrowLeft, Award, ChevronRight, FileText, LayoutGrid, Mail, Receipt, Settings } from 'lucide-react';

export const documentSections = [
  { path: '/documents', label: 'Overview', icon: LayoutGrid },
  { path: '/document-requests', label: 'Student requests', icon: FileText },
  { path: '/invoice/old', label: 'Invoices', icon: FileText, base: '/invoice' },
  { path: '/certificate/old', label: 'Certificates', icon: Award, base: '/certificate' },
  { path: '/letter/old', label: 'Letters', icon: Mail, base: '/letter' },
  { path: '/payslip/old', label: 'Payslips', icon: Receipt, base: '/payslip' },
  { path: '/settings', label: 'Document settings', icon: Settings },
];

export function getDocumentSection(path: string) {
  return documentSections.find(section => path === section.path || (path === '/certificate-requests' && section.path === '/document-requests') || (section.base && path.startsWith(`${section.base}/`)));
}

export function getDocumentBackLink(path: string) {
  const section = getDocumentSection(path);
  if (!section) return null;
  if (path === '/documents') return { path: '/', label: 'Back to LMS overview' };
  if (section.base && path !== section.path) return { path: section.path, label: `Back to ${section.label.toLowerCase()}` };
  return { path: '/documents', label: 'Back to Documents' };
}

type StudioLinkProps = ComponentProps<'a'> & { navigate: (path: string) => void; href: string };
export function StudioLink({ navigate, href, onClick, ...props }: StudioLinkProps) {
  return <a {...props} href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate(href);
    }
  }} />;
}

export default function DocumentNavigation({ path, navigate, editing = false }: { path: string; navigate: (path: string) => void; editing?: boolean }) {
  const section = getDocumentSection(path);
  const back = getDocumentBackLink(path);
  if (!section || !back) return null;
  const action = path.endsWith('/new') ? (editing ? 'Edit' : 'Create') : path.endsWith('/bulk') ? 'Bulk generation' : null;
  return <div className="document-navigation mb-6 space-y-4 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <nav aria-label="Breadcrumb" className="text-xs font-medium text-slate-600 dark:text-slate-300">
        <ol className="flex flex-wrap items-center gap-2">
          <li><StudioLink navigate={navigate} href="/" className="studio-link">LMS admin</StudioLink></li>
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li>{path === '/documents' ? <span aria-current="page" className="font-semibold text-slate-900 dark:text-white">Documents</span> : <StudioLink navigate={navigate} href="/documents" className="studio-link">Documents</StudioLink>}</li>
          {path !== '/documents' && <><li aria-hidden="true"><ChevronRight size={14} /></li><li>{action ? <StudioLink navigate={navigate} href={section.path} className="studio-link">{section.label}</StudioLink> : <span aria-current="page" className="font-semibold text-slate-900 dark:text-white">{section.label}</span>}</li></>}
          {action && <><li aria-hidden="true"><ChevronRight size={14} /></li><li aria-current="page" className="font-semibold text-slate-900 dark:text-white">{action}</li></>}
        </ol>
      </nav>
      <StudioLink navigate={navigate} href={back.path} className="studio-button studio-button-secondary text-xs"><ArrowLeft size={15} />{back.label}</StudioLink>
    </div>
    <nav aria-label="Documents sections" className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3 xl:flex">
      {documentSections.map(item => {
        const active = section.path === item.path;
        const Icon = item.icon;
        return <StudioLink key={item.path} navigate={navigate} href={item.path} aria-current={active ? 'page' : undefined} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 xl:flex-1 ${active ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-cyan-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Icon size={16} aria-hidden="true" />{item.label}<NotificationBadge path={item.path}/></StudioLink>;
      })}
    </nav>
  </div>;
}
