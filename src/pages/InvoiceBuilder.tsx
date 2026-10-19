import { showWarning } from '../lib/dialogs';
import { loadInvoiceDraft, saveInvoiceDraft, errorMessage, getReservedInvoiceNumbers } from '../lib/documentStudio';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  FileText,
  CheckCircle2,
  Zap,
  Sparkles,
  RefreshCw,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { Invoice, InvoiceItem, Client, CompanySettings } from '../types';
import { generateInvoiceNumber } from '../utils/idGenerator';
import { amountToWords } from '../utils/amountToWords';
import InvoicePreview from '../components/invoice/InvoicePreview';

interface InvoiceBuilderProps {
  onBack: () => void;
  clients: Client[];
  existingInvoices: Invoice[];
  settings: CompanySettings;
  onSaveInvoice: (invoice: Invoice) => Promise<boolean>;
  editingInvoice?: Invoice | null;
  onAddClient?: (client: Client) => Promise<boolean>;
}

export default function InvoiceBuilder({
  onBack,
  clients,
  existingInvoices,
  settings,
  onSaveInvoice,
  editingInvoice = null,
  onAddClient
}: InvoiceBuilderProps) {

  const [step, setStep] = useState(1);
  const [hasSelectedType, setHasSelectedType] = useState<boolean>(!!editingInvoice);
  const [selectedClient, setSelectedClient] = useState<string>('');

  const SERVICE_TEMPLATES = settings.invoiceServicePresets || [];
  const [draftReady, setDraftReady] = useState(Boolean(editingInvoice));
  const [draftError, setDraftError] = useState('');
  const draftLoaded = React.useRef(false);
  const latestDraft = React.useRef<Partial<Invoice> | null>(null);
  const draftQueue = React.useRef(Promise.resolve());
  // Add Client State
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientGst, setNewClientGst] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  const handleCreateNewClient = async () => {
    if (!newClientName.trim()) {
      showWarning('Client Name is required!');
      return;
    }

    const newClientObj: Client = {
      id: crypto.randomUUID(),
      name: newClientName.trim(),
      companyName: newClientCompany.trim() || '',
      email: newClientEmail.trim(),
      phone: newClientPhone.trim(),
      address: newClientAddress.trim(),
      gstNumber: newClientGst.trim() || undefined
    };

    if (onAddClient) {
      if (!await onAddClient(newClientObj)) return;
    }

    // Auto-fill form fields
    setClientName(newClientObj.name);
    setClientCompanyName(newClientObj.companyName || '');
    setClientAddress(newClientObj.address);
    setClientEmail(newClientObj.email);
    setClientPhone(newClientObj.phone);
    setClientGst(newClientObj.gstNumber || '');
    setSelectedClient(newClientObj.id);

    setIsAddingNewClient(false);

    // Reset new client form fields
    setNewClientName('');
    setNewClientCompany('');
    setNewClientGst('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientAddress('');
  };

  // Form State
  const [invoiceType, setInvoiceType] = useState<'service' | 'course'>('service');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientGst, setClientGst] = useState('');
  const [projectName, setProjectName] = useState('');

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15); // Default 15 days terms
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<Invoice['status']>('Unpaid');
  const [paymentTerms, setPaymentTerms] = useState('15 Days');
  const [currency, setCurrency] = useState<Invoice['currency']>('INR');
  const [gstPercent, setGstPercent] = useState<number>(settings.defaultGstPercent);
  const [discount, setDiscount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI / Bank Transfer');
  const [notes, setNotes] = useState('Thank you for choosing LihaTech Solutions!');

  // Service Rows State
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'item_1',
      serviceName: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0
    }
  ]);

  // Load editing values or generate defaults
  useEffect(() => {
    if (editingInvoice) {
      setInvoiceType(editingInvoice.invoiceType || 'service');
      setHasSelectedType(true);
      setInvoiceNumber(editingInvoice.invoiceNumber);
      setClientName(editingInvoice.clientName);
      setClientCompanyName(editingInvoice.clientCompanyName || '');
      setClientAddress(editingInvoice.clientAddress);
      setClientEmail(editingInvoice.clientEmail);
      setClientPhone(editingInvoice.clientPhone);
      setClientGst(editingInvoice.clientGst || '');
      setProjectName(editingInvoice.projectName);
      setInvoiceDate(editingInvoice.invoiceDate);
      setDueDate(editingInvoice.dueDate);
      setStatus(editingInvoice.status);
      setPaymentTerms(editingInvoice.paymentTerms);
      setCurrency(editingInvoice.currency);
      setGstPercent(editingInvoice.gstPercent);
      setDiscount(editingInvoice.discount);
      setAmountPaid(editingInvoice.amountPaid);
      setPaymentMethod(editingInvoice.paymentMethod);
      setNotes(editingInvoice.notes);
      setItems(editingInvoice.items);
    } else {
      // Auto-generate invoice number
      const existingNumbers = existingInvoices.map(i => i.invoiceNumber);
      setInvoiceNumber(generateInvoiceNumber([...existingNumbers, ...getReservedInvoiceNumbers()]));
    }
  }, [editingInvoice, existingInvoices]);

  // Drafts belong to the signed-in user and are shared across their devices.
  useEffect(() => {
    if (editingInvoice) { setDraftReady(true); return; }
    let active = true;
    loadInvoiceDraft().then(parsed => {
      if (!active) return;
      draftLoaded.current = true;
      if (!parsed) return;
      setInvoiceType(parsed.invoiceType || 'service');
      setClientName(parsed.clientName || ''); setClientCompanyName(parsed.clientCompanyName || '');
      setClientAddress(parsed.clientAddress || ''); setClientEmail(parsed.clientEmail || '');
      setClientPhone(parsed.clientPhone || ''); setClientGst(parsed.clientGst || '');
      setProjectName(parsed.projectName || '');
      if (parsed.items) setItems(parsed.items);
      if (parsed.invoiceDate) setInvoiceDate(parsed.invoiceDate);
      if (parsed.dueDate) setDueDate(parsed.dueDate);
      if (parsed.currency) setCurrency(parsed.currency);
      if (parsed.gstPercent !== undefined) setGstPercent(parsed.gstPercent);
      if (parsed.discount !== undefined) setDiscount(parsed.discount);
      if (parsed.amountPaid !== undefined) setAmountPaid(parsed.amountPaid);
      if (parsed.paymentTerms !== undefined) setPaymentTerms(parsed.paymentTerms);
      if (parsed.paymentMethod !== undefined) setPaymentMethod(parsed.paymentMethod);
      if (parsed.notes !== undefined) setNotes(parsed.notes);
      if (parsed.status) setStatus(parsed.status);
    }).catch(error => { if (active) setDraftError(errorMessage(error)); })
      .finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [editingInvoice]);

  useEffect(() => {
    if (editingInvoice || !draftReady || !draftLoaded.current) return;
    const draft = { clientName, clientCompanyName, clientAddress, clientEmail, clientPhone, clientGst,
        projectName, items, invoiceType, invoiceDate, dueDate, currency, gstPercent, discount, amountPaid,
        paymentTerms, paymentMethod, notes, status };
    latestDraft.current = draft;
    const timer = setTimeout(() => {
      draftQueue.current = draftQueue.current.catch(() => {}).then(() => saveInvoiceDraft(draft))
        .then(() => setDraftError('')).catch(error => setDraftError(errorMessage(error)));
    }, 800);
    return () => clearTimeout(timer);
  }, [editingInvoice, draftReady, clientName, clientCompanyName, clientAddress, clientEmail, clientPhone,
    clientGst, projectName, items, invoiceType, invoiceDate, dueDate, currency, gstPercent, discount,
    amountPaid, paymentTerms, paymentMethod, notes, status]);

  // Flush the last edit when navigating before the debounce expires.
  useEffect(() => () => {
    if (editingInvoice || !draftLoaded.current || !latestDraft.current) return;
    const draft = latestDraft.current;
    draftQueue.current = draftQueue.current.catch(() => {}).then(() => saveInvoiceDraft(draft))
      .catch(error => console.warn('Could not save the invoice draft on navigation.', error));
  }, [editingInvoice]);

  const handleInvoiceTypeChange = (type: 'service' | 'course') => {
    setInvoiceType(type);
    let updated = items;
    if (type === 'course') {
      updated = items.map(item => ({
        ...item,
        qty: 1,
        amount: item.rate
      }));
      setItems(updated);
    }

  };

  const selectModuleType = (type: 'service' | 'course') => {
    handleInvoiceTypeChange(type);
    setHasSelectedType(true);
    setStep(1);
  };

  const handleBackClick = () => {
    if (editingInvoice) {
      onBack();
    } else if (hasSelectedType) {
      setHasSelectedType(false);
      setStep(1);
    } else {
      onBack();
    }
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setClientName(client.name);
      setClientCompanyName(client.companyName || '');
      setClientAddress(client.address);
      setClientEmail(client.email);
      setClientPhone(client.phone);
      setClientGst(client.gstNumber || '');

    }
  };

  // Service item updates
  const updateItemField = (id: string, field: keyof InvoiceItem, value: any) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        if (invoiceType === 'course') {
          newItem.qty = 1;
          if (field === 'rate') {
            newItem.amount = Number(value);
          }
        } else {
          if (field === 'qty' || field === 'rate') {
            const q = field === 'qty' ? Number(value) : item.qty;
            const r = field === 'rate' ? Number(value) : item.rate;
            newItem.amount = q * r;
          }
        }
        return newItem;
      }
      return item;
    });
    setItems(updated);

  };

  const addServiceRow = () => {
    const newId = 'item_' + Date.now();
    setItems([
      ...items,
      {
        id: newId,
        serviceName: '',
        description: '',
        qty: 1,
        rate: 0,
        amount: 0
      }
    ]);
  };

  const deleteServiceRow = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const applyTemplate = (itemId: string, template: typeof SERVICE_TEMPLATES[0]) => {
    const updated = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          serviceName: template.name,
          description: template.desc
        };
      }
      return item;
    });
    setItems(updated);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxableAmount = Math.max(0, subtotal - discount);
  const gstAmount = parseFloat(((taxableAmount * gstPercent) / 100).toFixed(2));
  const totalAmount = taxableAmount + gstAmount;
  const balanceAmount = Math.max(0, totalAmount - amountPaid);
  const amountWords = amountToWords(totalAmount, currency);

  // Auto-fill terms when changing date
  const handleTermsChange = (term: string) => {
    setPaymentTerms(term);
    const date = new Date(invoiceDate);
    if (term === 'Due on Receipt') {
      setDueDate(invoiceDate);
    } else if (term === '7 Days') {
      date.setDate(date.getDate() + 7);
      setDueDate(date.toISOString().split('T')[0]);
    } else if (term === '15 Days') {
      date.setDate(date.getDate() + 15);
      setDueDate(date.toISOString().split('T')[0]);
    } else if (term === '30 Days') {
      date.setDate(date.getDate() + 30);
      setDueDate(date.toISOString().split('T')[0]);
    }
  };

  // Save Invoice action
  const handleSaveInvoice = async () => {
    // Basic validation
    if (!clientName.trim()) {
      showWarning('Client Name is required!');
      setStep(1);
      return;
    }
    if (items.some(it => !it.serviceName.trim())) {
      showWarning('All items must have a Service Name.');
      setStep(3);
      return;
    }
    if (items.some(it => it.qty <= 0 || it.rate < 0)) {
      showWarning('Quantity must be greater than zero and Rate cannot be negative.');
      setStep(3);
      return;
    }

    const savedInvoice: Invoice = {
      id: editingInvoice ? editingInvoice.id : crypto.randomUUID(),
      invoiceNumber,
      clientName,
      clientCompanyName,
      clientAddress,
      clientEmail,
      clientPhone,
      clientGst,
      projectName,
      invoiceDate,
      dueDate,
      status,
      paymentTerms,
      currency,
      gstPercent,
      items,
      subtotal,
      discount,
      taxableAmount,
      gstAmount,
      totalAmount,
      amountPaid,
      balanceAmount,
      amountInWords: amountWords,
      notes,
      paymentMethod,
      invoiceType,
      createdAt: editingInvoice ? editingInvoice.createdAt : new Date().toISOString()
    };

    if (!await onSaveInvoice(savedInvoice)) return;
    // Clear draft if new
    if (!editingInvoice) {
      try { await draftQueue.current; await saveInvoiceDraft(null); }
      catch (error) { showWarning(`Invoice saved, but the draft could not be cleared: ${errorMessage(error)}`); }
    }
  };

  if (!draftReady) return <p role="status">Loading your invoice draft…</p>;

  if (!hasSelectedType) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-10 animate-fade-in">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            aria-label="Back to invoices"
            className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl cursor-pointer transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-xxs font-bold text-amber-600 uppercase tracking-widest block">Invoices</span>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Choose invoice type</h1>
          </div>
        </div>

        {draftError && <p role="alert" className="text-sm text-red-600">Draft storage: {draftError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1: Product / Service */}
          <button
            onClick={() => selectModuleType('service')}
            className="group p-8 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg transition-all text-left flex flex-col justify-between cursor-pointer space-y-6"
          >
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                  Product / Service Invoice
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Best for consulting, contract work, software/hardware deliverables, and general product development.
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-gray-100 dark:border-slate-800 pt-4 w-full">
              <div className="flex items-center text-xxs font-bold text-gray-400 uppercase tracking-wider">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span> Includes Company Name & GSTIN
              </div>
              <div className="flex items-center text-xxs font-bold text-gray-400 uppercase tracking-wider">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span> Tracks Working Hours / Qty & Rates
              </div>
            </div>
          </button>

          {/* Option 2: Course Delivery */}
          <button
            onClick={() => selectModuleType('course')}
            className="group p-8 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg transition-all text-left flex flex-col justify-between cursor-pointer space-y-6"
          >
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                  Course Delivery Invoice
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Best for training, certification course fees, and training deliveries for students/candidates.
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-gray-100 dark:border-slate-800 pt-4 w-full">
              <div className="flex items-center text-xxs font-bold text-gray-400 uppercase tracking-wider">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span> Streamlined for Individual Students
              </div>
              <div className="flex items-center text-xxs font-bold text-gray-400 uppercase tracking-wider">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span> Fixed Fee/Course price (No Qty/Hours)
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fade-in">

      {draftError && <p role="alert" className="text-sm text-red-600">Draft could not be saved: {draftError}</p>}
      {/* Header controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-850">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBackClick}
            aria-label={editingInvoice ? "Back to invoices" : "Change invoice type"}
            title={editingInvoice ? "Back to invoices" : "Change invoice type"}
            className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl cursor-pointer transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-xxs font-bold text-amber-600 uppercase tracking-widest block">Invoices</span>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {editingInvoice ? 'Edit invoice' : 'Create invoice'}
            </h1>
          </div>
        </div>

        {/* Step Indicator Bullets */}
        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => {

                setStep(s);
              }}
              className={`h-7 px-3 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                step === s
                  ? 'bg-amber-500 text-white shadow-md'
                  : step > s
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Multi-Step Form Wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT 2 COLS: The Form Fields */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">

          {/* STEP 1: CLIENT DETAILS */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-850 pb-4">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">Step 1: Client Selection & Details</h3>
                <p className="text-xs text-gray-400">Fill in client information.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={invoiceType === 'course' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {invoiceType === 'course' ? 'Student / Candidate Name *' : 'Client Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => { setClientName(e.target.value);  }}
                    placeholder={invoiceType === 'course' ? "Enter student or candidate full name" : "Enter candidate or client main contact"}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                {invoiceType !== 'course' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Company Name</label>
                    <input
                      type="text"
                      value={clientCompanyName}
                      onChange={(e) => { setClientCompanyName(e.target.value);  }}
                      placeholder="e.g. Shravani IT Solutions"
                      className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {invoiceType === 'course' ? 'Student Email' : 'Client Email'}
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => { setClientEmail(e.target.value);  }}
                    placeholder={invoiceType === 'course' ? "student@example.com" : "client@shravanisolutions.com"}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {invoiceType === 'course' ? 'Student Phone' : 'Client Phone'}
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => { setClientPhone(e.target.value);  }}
                    placeholder="+91 94220 XXXXX"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {invoiceType === 'course' ? 'Student Address' : 'Client Billing Address'}
                </label>
                <textarea
                  rows={3}
                  value={clientAddress}
                  onChange={(e) => { setClientAddress(e.target.value);  }}
                  placeholder={invoiceType === 'course' ? "Enter full physical address" : "Enter full physical address for tax calculation"}
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {invoiceType !== 'course' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Client GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={clientGst}
                      onChange={(e) => { setClientGst(e.target.value);  }}
                      placeholder="e.g. 27AABCS5564K2Z9"
                      className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                ) : null}
                <div className={invoiceType === 'course' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {invoiceType === 'course' ? 'Course / Program Name' : 'Project / Reference Name'}
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => { setProjectName(e.target.value);  }}
                    placeholder={invoiceType === 'course' ? "e.g. Full-Stack Web Development Mastery Program" : "e.g. E-Commerce Website & Chatbot"}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INVOICE METADATA */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-850 pb-4">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">Step 2: Invoice Properties</h3>
                <p className="text-xs text-gray-400">Manage payment terms, release date, due intervals, and billing currency.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Invoice Number</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="LT-INV-YYYY-001"
                      className="block flex-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-1 text-gray-900 dark:text-white font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceNumber(generateInvoiceNumber(existingInvoices.map(i => i.invoiceNumber)))}
                      className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Regenerate Sequence"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Currency Type</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Invoice['currency'])}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white"
                  >
                    <option value="INR">INR (₹) Indian Rupee</option>
                    <option value="USD">USD ($) US Dollar</option>
                    <option value="EUR">EUR (€) Euro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Invoice Release Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => handleTermsChange(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white"
                  >
                    <option value="Paid">Paid in Full / Advance</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="7 Days">Net 7 Days</option>
                    <option value="15 Days">Net 15 Days</option>
                    <option value="30 Days">Net 30 Days</option>
                    <option value="Custom">Custom Date Setup</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Final Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SERVICES AND PRICING (DYNAMIC ROWS) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-850 pb-4">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">Step 3: Service Roster</h3>
                <p className="text-xs text-gray-400">Describe delivered services, consulting hours, software builds, or internship batches.</p>
              </div>

              {/* Dynamic Rows Container */}
              <div className="space-y-6">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl border border-gray-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/30 space-y-4"
                  >
                    {/* Row Header with index and delete */}
                    <div className="flex items-center justify-between">
                      <span className="text-xxs font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-500/10">
                        SERVICE ITEM #{idx + 1}
                      </span>

                      {/* Service Autofill dropdown */}
                      <div className="flex items-center space-x-2">
                        <select
                          onChange={(e) => {
                            const template = SERVICE_TEMPLATES.find(t => t.name === e.target.value);
                            if (template) applyTemplate(item.id, template);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xxs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          <option value="">⚡ Quick Load Template...</option>
                          {SERVICE_TEMPLATES.filter(tmpl => {
                            const isCourseTmpl = tmpl.name === 'Certification Course Delivery' || tmpl.name === 'Internship Training Program';
                            return invoiceType === 'course' ? isCourseTmpl : !isCourseTmpl;
                          }).map((tmpl, i) => (
                            <option key={i} value={tmpl.name}>{tmpl.name}</option>
                          ))}
                        </select>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteServiceRow(item.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Service / Program Name *</label>
                        <input
                          type="text"
                          required
                          value={item.serviceName}
                          onChange={(e) => { updateItemField(item.id, 'serviceName', e.target.value);  }}
                          placeholder="e.g. Website Engineering Project"
                          className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Line Cost ({currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'})</label>
                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-xs h-[38px] flex items-center justify-end">
                          {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          {invoiceType === 'course' ? 'Course / Program Details' : 'Detailed Features Description'}
                        </label>
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) => { updateItemField(item.id, 'description', e.target.value);  }}
                          placeholder={invoiceType === 'course' ? "e.g. Structured course delivery with practical labs, assignments, assessments..." : "e.g. Completed wireframing, content integration, domain pointing, SSL configuration..."}
                          className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white resize-none"
                        />
                      </div>
                      {invoiceType === 'course' ? (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Course Fee / Price</label>
                          <input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={(e) => { updateItemField(item.id, 'rate', parseFloat(e.target.value) || 0);  }}
                            className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs outline-none text-right text-gray-900 dark:text-white font-semibold font-mono"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Working Hours (Qty)</label>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => { updateItemField(item.id, 'qty', parseInt(e.target.value, 10) || 1);  }}
                              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs outline-none text-center text-gray-900 dark:text-white font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Rate</label>
                            <input
                              type="number"
                              min="0"
                              value={item.rate}
                              onChange={(e) => { updateItemField(item.id, 'rate', parseFloat(e.target.value) || 0);  }}
                              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs outline-none text-right text-gray-900 dark:text-white font-semibold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>

              {/* Add item row */}
              <button
                type="button"
                onClick={addServiceRow}
                className="w-full py-3.5 border border-dashed border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/5 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Append Another Service Line</span>
              </button>
            </div>
          )}

          {/* STEP 4: TAXES, PAYMENTS & REMARKS */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-850 pb-4">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">Step 4: Taxes, Discounts & Notes</h3>
                <p className="text-xs text-gray-400">Configure Indian GST percents, cash discounts, payments made, and terms of delivery.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">GST Slabs</label>
                  <select
                    value={gstPercent}
                    onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white font-bold"
                  >
                    <option value="0">0% GST (Exempt/Export)</option>
                    <option value="5">5% GST (Training/Academics)</option>
                    <option value="12">12% GST (Consultancy)</option>
                    <option value="18">18% GST (Standard Services)</option>
                    <option value="28">28% GST (Luxury Slabs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cash Discount</label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter absolute reduction amount"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Payment Channel</label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="e.g. UPI / GPay / NetBanking"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Invoice Notes & Client Wishes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thank you for your business!"
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 5: PREVIEW AND SAVE */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-850 pb-4">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">Step 5: Inspect & Audit Document</h3>
                <p className="text-xs text-gray-400">Perform final visual check on layout spacing, GST additions, and recipient profiles before saving.</p>
              </div>

              {/* Render Preview */}
              <div className="border border-gray-150 dark:border-slate-800 rounded-3xl p-2 bg-white dark:bg-slate-900">
                <InvoicePreview
                  invoice={{
                    id: 'preview',
                    invoiceNumber,
                    clientName,
                    clientCompanyName,
                    clientAddress,
                    clientEmail,
                    clientPhone,
                    clientGst,
                    projectName,
                    invoiceDate,
                    dueDate,
                    status,
                    paymentTerms,
                    currency,
                    gstPercent,
                    items,
                    subtotal,
                    discount,
                    taxableAmount,
                    gstAmount,
                    totalAmount,
                    amountPaid,
                    balanceAmount,
                    amountInWords: amountWords,
                    notes,
                    paymentMethod,
                    createdAt: new Date().toISOString()
                  }}
                  settings={settings}
                  showActions={false}
                />
              </div>
            </div>
          )}

          {/* Bottom Step Control Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-850 flex justify-between">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => {  setStep(step - 1); }}
              className="px-4 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
            >
              Previous Step
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={() => {  setStep(step + 1); }}
                className="flex items-center space-x-1 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
              >
                <span>Proceed</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveInvoice}
                className="studio-button studio-button-primary text-sm"
              >
                <Save className="h-4 w-4" />
                <span>Save invoice</span>
              </button>
            )}
          </div>

        </div>

        {/* RIGHT 1 COL: Summary sidebar with real-time computations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-sm mb-4 border-b border-gray-50 dark:border-slate-850 pb-3">
              Invoice Ledger
            </h3>

            <div className="space-y-4 text-xs font-medium">
              <div className="flex justify-between text-gray-500">
                <span>Invoice Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Release Date</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{invoiceDate}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Interval Duration</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{paymentTerms}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Final Due Date</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{dueDate}</span>
              </div>

              <div className="border-t border-dashed border-gray-200 dark:border-slate-800 pt-4 space-y-2.5">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal Value</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Campaign Discount</span>
                    <span className="font-mono">
                      -{currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-gray-500">
                  <span>Taxable Basis</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>GST ({gstPercent}%)</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Total Payable</span>
                  <span className="font-mono text-emerald-800 dark:text-emerald-400">
                    {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Receipts / Paid</span>
                  <span className="font-mono font-bold">
                    {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-amber-600 dark:text-amber-400 pt-1.5 border-t border-dashed border-gray-100 dark:border-slate-850 font-bold">
                  <span>Due Balance</span>
                  <span className="font-mono font-black">
                    {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'} {balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-850 pt-4 text-xxs text-slate-400">
                <span className="block font-bold mb-1 uppercase tracking-wider text-gray-400">TRANSLATED TERMS</span>
                <p className="leading-relaxed whitespace-normal italic font-medium">{amountWords}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-xxs text-gray-500 space-y-2">
            <div className="flex items-center space-x-1 text-amber-600 font-bold">
              <Zap className="h-3.5 w-3.5" />
              <span>DRAFT AUTOMATICALLY PRESERVED</span>
            </div>
            <p className="leading-relaxed font-medium">
              We capture fields on-the-fly and save local drafts. If you accidentally reload the browser, your entries will be recovered.
            </p>
          </div>
        </div>

      </div>

      {/* Add Client Dialog Overlay */}
      {isAddingNewClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6">
            <div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">Save New Client to Roster</h4>
              <p className="text-xs text-gray-400 mt-1">This will store the client's information so you can easily load them on future invoices.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xxs font-bold text-gray-400 uppercase tracking-wider mb-1">Contact / Client Name *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Shahid Himmat Shaikh"
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 uppercase tracking-wider mb-1">Company Name</label>
                  <input
                    type="text"
                    value={newClientCompany}
                    onChange={(e) => setNewClientCompany(e.target.value)}
                    placeholder="e.g. LihaTech Solutions"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 uppercase tracking-wider mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newClientGst}
                    onChange={(e) => setNewClientGst(e.target.value)}
                    placeholder="e.g. 27AAACL8890C1Z4"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="e.g. client@lihatech.com"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="e.g. +91 88888 77777"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xxs font-bold text-gray-400 uppercase tracking-wider mb-1">Billing Address</label>
                <textarea
                  rows={2}
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="Address, Building, Area, City"
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingNewClient(false);
                  setNewClientName('');
                  setNewClientCompany('');
                  setNewClientGst('');
                  setNewClientEmail('');
                  setNewClientPhone('');
                  setNewClientAddress('');
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewClient}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
              >
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
