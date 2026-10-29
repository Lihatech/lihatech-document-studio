import React, { useState, useEffect, lazy } from 'react';
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
  supabaseConfigured,
  loadCompanySettings,
  saveCompanySettings,
} from './lib/supabase';
import { loadStudioData, saveStudioChanges, addCertificateOption, errorMessage, type StudioData, rememberStudioRecord, type StudioRecord } from './lib/documentStudio';
import { isLmsAccessDenied, rpc, type LmsSession } from './lib/lms';
import type { DocumentRequest } from './lib/documentRequests';

// Pages
import Login from './pages/Login';
import ConnectionNotice from './components/ConnectionNotice';
import Home from './pages/Home';
const InvoiceBuilder = lazy(() => import('./pages/InvoiceBuilder'));
const CertificateBuilder = lazy(() => import('./pages/CertificateBuilder'));
const OldInvoices = lazy(() => import('./pages/OldInvoices'));
const OldCertificates = lazy(() => import('./pages/OldCertificates'));
const BulkCertificateGenerator = lazy(() => import('./pages/BulkCertificateGenerator'));
const LetterBuilder = lazy(() => import('./pages/LetterBuilder'));
const OldLetters = lazy(() => import('./pages/OldLetters'));
const PayslipBuilder = lazy(() => import('./pages/PayslipBuilder'));
const OldPayslips = lazy(() => import('./pages/OldPayslips'));
const Settings = lazy(() => import('./pages/Settings'));
const LmsAdmin = lazy(() => import('./pages/admin/LmsAdmin'));
import { NotificationProvider } from './components/lms/StudentNotifications';
const StudentPortal = lazy(() => import('./pages/student/StudentPortal'));
const DocumentRequestsAdmin = lazy(() => import('./pages/admin/DocumentRequestsAdmin'));

const adminModuleByPath: Record<string, string> = {
  '/students': 'students',
  '/batches': 'batches',
  '/materials': 'materials',
  '/mock-interviews': 'mocks',
};

// Layout & Previews
import Navbar from './components/layout/Navbar';
import DocumentNavigation, { getDocumentSection } from './components/layout/DocumentNavigation';
const InvoicePreview = lazy(() => import('./components/invoice/InvoicePreview'));
const CertificatePreview = lazy(() => import('./components/certificate/CertificatePreview'));

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
  const [session, setSession] = useState<LmsSession | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const verifiedUser = React.useRef<{ uid: string; role: LmsSession['role'] } | null>(null);
  const retryAccess = () => {
    setOnline(navigator.onLine);
    if (navigator.onLine) setAccessAttempt(attempt => attempt + 1);
  };
  useEffect(() => {
    const disconnected = () => { setOnline(false); setConnectionIssue(true); };
    window.addEventListener('offline', disconnected);
    window.addEventListener('online', retryAccess);
    return () => {
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('online', retryAccess);
    };
  }, []);

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

    let generation = 0;
    const unsubscribe = subscribeToCompanyAuth(async (user) => {
      const current = ++generation;
      if (!user) {
        verifiedUser.current = null;
        setConnectionIssue(false);
        localStorage.removeItem('lt_is_logged_in');
        setIsLoggedIn(false);
        setSession(null);
        setAuthEmail(null);
        setAuthReady(true);
        return;
      }

      if (verifiedUser.current?.uid !== user.uid) {
        setIsLoggedIn(false);
        setSession(null);
        setAuthEmail(null);
      }
      if (!navigator.onLine) {
        setConnectionIssue(true);
        setAuthReady(true);
        return;
      }

      try {
        setAuthReady(false);
        const account = await rpc<LmsSession>('lms_session');
        let sharedData: StudioData | undefined;
        if (account.role === 'admin') {
          if (!isAllowedCompanyUser(user)) throw new Error(COMPANY_ACCESS_WARNING);
          if (verifiedUser.current?.uid !== user.uid || verifiedUser.current.role !== 'admin') {
            const sharedSettings = await loadCompanySettings();
            sharedData = await loadStudioData(getDefaultStudioData());
            sharedData.settings = normalizeSettings(sharedSettings || {});
          }
        }
        if (current !== generation) return;
        if (sharedData) setDb(sharedData);
        verifiedUser.current = { uid: user.uid, role: account.role };
        setConnectionIssue(false);
        setSession(account);
        const currentPath = window.location.pathname;
        const destination = account.role === 'student' ? (currentPath.startsWith('/student/') || currentPath === '/student' ? currentPath : '/student') : (currentPath.startsWith('/student') ? '/' : currentPath);
        if (destination !== currentPath) { window.history.replaceState(null, '', destination); setPath(destination); }
        setAuthEmail(user.email ?? null);
        setAuthError('');
        localStorage.setItem('lt_is_logged_in', 'true');
        setIsLoggedIn(true);
      } catch (error) {
        if (current !== generation) return;
        console.error('Could not verify LMS access.', error);
          const supabaseMessage =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
                ? String(error.message)
                : 'Could not verify access. Check your connection and retry.';
        if (!isLmsAccessDenied(error) && supabaseMessage !== COMPANY_ACCESS_WARNING) {
          // A failed connection is not a failed login. Keep verified state and open work intact.
          setConnectionIssue(true);
          return;
        }
        setConnectionIssue(false);
        setAuthError(supabaseMessage);
        verifiedUser.current = null;
        localStorage.removeItem('lt_is_logged_in');
        setIsLoggedIn(false);
        setSession(null);
        setAuthEmail(null);
        await signOutCompany();
      }
      finally {
        if (current === generation) setAuthReady(true);
      }
    });
    return () => { generation++; unsubscribe(); };
  }, [authConfigured, accessAttempt]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    const verify = async () => {
      if (!navigator.onLine) return;
      try { const next = await rpc<LmsSession>('lms_session'); if (active) { setSession(next); setAuthError(''); setConnectionIssue(false); } }
      catch (error) {
        if (!active) return;
        if (isLmsAccessDenied(error)) {
          setAuthError('Your access changed. Sign in again or contact admin.');
          void signOutCompany();
        } else { setConnectionIssue(true); console.warn('Could not refresh LMS access; keeping the current session.', error); }
      }
    };
    const timer = window.setInterval(verify, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isLoggedIn]);

  const [requestCache,setRequestCache]=useState<DocumentRequest[]|null>(null);
  useEffect(()=>{setRequestCache(null);},[authEmail]);
  const acceptIssuedRecord=(record:StudioRecord)=>{
    rememberStudioRecord(record);
    const collection=record.kind==='certificate'?'certificates':'letters';
    setDb(current=>({...current,[collection]:[record.data,...current[collection].filter(row=>row.id!==record.record_id)]}));
  };

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
    navigate('requestId' in document && document.requestId ? '/document-requests' : route); return true;
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
  const handleSavePayslips = (rows: Payslip[]) => {
    if (!rows.length) return Promise.resolve(false);
    const existing = new Set(db.payslips.map(row => `${row.employeeId.trim().toLowerCase()}:${row.monthAndYear.trim().toLowerCase()}`));
    const duplicate = rows.find(row => existing.has(`${row.employeeId.trim().toLowerCase()}:${row.monthAndYear.trim().toLowerCase()}`));
    if (duplicate) {
      setSaveError(`A payslip already exists for ${duplicate.employeeName} in ${duplicate.monthAndYear}.`);
      return Promise.resolve(false);
    }
    return updateDbState({ payslips: [...rows, ...db.payslips] },
      createActivity('bulk_generated', `Saved ${rows.length} monthly payslips for ${rows[0].employeeName}`));
  };
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
  const connectionNotice = (!online || connectionIssue)
    ? <ConnectionNotice offline={!online} checking={!authReady} onRetry={retryAccess} /> : null;
  if (authConfigured && !authReady && !isLoggedIn) {
    if (connectionNotice) return connectionNotice;
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Verifying your access...</div>;
  }

  if (!isLoggedIn) {
    if (connectionNotice) return connectionNotice;
    return <Login authError={authError} />;
  }

  if (session?.role === 'student') {
    return <NotificationProvider key={session.id} role="student">{connectionNotice}<StudentPortal path={path} navigate={navigate} onLogout={handleLogout} /></NotificationProvider>;
  }
  if (session?.role !== 'admin') return <Login authError="Contact admin for access." />;

  return (
    <NotificationProvider key={session.id} role="admin"><div id="app-shell" className="min-h-screen bg-[#FAFAFA] font-sans transition-colors duration-250 dark:bg-slate-950">
      {connectionNotice}

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

          {(path === '/' || path === '/lms' || path === '/admin' || path === '/courses' || path === '/reports') && (
            <LmsAdmin navigate={navigate} certificateCategories={db.settings.certificateCategories} />
          )}

          {adminModuleByPath[path] && (
            <LmsAdmin module={adminModuleByPath[path]} navigate={navigate} certificateCategories={db.settings.certificateCategories} />
          )}

          {path === '/team' && <LmsAdmin module="team" navigate={navigate} certificateCategories={db.settings.certificateCategories} />}
          {(path === '/document-requests' || path === '/certificate-requests') && <DocumentRequestsAdmin settings={db.settings} cachedRequests={requestCache} onRequestsChange={setRequestCache} onIssued={acceptIssuedRecord} renderReview={(request,saved,approve)=>request.kind==='certificate'?
            <CertificateBuilder key={request.id} reviewMode requestDraft={request} editingCertificate={saved as Certificate|null} courses={db.courses} existingCertificates={db.certificates} settings={db.settings} onAddCertificateOption={handleAddCertificateOption} onSaveCertificate={approve} onSaveCourse={handleSaveCourse} onBack={()=>{}} navigate={()=>{}}/>:
            <LetterBuilder key={request.id} reviewMode requestDraft={request} editingLetter={saved as Letter|null} settings={db.settings} onSaveLetter={approve} onBack={()=>{}} navigate={()=>{}}/>
          }/>}
          {(path === '/lectures' || path === '/student' || path.startsWith('/student/')) && <LmsAdmin module={path==='/lectures'?'materials':'batches'} navigate={navigate} />}

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
              existingPayslips={db.payslips}
              onSaveEmployees={(employees) => updateDbState({ employees })}
              onSavePayslip={handleSavePayslip}
              onSavePayslips={handleSavePayslips}
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

    </div></NotificationProvider>
  );
}
