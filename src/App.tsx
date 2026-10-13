import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getDefaultStudioData,
  normalizeSettings,
  saveStoredData,
  createActivity
} from './utils/storage';
import {
  Invoice,
  Certificate,
  CompanySettings,
  Course,
  Letter,
  Payslip,
  Client
} from './types';
import {
  firebaseConfigured,
  isAllowedCompanyUser,
  COMPANY_ACCESS_WARNING,
  subscribeToCompanyAuth,
  signOutCompany
} from './lib/firebase';
import {
  ensureSupabaseAdmin,
  supabaseConfigured,
  loadCompanySettings,
  saveCompanySettings,
} from './lib/supabase';
import { loadStudioData, saveStudioChanges, addCertificateOption, errorMessage, type StudioData } from './lib/documentStudio';
import { LMS_API_BASE_URL, lmsRequest } from './lib/lmsApi';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import InvoiceBuilder from './pages/InvoiceBuilder';
import CertificateBuilder from './pages/CertificateBuilder';
import OldInvoices from './pages/OldInvoices';
import OldCertificates from './pages/OldCertificates';
import BulkCertificateGenerator from './pages/BulkCertificateGenerator';
import LetterBuilder from './pages/LetterBuilder';
import OldLetters from './pages/OldLetters';
import PayslipBuilder from './pages/PayslipBuilder';
import OldPayslips from './pages/OldPayslips';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminModule, { type AdminModuleKey } from './pages/AdminModule';
import TeamManagement from './pages/TeamManagement';

const adminModuleByPath: Record<string, AdminModuleKey> = {
  '/students': 'students',
  '/batches': 'batches',
  '/courses': 'courses',
  '/lectures': 'lectures',
  '/mock-interviews': 'mocks',
  '/certificate-requests': 'certificates',
  '/reports': 'reports',
};

// Layout & Previews
import Navbar from './components/layout/Navbar';
import DocumentNavigation, { getDocumentSection } from './components/layout/DocumentNavigation';
import InvoicePreview from './components/invoice/InvoicePreview';
import CertificatePreview from './components/certificate/CertificatePreview';

export default function App() {
  const authConfigured = firebaseConfigured && supabaseConfigured;

  // Authentication Guard State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === 'undefined') return false;
    return false;
  });
  const [authReady, setAuthReady] = useState(!authConfigured);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');

  // Active Routing Path State (URL synchronized)
  const [path, setPath] = useState(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname;
  });

  const navigate = (toPath: string) => {
    if (path === '/invoice/new' && toPath !== path) setEditingInvoice(null);
    if (path === '/certificate/new' && toPath !== path) setEditingCertificate(null);
    if (path === '/letter/new' && toPath !== path) setEditingLetter(null);
    if (path === '/payslip/new' && toPath !== path) setEditingPayslip(null);
    window.history.pushState(null, '', toPath);
    setPath(toPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    window.scrollTo(0, 0);
    document.getElementById('route-panel-container')?.focus({ preventScroll: true });
  }, [path, isLoggedIn]);

  // Unified Database State
  const [db, setDb] = useState<StudioData>(() => getDefaultStudioData());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const busyRef = React.useRef(false);

  // Firebase handles sign-in; its ID token authenticates Supabase requests.
  useEffect(() => {
    if (!authConfigured) return;

    return subscribeToCompanyAuth(async (user) => {
      if (!user) {
        localStorage.removeItem('lt_is_logged_in');
        setIsLoggedIn(false);
        setAuthEmail(null);
        setAuthReady(true);
        return;
      }

      try {
        if (!isAllowedCompanyUser(user)) throw new Error(COMPANY_ACCESS_WARNING);
        try {
          await ensureSupabaseAdmin(user.uid);
        } catch (profileError) {
          if (!LMS_API_BASE_URL) throw profileError;
          await lmsRequest('/auth/provision', { method: 'POST', body: JSON.stringify({}) });
          await ensureSupabaseAdmin(user.uid);
        }
        const sharedSettings = await loadCompanySettings();
        const sharedData = await loadStudioData(getDefaultStudioData());
        sharedData.settings = normalizeSettings(sharedSettings || {});
        setDb(sharedData);
        setAuthEmail(user.email ?? null);
        setAuthError('');
        localStorage.setItem('lt_is_logged_in', 'true');
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Supabase admin profile is unavailable.', error);
          const supabaseMessage =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
                ? String(error.message)
                : 'Could not verify admin access in Supabase.';
          setAuthError(supabaseMessage);
        await signOutCompany();
        localStorage.removeItem('lt_is_logged_in');
        setIsLoggedIn(false);
        setAuthEmail(null);
      }
      finally {
        setAuthReady(true);
      }
    });
  }, [authConfigured]);

  // Editing pointers for Builders
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);

  // Active Previews in Dialog overlays
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('lt_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  // Apply dark class to document node
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lt_theme', theme);
  }, [theme]);

  const updateDbState = async (updates: Partial<StudioData>, activity?: ReturnType<typeof createActivity>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true; setSaving(true); setSaveError('');
    const changes = activity ? { ...updates, activities: [activity, ...db.activities] } : updates;
    try {
      await saveStudioChanges(db, changes);
      setDb(current => ({ ...current, ...changes }));
      return true;
    } catch (error) {
      setSaveError(errorMessage(error));
      return false;
    } finally { busyRef.current = false; setSaving(false); }
  };

  // Logout handler
  const handleLogout = () => {
    if (busyRef.current) return;
    localStorage.removeItem('lt_is_logged_in');
    setIsLoggedIn(false);
    setAuthEmail(null);
    setAuthError('');
    if (firebaseConfigured) void signOutCompany();
    navigate('/');
  };

  // Every document type uses the same durable save/archive path.
  type DocumentCollection = 'invoices' | 'certificates' | 'letters' | 'payslips';
  const saveDocument = async (collection: DocumentCollection, document: Invoice | Certificate | Letter | Payslip,
    route: string, type: Parameters<typeof createActivity>[0], description: string) => {
    const rows = db[collection] as (Invoice | Certificate | Letter | Payslip)[];
    const updated = rows.some(row => row.id === document.id)
      ? rows.map(row => row.id === document.id ? document : row) : [document, ...rows];
    if (!await updateDbState({ [collection]: updated }, createActivity(type, description))) return false;
    setEditingInvoice(null); setEditingCertificate(null); setEditingLetter(null); setEditingPayslip(null);
    navigate(route); return true;
  };
  const archiveDocuments = (collection: DocumentCollection, ids: string | string[], type: Parameters<typeof createActivity>[0]) => {
    const selected = Array.isArray(ids) ? ids : [ids];
    return updateDbState({ [collection]: db[collection].filter(row => !selected.includes(row.id)) },
      createActivity(type, `Removed ${selected.length} ${collection} from registry`));
  };
  const handleSaveInvoice = (row: Invoice) => saveDocument('invoices', row, '/invoice/old',
    db.invoices.some(item => item.id === row.id) ? 'invoice_updated' : 'invoice_created', `Invoice ${row.invoiceNumber} saved for ${row.clientName}`);
  const handleSaveCertificate = (row: Certificate) => saveDocument('certificates', row, '/certificate/old',
    db.certificates.some(item => item.id === row.id) ? 'certificate_updated' : 'certificate_created', `Certificate ${row.certificateId} saved for ${row.candidateName}`);
  const handleSaveLetter = (row: Letter) => saveDocument('letters', row, '/letter/old',
    db.letters.some(item => item.id === row.id) ? 'letter_updated' : 'letter_created', `${row.letterType} saved for ${row.candidateName}`);
  const handleSavePayslip = (row: Payslip) => saveDocument('payslips', row, '/payslip/old',
    db.payslips.some(item => item.id === row.id) ? 'payslip_updated' : 'payslip_created', `Payslip saved for ${row.employeeName} (${row.monthAndYear})`);
  const handleDeleteInvoice = (ids: string | string[]) => archiveDocuments('invoices', ids, 'invoice_updated');
  const handleBulkDeleteInvoices = handleDeleteInvoice;
  const handleDeleteCertificate = (ids: string | string[]) => archiveDocuments('certificates', ids, 'certificate_updated');
  const handleDeleteLetter = (id: string) => archiveDocuments('letters', id, 'letter_updated');
  const handleDeletePayslip = (id: string) => archiveDocuments('payslips', id, 'payslip_updated');
  const handleEditInvoiceTrigger = (row: Invoice) => { setEditingInvoice(row); navigate('/invoice/new'); };
  const handleEditCertificateTrigger = (row: Certificate) => { setEditingCertificate(row); navigate('/certificate/new'); };
  const handleEditLetterTrigger = (row: Letter) => { setEditingLetter(row); navigate('/letter/new'); };
  const handleEditPayslipTrigger = (row: Payslip) => { setEditingPayslip(row); navigate('/payslip/new'); };
  const handleBulkUpdateInvoiceStatus = (ids: string[], status: Invoice['status']) => updateDbState({
    invoices: db.invoices.map(row => {
      if (!ids.includes(row.id)) return row;
      const amountPaid = status === 'Paid' ? row.totalAmount : status === 'Unpaid' ? 0 : row.amountPaid;
      return { ...row, status, amountPaid, balanceAmount: row.totalAmount - amountPaid };
    }),
  }, createActivity('invoice_updated', `Updated payment status of ${ids.length} invoices`));
  const handleBulkAddInvoices = (rows: Invoice[]) => updateDbState({ invoices: [...rows, ...db.invoices] },
    createActivity('bulk_generated', `Saved ${rows.length} invoices`));
  const handleAddClient = (client: Client) => updateDbState({ clients: [client, ...db.clients] },
    createActivity('client_added', `Added client ${client.name}`));
  const handleSaveCourse = (course: Course) => updateDbState({
    courses: db.courses.some(row => row.id === course.id) ? db.courses.map(row => row.id === course.id ? course : row) : [...db.courses, course],
  }, createActivity('course_added', `Saved programme ${course.name}`));

  // CORPORATE PREFERENCES HANDLER
  const handleSaveSettings = async (nextSettings: CompanySettings) => {
    await saveCompanySettings(nextSettings);
    setDb(current => ({ ...current, settings: nextSettings }));
    // Shared storage is authoritative; a full browser cache must not undo a successful save.
    try { saveStoredData({ settings: nextSettings }); }
    catch (error) { console.warn('Could not cache shared company settings locally.', error); }
  };

  const handleAddCertificateOption = async (kind: 'category' | 'partner', name: string) => {
    const settings = normalizeSettings(await addCertificateOption(kind, name));
    setDb(current => ({ ...current, settings }));
    if (kind === 'category') return settings.certificateCategories!.find(value => value.toLowerCase() === name.trim().toLowerCase())!;
    return settings.certificatePartners!.find(value => value.name.toLowerCase() === name.trim().toLowerCase())!.id;
  };

  // Auth check guard
  if (authConfigured && !authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Verifying admin access...</div>;
  }

  if (!isLoggedIn) {
    return <Login authError={authError} />;
  }

  return (
    <div id="app-shell" className="min-h-screen bg-[#FAFAFA] font-sans transition-colors duration-250 dark:bg-slate-950">

      <a href="#route-panel-container" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10001] focus:rounded-xl focus:bg-white focus:p-4 focus:text-slate-900">Skip to page content</a>
      {saving && <div role="status" aria-live="polite" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/30"><div className="rounded-xl bg-white p-5 text-slate-900 shadow-lg">Saving to the shared registry…</div></div>}
      <Navbar
        path={path}
        navigate={navigate}
        settings={db.settings}
        userEmail={authEmail}
        darkMode={theme === 'dark'}
        setDarkMode={(dark) => setTheme(dark ? 'dark' : 'light')}
        onLogout={handleLogout}
      />

      {/* Main Container Stage */}
      <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">

        {saveError && <div role="alert" className="fixed right-4 top-4 z-[10000] max-w-lg rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-lg">{saveError}</div>}
        {/* Dynamic Route View Switching */}
        <div id="route-panel-container" tabIndex={-1} className={getDocumentSection(path) ? "document-workspace mx-auto max-w-screen-2xl outline-none" : "outline-none"}>
          <DocumentNavigation path={path} navigate={navigate} editing={Boolean((path === "/invoice/new" && editingInvoice) || (path === "/certificate/new" && editingCertificate) || (path === "/letter/new" && editingLetter) || (path === "/payslip/new" && editingPayslip))} />

          {(path === '/' || path === '/lms') && (
            <AdminDashboard navigate={navigate} />
          )}

          {adminModuleByPath[path] && (
            <AdminModule module={adminModuleByPath[path]} navigate={navigate} />
          )}

          {path === '/team' && <TeamManagement />}

          {path === '/documents' && (
            <Home navigate={navigate} data={db} />
          )}

          {path === '/invoice/new' && (
            <InvoiceBuilder
              onBack={() => { navigate('/invoice/old'); setEditingInvoice(null); }}
              clients={db.clients}
              existingInvoices={db.invoices}
              settings={db.settings}
              onSaveInvoice={handleSaveInvoice}
              editingInvoice={editingInvoice}
              onAddClient={handleAddClient}
            />
          )}

          {path === '/invoice/old' && (
            <OldInvoices
              invoices={db.invoices}
              clients={db.clients}
              settings={db.settings}
              onSelectInvoice={setPreviewInvoice}
              onEditInvoice={handleEditInvoiceTrigger}
              onDeleteInvoice={handleDeleteInvoice}
              onBulkDeleteInvoices={handleBulkDeleteInvoices}
              onBulkUpdateStatus={handleBulkUpdateInvoiceStatus}
              onBulkAddInvoices={handleBulkAddInvoices}
              navigate={navigate}
            />
          )}

          {path === '/certificate/new' && (
            <CertificateBuilder
              onBack={() => { navigate('/certificate/old'); setEditingCertificate(null); }}
              courses={db.courses}
              existingCertificates={db.certificates}
              settings={db.settings}
              onAddCertificateOption={handleAddCertificateOption}
              onSaveCertificate={handleSaveCertificate}
              editingCertificate={editingCertificate}
              onSaveCourse={handleSaveCourse}
              navigate={navigate}
            />
          )}

          {path === '/certificate/old' && (
            <OldCertificates
              certificates={db.certificates}
              settings={db.settings}
              onSelectCertificate={setPreviewCertificate}
              onEditCertificate={handleEditCertificateTrigger}
              onDeleteCertificate={handleDeleteCertificate}
              navigate={navigate}
            />
          )}

          {path === '/certificate/bulk' && (
            <BulkCertificateGenerator
              courses={db.courses}
              settings={db.settings}
              existingCertificates={db.certificates}
              onAddCertificateOption={handleAddCertificateOption}
              onSaveCourse={handleSaveCourse}
              onSaveCertificates={(certs) => updateDbState({ certificates: [...certs, ...db.certificates] }, createActivity('bulk_generated', `Saved ${certs.length} certificates`))}
              navigate={navigate}
            />
          )}

          {path === '/settings' && (
            <Settings
              settings={db.settings}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {path === '/letter/new' && (
            <LetterBuilder
              onBack={() => { navigate('/letter/old'); setEditingLetter(null); }}
              settings={db.settings}
              onSaveLetter={handleSaveLetter}
              editingLetter={editingLetter}
              navigate={navigate}
            />
          )}

          {path === '/letter/old' && (
            <OldLetters
              letters={db.letters}
              settings={db.settings}
              onEditLetter={handleEditLetterTrigger}
              onDeleteLetter={handleDeleteLetter}
              navigate={navigate}
            />
          )}

          {path === '/payslip/new' && (
            <PayslipBuilder
              onBack={() => { navigate('/payslip/old'); setEditingPayslip(null); }}
              settings={db.settings}
              employees={db.employees}
              onSaveEmployees={(employees) => updateDbState({ employees })}
              onSavePayslip={handleSavePayslip}
              editingPayslip={editingPayslip}
              navigate={navigate}
            />
          )}

          {path === '/payslip/old' && (
            <OldPayslips
              payslips={db.payslips}
              settings={db.settings}
              onEditPayslip={handleEditPayslipTrigger}
              onDeletePayslip={handleDeletePayslip}
              navigate={navigate}
            />
          )}

        </div>

      </main>

      {/* OVERLAY POPUP MODAL: INVOICE DETAILED EXPORT VIEW */}
      {previewInvoice && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-start justify-center p-4 overflow-y-auto cursor-zoom-out"
          onClick={() => setPreviewInvoice(null)}
        >
          <div
            className="max-w-4xl w-full my-8 animate-zoom-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <InvoicePreview
              invoice={previewInvoice}
              settings={db.settings}
              onClose={() => setPreviewInvoice(null)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* OVERLAY POPUP MODAL: CERTIFICATE DETAILED EXPORT VIEW */}
      {previewCertificate && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewCertificate(null)}
        >
          <div
            className="w-full h-full max-w-none animate-zoom-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <CertificatePreview
              certificate={previewCertificate}
              settings={db.settings}
              onClose={() => setPreviewCertificate(null)}
              onUpdateCertificate={(updatedCert) => {
                setPreviewCertificate(updatedCert);
                const updated = db.certificates.map(c => c.id === updatedCert.id ? updatedCert : c);
                updateDbState({ certificates: updated });
              }}
            />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
