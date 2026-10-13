import { ArrowUpRight, Award, FileText, FolderOpen, Mail, Plus, Receipt, Settings } from 'lucide-react';
import type { StudioData } from '../lib/documentStudio';
import { StudioLink } from '../components/layout/DocumentNavigation';

interface HomeProps { navigate: (path: string) => void; data: StudioData }
const tools = [
  { collection: 'invoices', title: 'Invoices', detail: 'Create invoices, track payments, and manage billing records.', icon: FileText, base: '/invoice', action: 'Create invoice', tone: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300' },
  { collection: 'certificates', title: 'Certificates', detail: 'Issue individual or bulk certificates with your saved branding.', icon: Award, base: '/certificate', action: 'Create certificate', tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300' },
  { collection: 'letters', title: 'Letters', detail: 'Prepare offer, experience, and relieving letters for your team.', icon: Mail, base: '/letter', action: 'Create letter', tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' },
  { collection: 'payslips', title: 'Payslips', detail: 'Generate monthly payslips using your saved employee profiles.', icon: Receipt, base: '/payslip', action: 'Create payslip', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' },
] as const;

export default function Home({ navigate, data }: HomeProps) {
  return <div className="space-y-6" id="home-dashboard">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold text-sky-700 dark:text-cyan-300">Operations / Documents</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">Document Studio</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Create, manage, and export your organisation's documents from the LMS admin portal.</p>
      </div>
      <StudioLink navigate={navigate} href="/settings" className="studio-button studio-button-secondary text-sm"><Settings size={16} />Document settings</StudioLink>
    </section>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Saved document totals">
      {tools.map(tool => {
        const Icon = tool.icon;
        return <StudioLink key={tool.collection} navigate={navigate} href={`${tool.base}/old`} className="studio-stat rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tool.tone}`}><Icon size={19} /></span><ArrowUpRight size={16} className="text-slate-500" /></div>
          <p className="mt-4 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">{data[tool.collection].length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Saved {tool.title.toLowerCase()}</p>
        </StudioLink>;
      })}
    </section>
    <section aria-labelledby="document-tools-title">
      <div className="mb-4"><h2 id="document-tools-title" className="text-lg font-bold text-slate-950 dark:text-white">Create a document</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose a tool to start, or open its saved records.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map(tool => {
          const Icon = tool.icon;
          return <article key={tool.collection} id={`${tool.collection}-tool`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tool.tone}`}><Icon size={20} /></span><div><h3 className="text-base font-bold text-slate-950 dark:text-white">{tool.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{tool.detail}</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2">
              <StudioLink navigate={navigate} href={`${tool.base}/new`} className="studio-button studio-button-primary text-xs"><Plus size={16} />{tool.action}</StudioLink>
              <StudioLink navigate={navigate} href={`${tool.base}/old`} className="studio-button studio-button-secondary text-xs"><FolderOpen size={16} />View records</StudioLink>
              {tool.collection === 'certificates' && <StudioLink navigate={navigate} href="/certificate/bulk" className="studio-button studio-button-secondary text-xs">Bulk generation<ArrowUpRight size={15} /></StudioLink>}
            </div>
          </article>;
        })}
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6" aria-labelledby="document-activity-title">
      <h2 id="document-activity-title" className="text-lg font-bold text-slate-950 dark:text-white">Recent document activity</h2>
      {data.activities.length ? <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{data.activities.slice(0, 5).map(item => <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"><p className="text-sm text-slate-700 dark:text-slate-200">{item.description}</p><time dateTime={item.timestamp} className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">No activity yet. Create your first document to get started.</p>}
    </section>
  </div>;
}
