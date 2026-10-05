import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  Copy,
  DollarSign
} from 'lucide-react';
import { Invoice, InvoiceItem, Client } from '../../types';
import { generateInvoiceNumber } from '../../utils/idGenerator';
import { amountToWords } from '../../utils/amountToWords';

interface BulkInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingInvoices: Invoice[];
  clients: Client[];
  onBulkAddInvoices: (invoices: Invoice[]) => void;
}

interface QuickRow {
  id: string;
  clientName: string;
  clientCompanyName: string;
  clientEmail: string;
  projectName: string;
  amount: number;
  currency: 'INR' | 'USD' | 'EUR';
  invoiceDate: string;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Partially Paid';
}

export default function BulkInvoiceModal({
  isOpen,
  onClose,
  existingInvoices,
  clients,
  onBulkAddInvoices
}: BulkInvoiceModalProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'csv'>('form');

  // Today & 15 days later dates
  const todayStr = new Date().toISOString().split('T')[0];
  const dueStr = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

  // Quick Rows State
  const [rows, setRows] = useState<QuickRow[]>([
    {
      id: 'row_1',
      clientName: '',
      clientCompanyName: '',
      clientEmail: '',
      projectName: 'Professional Software & Tech Services',
      amount: 25000,
      currency: 'INR',
      invoiceDate: todayStr,
      dueDate: dueStr,
      status: 'Unpaid'
    },
    {
      id: 'row_2',
      clientName: '',
      clientCompanyName: '',
      clientEmail: '',
      projectName: 'Consulting & Implementation Services',
      amount: 45000,
      currency: 'INR',
      invoiceDate: todayStr,
      dueDate: dueStr,
      status: 'Unpaid'
    }
  ]);

  // CSV State
  const [csvText, setCsvText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Invoice[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Add row
  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        clientName: '',
        clientCompanyName: '',
        clientEmail: '',
        projectName: 'Professional Services',
        amount: 15000,
        currency: 'INR',
        invoiceDate: todayStr,
        dueDate: dueStr,
        status: 'Unpaid'
      }
    ]);
  };

  // Duplicate row
  const handleDuplicateRow = (row: QuickRow) => {
    setRows(prev => [
      ...prev,
      {
        ...row,
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        clientName: row.clientName ? `${row.clientName} (Copy)` : ''
      }
    ]);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    if (rows.length === 1) {
      alert('You must keep at least one row in the bulk creation list.');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Update row
  const handleUpdateRow = (id: string, field: keyof QuickRow, val: any) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: val };
        // Auto-fill company/email if client picked from list
        if (field === 'clientName') {
          const matchedClient = clients.find(c => c.name.toLowerCase() === String(val).toLowerCase());
          if (matchedClient) {
            updated.clientCompanyName = matchedClient.companyName || matchedClient.name;
            updated.clientEmail = matchedClient.email || '';
          }
        }
        return updated;
      }
      return r;
    }));
  };

  // Helper to construct full Invoice object
  const buildInvoiceFromRow = (row: QuickRow, invNumber: string, bulkGroupId?: string): Invoice => {
    const finalAmount = Number(row.amount) || 0;
    const items: InvoiceItem[] = [
      {
        id: 'item_1',
        serviceName: row.projectName || 'Professional Services',
        description: row.projectName || 'Services Rendered',
        qty: 1,
        rate: finalAmount,
        amount: finalAmount
      }
    ];

    const amountPaid = row.status === 'Paid' ? finalAmount : 0;

    return {
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      invoiceNumber: invNumber,
      clientName: row.clientName || 'Valued Client',
      clientCompanyName: row.clientCompanyName || row.clientName || 'Valued Client Ltd.',
      clientAddress: 'Client Headquarters',
      clientEmail: row.clientEmail || '',
      clientPhone: '',
      projectName: row.projectName || 'General Billing',
      invoiceDate: row.invoiceDate || todayStr,
      dueDate: row.dueDate || dueStr,
      status: row.status,
      paymentTerms: 'Net 15 Days',
      currency: row.currency,
      gstPercent: 0,
      items,
      subtotal: finalAmount,
      discount: 0,
      taxableAmount: finalAmount,
      gstAmount: 0,
      totalAmount: finalAmount,
      amountPaid,
      balanceAmount: finalAmount - amountPaid,
      amountInWords: amountToWords(finalAmount, row.currency),
      notes: 'Thank you for your business!',
      paymentMethod: 'Bank Transfer / UPI',
      invoiceType: 'service',
      createdAt: new Date().toISOString(),
      bulkGroupId
    };
  };

  // Submit Form Quick Rows
  const handleSubmitRows = () => {
    const validRows = rows.filter(r => r.clientName.trim() !== '');
    if (validRows.length === 0) {
      alert('Please enter a Client Name for at least one invoice.');
      return;
    }

    const bulkGroupId = `inv_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let existingNumbers = existingInvoices.map(i => i.invoiceNumber);
    const newInvoices: Invoice[] = [];

    for (const r of validRows) {
      const invNum = generateInvoiceNumber(existingNumbers);
      existingNumbers.push(invNum);
      const inv = buildInvoiceFromRow(r, invNum, bulkGroupId);
      newInvoices.push(inv);
    }

    onBulkAddInvoices(newInvoices);
    onClose();
  };

  // Download Sample CSV
  const handleDownloadSampleCSV = () => {
    const headers = ['Client Name', 'Company Name', 'Client Email', 'Project Name', 'Amount', 'Currency', 'Invoice Date', 'Due Date', 'Status'];
    const row1 = ['Acme Technologies', 'Acme Tech Pvt Ltd', 'accounts@acme.com', 'Web App Design & Development', '45000', 'INR', todayStr, dueStr, 'Unpaid'];
    const row2 = ['Global Solutions', 'Global Sol Inc', 'billing@globalsol.com', 'Cloud Migration Consulting', '120000', 'INR', todayStr, dueStr, 'Paid'];

    const content = [headers.join(','), row1.join(','), row2.join(',')].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_invoices_sample_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        parseCSVData(text);
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV
  const parseCSVData = (rawText: string) => {
    setCsvError(null);
    try {
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setCsvError('CSV file must contain at least a header row and one data row.');
        setParsedPreview(null);
        return;
      }

      const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
      
      const clientIdx = headers.findIndex(h => h.includes('client') || h.includes('name'));
      const companyIdx = headers.findIndex(h => h.includes('company'));
      const emailIdx = headers.findIndex(h => h.includes('email'));
      const projectIdx = headers.findIndex(h => h.includes('project') || h.includes('description') || h.includes('service'));
      const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('price') || h.includes('total'));
      const currencyIdx = headers.findIndex(h => h.includes('currency'));
      const dateIdx = headers.findIndex(h => h.includes('invoice date') || h.includes('date'));
      const dueDateIdx = headers.findIndex(h => h.includes('due date') || h.includes('due'));
      const statusIdx = headers.findIndex(h => h.includes('status'));

      let currentNumbers = [...existingInvoices.map(i => i.invoiceNumber)];
      const result: Invoice[] = [];
      const csvBulkGroupId = `inv_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const cleanCols = cols.map(c => c.replace(/^["']|["']$/g, '').trim());

        const clientName = (clientIdx >= 0 && cleanCols[clientIdx]) ? cleanCols[clientIdx] : `Client ${i}`;
        const companyName = (companyIdx >= 0 && cleanCols[companyIdx]) ? cleanCols[companyIdx] : clientName;
        const email = (emailIdx >= 0 && cleanCols[emailIdx]) ? cleanCols[emailIdx] : '';
        const project = (projectIdx >= 0 && cleanCols[projectIdx]) ? cleanCols[projectIdx] : 'Professional Services';
        const amountVal = (amountIdx >= 0 && cleanCols[amountIdx]) ? parseFloat(cleanCols[amountIdx].replace(/[^0-9.]/g, '')) : 10000;
        const amount = isNaN(amountVal) ? 10000 : amountVal;

        let currency: 'INR' | 'USD' | 'EUR' = 'INR';
        if (currencyIdx >= 0 && cleanCols[currencyIdx]) {
          const currStr = cleanCols[currencyIdx].toUpperCase();
          if (currStr === 'USD') currency = 'USD';
          if (currStr === 'EUR') currency = 'EUR';
        }

        const invDate = (dateIdx >= 0 && cleanCols[dateIdx]) ? cleanCols[dateIdx] : todayStr;
        const due = (dueDateIdx >= 0 && cleanCols[dueDateIdx]) ? cleanCols[dueDateIdx] : dueStr;
        
        let status: 'Paid' | 'Unpaid' | 'Partially Paid' = 'Unpaid';
        if (statusIdx >= 0 && cleanCols[statusIdx]) {
          const st = cleanCols[statusIdx].toLowerCase();
          if (st.includes('paid') && !st.includes('unpaid') && !st.includes('partially')) status = 'Paid';
          if (st.includes('partial')) status = 'Partially Paid';
        }

        const invNum = generateInvoiceNumber(currentNumbers);
        currentNumbers.push(invNum);

        const r: QuickRow = {
          id: 'csv_row_' + i,
          clientName,
          clientCompanyName: companyName,
          clientEmail: email,
          projectName: project,
          amount,
          currency,
          invoiceDate: invDate,
          dueDate: due,
          status
        };

        result.push(buildInvoiceFromRow(r, invNum, csvBulkGroupId));
      }

      setParsedPreview(result);
    } catch (err: any) {
      setCsvError('Failed to parse CSV. Please ensure columns match the template format.');
      setParsedPreview(null);
    }
  };

  // Submit CSV Parsed Invoices
  const handleSubmitCSV = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;
    onBulkAddInvoices(parsedPreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-[#0F766E] dark:text-teal-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bulk Invoice Generator</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-[#0F766E] dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                  Batch Operations
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate multiple sequential invoices at once or import via CSV spreadsheet
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs tracking-wider transition-all cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Multi-Row Entry ({rows.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('csv')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs tracking-wider transition-all cursor-pointer ${
                activeTab === 'csv'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import CSV File</span>
            </button>
          </div>

          <button
            onClick={handleDownloadSampleCSV}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Download CSV sample format"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample CSV</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: FORM MULTI-ROW */}
          {activeTab === 'form' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Fill details for each invoice below:
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddRow}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-[#0F766E] dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>

              {/* Table of Rows */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-950/30">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-3 w-10">#</th>
                      <th className="px-3 py-3 min-w-[160px]">Client Name *</th>
                      <th className="px-3 py-3 min-w-[160px]">Project / Services</th>
                      <th className="px-3 py-3 min-w-[110px]">Amount</th>
                      <th className="px-3 py-3 min-w-[80px]">Currency</th>
                      <th className="px-3 py-3 min-w-[110px]">Status</th>
                      <th className="px-3 py-3 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                    {rows.map((r, index) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-3 font-mono font-bold text-slate-400 text-center">
                          {index + 1}
                        </td>
                        
                        {/* Client Name */}
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            list="clients_list"
                            value={r.clientName}
                            onChange={(e) => handleUpdateRow(r.id, 'clientName', e.target.value)}
                            placeholder="e.g. Shravani Corp"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                          />
                        </td>

                        {/* Project Name */}
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={r.projectName}
                            onChange={(e) => handleUpdateRow(r.id, 'projectName', e.target.value)}
                            placeholder="e.g. Web Development"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                          />
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={r.amount}
                            onChange={(e) => handleUpdateRow(r.id, 'amount', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                          />
                        </td>

                        {/* Currency */}
                        <td className="px-3 py-3">
                          <select
                            value={r.currency}
                            onChange={(e) => handleUpdateRow(r.id, 'currency', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none"
                          >
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                          </select>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <select
                            value={r.status}
                            onChange={(e) => handleUpdateRow(r.id, 'status', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none"
                          >
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                            <option value="Partially Paid">Partially Paid</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 text-center space-x-1">
                          <button
                            onClick={() => handleDuplicateRow(r)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Duplicate Row"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(r.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-400 hover:text-rose-600 transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Datalist for Client Auto-complete */}
              <datalist id="clients_list">
                {clients.map(c => (
                  <option key={c.id} value={c.name}>{c.companyName ? `${c.companyName}` : ''}</option>
                ))}
              </datalist>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleAddRow}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add another invoice row</span>
                </button>
                
                <span className="text-xs text-slate-400 font-medium">
                  Sequential IDs will be assigned automatically (e.g. {generateInvoiceNumber(existingInvoices.map(i => i.invoiceNumber))})
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: CSV IMPORT */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Upload className="h-4 w-4 text-[#0F766E]" />
                    <span>Upload CSV File or Paste Raw CSV Data</span>
                  </h4>
                  <button
                    onClick={handleDownloadSampleCSV}
                    className="text-xs font-bold text-[#0F766E] hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Get Sample Template</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File Upload Box */}
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#0F766E] rounded-xl p-4 text-center flex flex-col items-center justify-center space-y-2 bg-white dark:bg-slate-900 transition-colors">
                    <FileSpreadsheet className="h-8 w-8 text-teal-600/70" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Click to choose CSV file
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Supports .csv files with headers: Client Name, Company, Amount, Date, Status
                    </p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-file-input"
                    />
                    <label
                      htmlFor="csv-file-input"
                      className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950 text-[#0F766E] dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-extrabold cursor-pointer hover:bg-teal-100 transition-colors"
                    >
                      Browse File
                    </label>
                  </div>

                  {/* Textarea Paste */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Or Paste Raw CSV Lines:
                    </label>
                    <textarea
                      value={csvText}
                      onChange={(e) => {
                        setCsvText(e.target.value);
                        parseCSVData(e.target.value);
                      }}
                      placeholder={`Client Name, Company Name, Client Email, Project Name, Amount, Currency, Invoice Date, Due Date, Status\nShravani Corp, Shravani Ltd, info@shravani.com, Web App, 35000, INR, ${todayStr}, ${dueStr}, Unpaid`}
                      className="w-full h-28 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* CSV Parsing Error */}
              {csvError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedPreview && parsedPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Ready to Import ({parsedPreview.length} Valid Invoices Parsed)</span>
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 font-extrabold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Inv #</th>
                          <th className="px-3 py-2">Client Name</th>
                          <th className="px-3 py-2">Project</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                        {parsedPreview.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-mono font-bold text-[#0F766E]">{inv.invoiceNumber}</td>
                            <td className="px-3 py-2 font-bold">{inv.clientName}</td>
                            <td className="px-3 py-2 text-slate-500 truncate max-w-[150px]">{inv.projectName}</td>
                            <td className="px-3 py-2 font-mono font-bold">
                              {inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : '₹'}
                              {inv.totalAmount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {activeTab === 'form' ? (
              <span>Ready to create <strong>{rows.filter(r => r.clientName.trim() !== '').length}</strong> invoice(s)</span>
            ) : (
              <span>Parsed <strong>{parsedPreview?.length || 0}</strong> valid invoice(s) from CSV</span>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>

            {activeTab === 'form' ? (
              <button
                onClick={handleSubmitRows}
                className="px-5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0D645E] text-white font-extrabold text-xs cursor-pointer shadow-md transition-all flex items-center space-x-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate Invoices</span>
              </button>
            ) : (
              <button
                onClick={handleSubmitCSV}
                disabled={!parsedPreview || parsedPreview.length === 0}
                className={`px-5 py-2 rounded-xl font-extrabold text-xs cursor-pointer shadow-md transition-all flex items-center space-x-1.5 ${
                  parsedPreview && parsedPreview.length > 0
                    ? 'bg-[#0F766E] hover:bg-[#0D645E] text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import {parsedPreview?.length || 0} Invoices</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
