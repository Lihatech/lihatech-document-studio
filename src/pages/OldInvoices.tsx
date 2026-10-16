import ListFilters from '../components/lms/ListFilters';
import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  FileText,
  CheckSquare,
  Square,
  Download,
  Layers,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Sparkles
} from 'lucide-react';
import html2canvas from '../lib/html2canvas-patch';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Invoice, Client, CompanySettings } from '../types';
import BulkInvoiceModal from '../components/invoice/BulkInvoiceModal';
import InvoicePreview from '../components/invoice/InvoicePreview';
import PrintableInvoice from '../components/invoice/PrintableInvoice';

interface OldInvoicesProps {
  invoices: Invoice[];
  clients?: Client[];
  settings: CompanySettings;
  onSelectInvoice: (inv: Invoice) => void;
  onEditInvoice: (inv: Invoice) => void;
  onDeleteInvoice: (id: string | string[]) => Promise<boolean>;
  onBulkDeleteInvoices?: (ids: string[]) => Promise<boolean>;
  onBulkUpdateStatus?: (ids: string[], newStatus: 'Paid' | 'Unpaid' | 'Partially Paid') => Promise<boolean>;
  onBulkAddInvoices?: (newInvoices: Invoice[]) => Promise<boolean>;
  navigate: (path: string) => void;
}

interface InvoiceGroup {
  id: string;
  isBulk: boolean;
  bulkGroupId?: string;
  invoiceNumbers: string[];
  clientName: string;
  projectName?: string;
  invoiceDate: string;
  totalAmount: number;
  currency: 'INR' | 'USD' | 'EUR';
  statusSummary: string;
  invoices: Invoice[];
}

export default function OldInvoices({
  invoices,
  clients = [],
  settings,
  onSelectInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onBulkDeleteInvoices,
  onBulkUpdateStatus,
  onBulkAddInvoices,
  navigate
}: OldInvoicesProps) {
  const [search, setSearch] = useState('');
  const [paymentFilter,setPaymentFilter] = useState('all');
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);

  // Bulk Group Modal / Hub state
  const [selectedBulkGroup, setSelectedBulkGroup] = useState<InvoiceGroup | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [bulkSubSearch, setBulkSubSearch] = useState('');

  // Bulk Checkbox selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkGeneratorOpen, setIsBulkGeneratorOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // ZIP Generation State
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeExportInvoice, setActiveExportInvoice] = useState<Invoice | null>(null);
  const offscreenInvoiceRef = useRef<HTMLDivElement>(null);

  // Group invoices into single entries or bulk group entries
  const groups = useMemo(() => {
    const map = new Map<string, InvoiceGroup>();

    invoices.filter(inv=>paymentFilter==='all'||inv.status===paymentFilter).forEach(inv => {
      let groupKey = '';
      if (inv.bulkGroupId) {
        groupKey = inv.bulkGroupId;
      } else if (inv.id.startsWith('inv_bulk_')) {
        const parts = inv.id.split('_');
        const timestamp = parts[2];
        if (timestamp && !isNaN(Number(timestamp))) {
          const roundedTime = Math.round(Number(timestamp) / 10000) * 10000;
          groupKey = `legacy_inv_bulk_${roundedTime}`;
        } else {
          groupKey = `legacy_inv_bulk_${inv.createdAt}`;
        }
      }

      if (groupKey) {
        const existing = map.get(groupKey);
        if (existing) {
          existing.invoices.push(inv);
          existing.totalAmount += inv.totalAmount;
          existing.invoiceNumbers.push(inv.invoiceNumber);
        } else {
          map.set(groupKey, {
            id: groupKey,
            isBulk: true,
            bulkGroupId: groupKey,
            invoiceNumbers: [inv.invoiceNumber],
            clientName: inv.clientName,
            projectName: inv.projectName,
            invoiceDate: inv.invoiceDate,
            totalAmount: inv.totalAmount,
            currency: inv.currency,
            statusSummary: inv.status,
            invoices: [inv]
          });
        }
      } else {
        map.set(inv.id, {
          id: inv.id,
          isBulk: false,
          invoiceNumbers: [inv.invoiceNumber],
          clientName: inv.clientName,
          projectName: inv.projectName,
          invoiceDate: inv.invoiceDate,
          totalAmount: inv.totalAmount,
          currency: inv.currency,
          statusSummary: inv.status,
          invoices: [inv]
        });
      }
    });

    const list = Array.from(map.values());

    // Filter groups based on search
    const term = search.toLowerCase();
    if (!term) {
      return list.sort((a, b) => new Date(b.invoices[0].createdAt).getTime() - new Date(a.invoices[0].createdAt).getTime());
    }

    const filteredList = list.filter(g => {
      if (g.isBulk) {
        if (`batch ${g.invoices.length} invoices`.includes(term) || g.invoiceDate.includes(term)) {
          return true;
        }
      }
      return g.invoices.some(inv => 
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.clientName.toLowerCase().includes(term) ||
        inv.status.toLowerCase().includes(term) ||
        (inv.projectName && inv.projectName.toLowerCase().includes(term))
      );
    });

    return filteredList.sort((a, b) => new Date(b.invoices[0].createdAt).getTime() - new Date(a.invoices[0].createdAt).getTime());
  }, [invoices, search, paymentFilter]);

  // Checkbox Selection state helpers
  const allInvoiceIds = useMemo(() => invoices.map(i => i.id), [invoices]);
  const isAllSelected = allInvoiceIds.length > 0 && allInvoiceIds.every(id => selectedIds.includes(id));
  const isSomeSelected = selectedIds.length > 0;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds([...allInvoiceIds]);
    }
  };

  const handleToggleSelectGroup = (group: InvoiceGroup) => {
    const groupIds = group.invoices.map(i => i.id);
    const areAllGroupSelected = groupIds.every(id => selectedIds.includes(id));

    if (areAllGroupSelected) {
      setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...groupIds])));
    }
  };

  // Delete Handlers
  const handleDeleteGroupClick = (group: InvoiceGroup) => {
    setConfirmDeleteIds(group.invoices.map(i => i.id));
  };

  const executeDelete = async () => {
    if (confirmDeleteIds) {
      if (onBulkDeleteInvoices) {
        if (!await onBulkDeleteInvoices(confirmDeleteIds)) return;
      } else {
        if (!await onDeleteInvoice(confirmDeleteIds)) return;
      }

      if (selectedBulkGroup) {
        const remaining = selectedBulkGroup.invoices.filter(i => !confirmDeleteIds.includes(i.id));
        if (remaining.length === 0) {
          setSelectedBulkGroup(null);
          setSelectedInvoiceId(null);
        } else {
          setSelectedBulkGroup({
            ...selectedBulkGroup,
            invoices: remaining
          });
          if (selectedInvoiceId && confirmDeleteIds.includes(selectedInvoiceId)) {
            setSelectedInvoiceId(remaining[0].id);
          }
        }
      }

      setSelectedIds(prev => prev.filter(id => !confirmDeleteIds.includes(id)));
      setConfirmDeleteIds(null);
    }
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length > 0) {
      if (onBulkDeleteInvoices) {
        if (!await onBulkDeleteInvoices(selectedIds)) return;
      } else {
        if (!await onDeleteInvoice(selectedIds)) return;
      }
      setSelectedIds([]);
      setConfirmBulkDelete(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: 'Paid' | 'Unpaid' | 'Partially Paid') => {
    if (onBulkUpdateStatus && selectedIds.length > 0) {
      if (!await onBulkUpdateStatus(selectedIds, newStatus)) return;
      setStatusMenuOpen(false);
    }
  };

  // Download ZIP for a bulk group
  const downloadGroupZip = async (group: InvoiceGroup) => {
    if (!group || group.invoices.length === 0) return;

    try {
      setIsExportingZip(true);
      setExportProgress({ current: 0, total: group.invoices.length });

      const zip = new JSZip();

      for (let i = 0; i < group.invoices.length; i++) {
        const inv = group.invoices[i];
        setActiveExportInvoice(inv);
        setExportProgress({ current: i + 1, total: group.invoices.length });

        // Wait for offscreen render
        await new Promise(res => setTimeout(res, 250));

        const el = offscreenInvoiceRef.current;
        if (!el) continue;

        // Wait for any logo/signature images to finish loading
        const images = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }));

        const canvas = await html2canvas(el, {
          scale: 2.5,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#FFFFFF',
          logging: false,
          windowWidth: 794,
          windowHeight: 1123
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        const pdfBlob = pdf.output('blob');

        const cleanClient = inv.clientName.replace(/[\s/\\?%*:|"<>]+/g, '_');
        const fileName = `LihaTech_Invoice_${inv.invoiceNumber}_${cleanClient}.pdf`;
        zip.file(fileName, pdfBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `LihaTech_Bulk_Invoices_${group.invoiceDate.replace(/[/\\?%*:|"<>]/g, '-')}.zip`);
    } catch (err) {
      console.error('Failed to generate Bulk Invoices ZIP file', err);
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
      setActiveExportInvoice(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const targetInvoices = selectedIds.length > 0 
      ? invoices.filter(i => selectedIds.includes(i.id))
      : invoices;

    if (targetInvoices.length === 0) return;

    const headers = ['Invoice Number', 'Client Name', 'Company Name', 'Email', 'Invoice Date', 'Due Date', 'Currency', 'Total Amount', 'Amount Paid', 'Balance', 'Status', 'Project Name'];
    const rows = targetInvoices.map(inv => [
      `"${inv.invoiceNumber}"`,
      `"${inv.clientName.replace(/"/g, '""')}"`,
      `"${(inv.clientCompanyName || '').replace(/"/g, '""')}"`,
      `"${inv.clientEmail}"`,
      `"${inv.invoiceDate}"`,
      `"${inv.dueDate}"`,
      `"${inv.currency}"`,
      inv.totalAmount,
      inv.amountPaid,
      inv.balanceAmount,
      `"${inv.status}"`,
      `"${(inv.projectName || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `invoices_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'Paid':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Partially Paid':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Unpaid':
      default:
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
  };

  // Filtered sub-invoices in bulk modal
  const filteredBulkInvoices = useMemo(() => {
    if (!selectedBulkGroup) return [];
    const term = bulkSubSearch.toLowerCase();
    if (!term) return selectedBulkGroup.invoices;
    return selectedBulkGroup.invoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.clientName.toLowerCase().includes(term) ||
      inv.status.toLowerCase().includes(term) ||
      (inv.projectName && inv.projectName.toLowerCase().includes(term))
    );
  }, [selectedBulkGroup, bulkSubSearch]);

  const activeModalInvoice = useMemo(() => {
    if (!selectedBulkGroup) return null;
    const invId = selectedInvoiceId || selectedBulkGroup.invoices[0]?.id;
    return selectedBulkGroup.invoices.find(i => i.id === invId) || selectedBulkGroup.invoices[0] || null;
  }, [selectedBulkGroup, selectedInvoiceId]);

  return (
    <div className="space-y-6 animate-fade-in py-2" id="old-invoices-page">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-850">
        <div>
          <span className="text-xxs font-bold text-[#0F766E] dark:text-teal-400 uppercase tracking-widest block">Invoices</span>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Saved invoices</h1>
        </div>
        
        {/* Action Button Group */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBulkGeneratorOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-600 to-[#0F766E] hover:from-teal-700 hover:to-[#0D645E] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-sm"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Create in bulk</span>
          </button>

          <button
            onClick={() => navigate('/invoice/new')}
            className="studio-button studio-button-primary text-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create invoice</span>
          </button>
        </div>
      </div>

      {/* Filter, Search board & Export */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full"><ListFilters query={search} onQuery={setSearch} placeholder="Search invoice, client or project" filters={[{label:'Payment status',value:paymentFilter,onChange:setPaymentFilter,options:[{value:'all',label:'All payment statuses'},...[...new Set(invoices.map(row=>row.status))].sort().map(value=>({value,label:value}))]}]}/></div>

        <button
          onClick={handleExportCSV}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-400 font-extrabold text-xs cursor-pointer transition-colors shrink-0"
          title="Export filtered or selected invoices to CSV"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Bulk Selection Toolbar */}
      {isSomeSelected && (
        <div className="p-3.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/80 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-[#0F766E] text-white text-xs font-black">
              {selectedIds.length}
            </span>
            <span className="text-xs font-extrabold text-teal-900 dark:text-teal-200">
              Invoice(s) Selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>Update Status</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {statusMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                  <button
                    onClick={() => handleBulkStatusChange('Paid')}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Mark as Paid</span>
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('Unpaid')}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Mark as Unpaid</span>
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('Partially Paid')}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Mark as Partially Paid</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Selected</span>
            </button>

            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Clear Selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grouped Invoices Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {groups.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">No invoices found matching current records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-850 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-extrabold text-xxs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-[#0F766E] transition-colors cursor-pointer"
                      title={isAllSelected ? 'Deselect All' : 'Select All'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="h-4 w-4 text-[#0F766E]" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">Invoice Number</th>
                  <th className="px-6 py-4">Client Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Invoice Date</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-850 font-medium text-slate-700 dark:text-slate-300">
                {groups.map((group) => {
                  const groupIds = group.invoices.map(i => i.id);
                  const isGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));

                  if (group.isBulk) {
                    // Bulk Group Row (Shows as 1 single entry only)
                    const uniqueClients = Array.from(new Set(group.invoices.map(i => i.clientName)));
                    const clientDisplay = uniqueClients.length === 1 ? uniqueClients[0] : `Multiple Clients (${uniqueClients.length})`;

                    return (
                      <tr 
                        key={group.id}
                        className={`transition-all bg-teal-50/30 dark:bg-teal-950/20 hover:bg-teal-50/60 dark:hover:bg-teal-950/40 ${
                          isGroupSelected ? 'ring-1 ring-teal-500/30' : ''
                        }`}
                      >
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleToggleSelectGroup(group)}
                            className="text-slate-400 hover:text-[#0F766E] transition-colors cursor-pointer"
                          >
                            {isGroupSelected ? (
                              <CheckSquare className="h-4 w-4 text-[#0F766E]" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        {/* Invoice Number Column: Single Batch Badge */}
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white font-mono">
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-500/15 text-[#0F766E] dark:text-teal-400 border border-teal-500/30 font-extrabold text-[11px]">
                              <Layers className="h-3.5 w-3.5 mr-1" />
                              <span>BATCH ({group.invoices.length} INVOICES)</span>
                            </span>
                          </div>
                        </td>

                        {/* Client Name Column */}
                        <td className="px-6 py-4 max-w-[200px]">
                          <div className="font-extrabold text-slate-900 dark:text-white truncate">{clientDisplay}</div>
                          <div className="text-[10px] text-teal-700 dark:text-teal-400 font-bold truncate">
                            {group.invoices.length} Invoices generated in bulk
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-800">
                            Bulk Batch ({group.invoices.length})
                          </span>
                        </td>

                        {/* Invoice Date Column */}
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono font-bold">{group.invoiceDate}</td>

                        {/* Total Amount Column */}
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white font-mono">
                          {group.currency === 'USD' ? '$' : group.currency === 'EUR' ? '€' : '₹'}
                          {group.totalAmount.toLocaleString(group.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Download ZIP Button */}
                          <button
                            onClick={() => downloadGroupZip(group)}
                            disabled={isExportingZip}
                            className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                            title="Download All Invoices as ZIP"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>ZIP</span>
                          </button>

                          {/* Open Bulk Group Hub View */}
                          <button
                            onClick={() => {
                              setSelectedBulkGroup(group);
                              setSelectedInvoiceId(group.invoices[0]?.id || null);
                            }}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-[#0F766E] hover:bg-teal-800 text-white cursor-pointer transition-colors shadow-xs"
                            title="View Invoices in Batch"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Delete Batch */}
                          <button
                            onClick={() => handleDeleteGroupClick(group)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                            title="Delete Entire Batch"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Single Invoice Row
                  const inv = group.invoices[0];
                  const isSelected = selectedIds.includes(inv.id);

                  return (
                    <tr 
                      key={inv.id} 
                      className={`transition-all ${
                        isSelected 
                          ? 'bg-teal-500/5 dark:bg-teal-950/20' 
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-950/20'
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedIds(prev => 
                              prev.includes(inv.id) ? prev.filter(i => i !== inv.id) : [...prev, inv.id]
                            );
                          }}
                          className="text-slate-400 hover:text-[#0F766E] transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-[#0F766E]" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white font-mono">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 max-w-[180px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{inv.clientName}</div>
                        {inv.projectName && (
                          <div className="text-[10px] text-slate-400 truncate">{inv.projectName}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${getStatusBadge(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono">{inv.invoiceDate}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white font-mono">
                        {inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : '₹'}
                        {inv.totalAmount.toLocaleString(inv.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                          title="View & Download PDF"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onEditInvoice(inv)}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 cursor-pointer transition-colors"
                          title="Edit Invoice"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteIds([inv.id])}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Group Modal / Hub View */}
      {selectedBulkGroup && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl h-[92vh] shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/15 text-[#0F766E] dark:text-teal-400">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-lg">
                      Bulk Invoice Batch
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-[#0F766E] dark:text-teal-400 text-xs font-black">
                      {selectedBulkGroup.invoices.length} Invoices
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Created on {selectedBulkGroup.invoiceDate} • Total Batch Value: {selectedBulkGroup.currency === 'USD' ? '$' : selectedBulkGroup.currency === 'EUR' ? '€' : '₹'}{selectedBulkGroup.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Top Controls */}
              <div className="flex items-center space-x-3">
                {/* Download ZIP Button inside Modal */}
                <button
                  onClick={() => downloadGroupZip(selectedBulkGroup)}
                  disabled={isExportingZip}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-md disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  <span>{isExportingZip && exportProgress ? `Exporting ZIP (${exportProgress.current}/${exportProgress.total})...` : 'Download ZIP'}</span>
                </button>

                <button
                  onClick={() => setSelectedBulkGroup(null)}
                  className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Sidebar list + Main Preview */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Sidebar: Invoices in batch */}
              <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col shrink-0">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={bulkSubSearch}
                      onChange={(e) => setBulkSubSearch(e.target.value)}
                      placeholder="Filter invoices..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                  {filteredBulkInvoices.map((inv) => {
                    const isActive = activeModalInvoice?.id === inv.id;
                    return (
                      <div
                        key={inv.id}
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
                          isActive 
                            ? 'bg-[#0F766E] text-white shadow-md' 
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800/80'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-xs">{inv.invoiceNumber}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase ${
                              isActive 
                                ? 'bg-white/20 text-white' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className={`text-xs font-semibold truncate mt-0.5 ${isActive ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {inv.clientName}
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Main Preview */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-y-auto p-4 flex justify-center">
                {activeModalInvoice ? (
                  <div className="w-full max-w-3xl">
                    <InvoicePreview
                      invoice={activeModalInvoice}
                      settings={settings}
                      showActions={true}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-12">
                    <FileText className="h-10 w-10 mb-2" />
                    <p className="text-xs">Select an invoice from the left list to preview.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteIds && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-base">Confirm Permanent Deletion?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete {confirmDeleteIds.length} invoice record(s)? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmDeleteIds(null)}
                className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer hover:bg-rose-700 shadow-sm"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Overlay */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" />
              <span>Delete {selectedIds.length} Selected Invoices?</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You are about to permanently remove <strong>{selectedIds.length}</strong> selected invoice record(s) from your archive. This action cannot be reversed.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmBulkDelete(false)}
                className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Delete {selectedIds.length} Invoices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Invoice Modal */}
      <BulkInvoiceModal
        isOpen={isBulkGeneratorOpen}
        onClose={() => setIsBulkGeneratorOpen(false)}
        existingInvoices={invoices}
        clients={clients}
        onBulkAddInvoices={(newInvoices) => {
          if (onBulkAddInvoices) return onBulkAddInvoices(newInvoices);
          return Promise.resolve(false);
        }}
      />

      {/* Hidden Offscreen Container for High-Quality ZIP PDF Export Rendering */}
      <div 
        style={{ 
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '794px',
          overflow: 'hidden',
          zIndex: -9999,
          pointerEvents: 'none',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div ref={offscreenInvoiceRef} className="bg-white text-slate-800" style={{ width: '794px' }}>
          {activeExportInvoice && (
            <PrintableInvoice
              invoice={activeExportInvoice}
              settings={settings}
            />
          )}
        </div>
      </div>

    </div>
  );
}
