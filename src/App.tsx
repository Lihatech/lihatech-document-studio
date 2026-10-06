import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  getStoredData, 
  saveStoredData, 
  addRecentActivity 
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
  loadCompanyData,
  subscribeToCompanyAuth,
  signOutCompany
} from './lib/firebase';

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

// Layout & Previews
import Navbar from './components/layout/Navbar';
import InvoicePreview from './components/invoice/InvoicePreview';
import CertificatePreview from './components/certificate/CertificatePreview';

export default function App() {
  // Authentication Guard State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (firebaseConfigured) return false;
    return localStorage.getItem('lt_is_logged_in') === 'true';
  });
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  // Active Routing Path State (URL synchronized)
  const [path, setPath] = useState(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname;
  });

  const navigate = (toPath: string) => {
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

  // Unified Database State
  const [db, setDb] = useState(() => getStoredData());

  // Use Firebase/Google authentication when Firebase is configured. Keep the
  // local demo login available when Firebase is not configured.
  useEffect(() => {
    if (!firebaseConfigured) return;

    return subscribeToCompanyAuth(async (user) => {
      if (!user) {
        localStorage.removeItem('lt_is_logged_in');
        setIsLoggedIn(false);
        setAuthEmail(null);
        setAuthReady(true);
        return;
      }

      if (!isAllowedCompanyUser(user)) {
        await signOutCompany();
        localStorage.removeItem('lt_is_logged_in');
        setIsLoggedIn(false);
        setAuthEmail(null);
        setAuthReady(true);
        return;
      }

      setAuthEmail(user.email);

      const fallbackData = getStoredData() as Awaited<ReturnType<typeof loadCompanyData>>;
      try {
        const companyData = await loadCompanyData(fallbackData);
        setDb(companyData);
        saveStoredData(companyData);
      } catch (error) {
        // Firebase auth can succeed even when Firestore is temporarily offline.
        // Keep the user signed in and use the local copy until the backend is reachable.
        console.warn('Firestore unavailable; continuing with local data.', error);
        setDb(fallbackData);
      }

      localStorage.setItem('lt_is_logged_in', 'true');
      setIsLoggedIn(true);
      setAuthReady(true);
    });
  }, []);

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

  // Synchronize memory changes with storage.ts
  const updateDbState = (updates: Partial<typeof db>) => {
    const nextDb = { ...db, ...updates };
    setDb(nextDb);
    saveStoredData(updates);
  };

  // Login handler
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    // Reload freshly configured store
    const freshlyLoaded = getStoredData();
    setDb(freshlyLoaded);
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('lt_is_logged_in');
    setIsLoggedIn(false);
    setAuthEmail(null);
    if (firebaseConfigured) void signOutCompany();
    navigate('/');
  };

  // INVOICE HANDLERS
  const handleSaveInvoice = (invoice: Invoice) => {
    const isEdit = db.invoices.some(inv => inv.id === invoice.id);
    let updatedInvoices: Invoice[];

    if (isEdit) {
      updatedInvoices = db.invoices.map(inv => inv.id === invoice.id ? invoice : inv);
      addRecentActivity('invoice_updated', `Invoice ${invoice.invoiceNumber} updated for ${invoice.clientName}`);
    } else {
      updatedInvoices = [invoice, ...db.invoices];
      addRecentActivity('invoice_created', `Invoice ${invoice.invoiceNumber} drafted for ${invoice.clientName}`);
    }

    updateDbState({ invoices: updatedInvoices });
    setEditingInvoice(null);
    navigate('/invoice/old');
  };

  const handleDeleteInvoice = (id: string) => {
    const target = db.invoices.find(inv => inv.id === id);
    const updated = db.invoices.filter(inv => inv.id !== id);
    updateDbState({ invoices: updated });
    
    if (target) {
      addRecentActivity('invoice_updated', `Invoice ${target.invoiceNumber} permanently deleted`);
    }
  };

  const handleEditInvoiceTrigger = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    navigate('/invoice/new');
  };

  const handleBulkDeleteInvoices = (ids: string[]) => {
    const count = ids.length;
    const updated = db.invoices.filter(inv => !ids.includes(inv.id));
    updateDbState({ invoices: updated });
    addRecentActivity('invoice_updated', `Bulk deleted ${count} invoice(s)`);
  };

  const handleBulkUpdateInvoiceStatus = (ids: string[], newStatus: 'Paid' | 'Unpaid' | 'Partially Paid') => {
    const updated = db.invoices.map(inv => {
      if (ids.includes(inv.id)) {
        const amountPaid = newStatus === 'Paid' ? inv.totalAmount : newStatus === 'Unpaid' ? 0 : inv.amountPaid;
        const balanceAmount = inv.totalAmount - amountPaid;
        return {
          ...inv,
          status: newStatus,
          amountPaid,
          balanceAmount
        };
      }
      return inv;
    });
    updateDbState({ invoices: updated });
    addRecentActivity('invoice_updated', `Bulk updated status of ${ids.length} invoice(s) to ${newStatus}`);
  };

  const handleBulkAddInvoices = (newInvoices: Invoice[]) => {
    const updated = [...newInvoices, ...db.invoices];
    updateDbState({ invoices: updated });
    addRecentActivity('invoice_created', `Batch created ${newInvoices.length} new invoice(s)`);
  };

  // CERTIFICATE HANDLERS
  const handleSaveCertificate = (certificate: Certificate) => {
    const isEdit = db.certificates.some(c => c.id === certificate.id);
    let updatedCertificates: Certificate[];

    if (isEdit) {
      updatedCertificates = db.certificates.map(c => c.id === certificate.id ? certificate : c);
      addRecentActivity('certificate_updated', `Certificate ${certificate.certificateId} updated for ${certificate.candidateName}`);
    } else {
      updatedCertificates = [certificate, ...db.certificates];
      addRecentActivity('certificate_created', `Certificate ${certificate.certificateId} issued to ${certificate.candidateName}`);
    }

    updateDbState({ certificates: updatedCertificates });
    setEditingCertificate(null);
    navigate('/certificate/old');
  };

  const handleDeleteCertificate = (idOrIds: string | string[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const updated = db.certificates.filter(c => !ids.includes(c.id));
    updateDbState({ certificates: updated });
    
    if (ids.length === 1) {
      const target = db.certificates.find(c => c.id === ids[0]);
      if (target) {
        addRecentActivity('certificate_updated', `Certificate ${target.certificateId} removed from registry`);
      }
    } else {
      addRecentActivity('certificate_updated', `Removed ${ids.length} certificates from registry`);
    }
  };

  const handleEditCertificateTrigger = (cert: Certificate) => {
    setEditingCertificate(cert);
    navigate('/certificate/new');
  };

  // LETTER HANDLERS
  const handleSaveLetter = (letter: Letter) => {
    const isEdit = db.letters.some(l => l.id === letter.id);
    let updatedLetters: Letter[];

    if (isEdit) {
      updatedLetters = db.letters.map(l => l.id === letter.id ? letter : l);
      addRecentActivity('letter_updated', `HR Letter of type ${letter.letterType} updated for ${letter.candidateName}`);
    } else {
      updatedLetters = [letter, ...db.letters];
      addRecentActivity('letter_created', `HR Letter of type ${letter.letterType} drafted for ${letter.candidateName}`);
    }

    updateDbState({ letters: updatedLetters });
    setEditingLetter(null);
    navigate('/letter/old');
  };

  const handleDeleteLetter = (id: string) => {
    const target = db.letters.find(l => l.id === id);
    const updated = db.letters.filter(l => l.id !== id);
    updateDbState({ letters: updated });
    
    if (target) {
      addRecentActivity('letter_updated', `${target.letterType} for ${target.candidateName} permanently deleted`);
    }
  };

  const handleEditLetterTrigger = (letter: Letter) => {
    setEditingLetter(letter);
    navigate('/letter/new');
  };

  // PAYSLIP HANDLERS
  const handleSavePayslip = (payslip: Payslip) => {
    const isEdit = db.payslips.some(p => p.id === payslip.id);
    let updatedPayslips: Payslip[];

    if (isEdit) {
      updatedPayslips = db.payslips.map(p => p.id === payslip.id ? payslip : p);
      addRecentActivity('payslip_updated', `Payslip for ${payslip.employeeName} (${payslip.monthAndYear}) updated`);
    } else {
      updatedPayslips = [payslip, ...db.payslips];
      addRecentActivity('payslip_created', `Payslip formulated for ${payslip.employeeName} for ${payslip.monthAndYear}`);
    }

    updateDbState({ payslips: updatedPayslips });
    setEditingPayslip(null);
    navigate('/payslip/old');
  };

  const handleDeletePayslip = (id: string) => {
    const target = db.payslips.find(p => p.id === id);
    const updated = db.payslips.filter(p => p.id !== id);
    updateDbState({ payslips: updated });
    
    if (target) {
      addRecentActivity('payslip_updated', `Payslip for ${target.employeeName} (${target.monthAndYear}) deleted`);
    }
  };

  const handleEditPayslipTrigger = (payslip: Payslip) => {
    setEditingPayslip(payslip);
    navigate('/payslip/new');
  };

  // COURSE HANDLERS (PROGRAM PRESETS)
  const handleSaveCourse = (course: Course) => {
    const isEdit = db.courses.some(c => c.id === course.id);
    let updatedCourses: Course[];
    if (isEdit) {
      updatedCourses = db.courses.map(c => c.id === course.id ? course : c);
    } else {
      updatedCourses = [...db.courses, course];
    }
    updateDbState({ courses: updatedCourses });
  };

  const handleDeleteCourse = (id: string) => {
    const updated = db.courses.filter(c => c.id !== id);
    updateDbState({ courses: updated });
  };

  // CLIENT HANDLERS
  const handleAddClient = (client: Client) => {
    const updatedClients = [client, ...db.clients];
    updateDbState({ clients: updatedClients });
    addRecentActivity('client_added', `Added new client: ${client.name} (${client.companyName || 'Individual'})`);
  };

  // CORPORATE PREFERENCES HANDLER
  const handleSaveSettings = (nextSettings: CompanySettings) => {
    updateDbState({ settings: nextSettings });
  };

  // Auth check guard
  if (firebaseConfigured && !authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Connecting to LihaTech Firebase...</div>;
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app-shell" className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 font-sans transition-colors duration-250">
      
      {/* Top Professional Navigation Board */}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dynamic Route View Switching */}
        <div id="route-panel-container">
          
          {path === '/' && (
            <Home navigate={navigate} />
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
              onSaveCertificate={handleSaveCertificate}
              editingCertificate={editingCertificate}
              onSaveCourse={handleSaveCourse}
              onDeleteCourse={handleDeleteCourse}
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
              onSaveCertificates={(certs) => {
                const updatedCertificates = [...certs, ...db.certificates];
                updateDbState({ certificates: updatedCertificates });
                addRecentActivity('bulk_generated', `Bulk generated and saved ${certs.length} certificates`);
              }}
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
