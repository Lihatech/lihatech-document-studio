import ListFilters from '../components/lms/ListFilters';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  Receipt,
  X,
  FileText,
  Calendar,
  Briefcase,
  Building,
  DollarSign
} from 'lucide-react';
import { Payslip, CompanySettings } from '../types';
import PayslipPreview from '../components/payslip/PayslipPreview';

interface OldPayslipsProps {
  payslips: Payslip[];
  settings: CompanySettings;
  onEditPayslip: (payslip: Payslip) => void;
  onDeletePayslip: (id: string) => Promise<boolean>;
  navigate: (path: string) => void;
}

export default function OldPayslips({
  payslips,
  settings,
  onEditPayslip,
  onDeletePayslip,
  navigate
}: OldPayslipsProps) {
  const [search, setSearch] = useState('');
  const [category,setCategory] = useState('all');
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter payslips based on search
  const filteredPayslips = useMemo(() => {
    return payslips.filter(payslip => {
      if(category!=='all'&&payslip.monthAndYear!==category) return false;
      const query = search.toLowerCase();
      return (
        payslip.employeeName.toLowerCase().includes(query) ||
        payslip.employeeId.toLowerCase().includes(query) ||
        payslip.designation.toLowerCase().includes(query) ||
        payslip.department.toLowerCase().includes(query) ||
        payslip.monthAndYear.toLowerCase().includes(query)
      );
    });
  }, [payslips, search, category]);

  const handleDelete = async (id: string) => {
    if (!await onDeletePayslip(id)) return;
    setConfirmDeleteId(null);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6 animate-fade-in py-2" id="old-payslips-dashboard">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-teal-500" />
            <span>Saved payslips</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Find saved payslips, preview employee salary details, and export records.
          </p>
        </div>
        <button
          onClick={() => navigate('/payslip/new')}
          className="studio-button studio-button-primary text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Create payslip</span>
        </button>
      </div>

      <ListFilters query={search} onQuery={setSearch} placeholder="Search name, ID or details" filters={[{label:'Month',value:category,onChange:setCategory,options:[{value:'all',label:'All months'},...[...new Set(payslips.map(row=>row.monthAndYear))].sort().map(value=>({value,label:value}))]}]}/>

      {/* Grid List View of Payslips */}
      {filteredPayslips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPayslips.map((payslip) => (
            <div 
              key={payslip.id}
              className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between hover:shadow-md transition-shadow text-left"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-full border border-teal-200/40">
                    {payslip.monthAndYear}
                  </span>
                  <span className="text-xxs font-mono text-slate-400 dark:text-slate-500 font-bold bg-gray-50 dark:bg-slate-850 px-2 py-0.5 rounded-md border border-gray-100 dark:border-slate-800">
                    {payslip.employeeId}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight truncate">
                    {payslip.employeeName}
                  </h3>
                  
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{payslip.designation}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{payslip.department}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 pt-1 text-gray-900 dark:text-white font-extrabold text-sm border-t border-gray-50 dark:border-slate-850 mt-1">
                      <DollarSign className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>Net Pay: ₹{Number(payslip.netSalary).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Row */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setSelectedPayslip(payslip)}
                  className="inline-flex items-center space-x-1 text-xxs font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview Slip</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEditPayslip(payslip)}
                    className="p-1.5 bg-gray-50 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/40 text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg cursor-pointer transition-colors border border-gray-100 dark:border-slate-700"
                    title="Edit Payslip"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(payslip.id)}
                    className="p-1.5 bg-gray-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer transition-colors border border-gray-100 dark:border-slate-700"
                    title="Delete Record"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 max-w-xl mx-auto space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-full w-fit mx-auto text-slate-400">
            <Receipt className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">No Salary Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search ? 'No results matched your search query. Try clearing filters or refining terms.' : 'Generate professional corporate payslips with auto salary calculations and taxes.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => navigate('/payslip/new')}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-850 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Generate First Slip</span>
            </button>
          )}
        </div>
      )}

      {/* PORTAL: Detailed Slip Preview Modal */}
      {selectedPayslip && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedPayslip(null)}
        >
          <div 
            className="w-full h-full max-w-none animate-zoom-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <PayslipPreview 
              payslip={selectedPayslip}
              settings={settings}
              onClose={() => setSelectedPayslip(null)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE DIALOG OVERLAY */}
      {confirmDeleteId && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full shadow-xl space-y-6 animate-scale-up text-left">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Delete Official Record</h3>
              <p className="text-xs text-slate-500">
                Are you absolutely sure you want to delete this corporate employee payslip? This action cannot be undone, and all payroll statistics will be permanently removed.
              </p>
            </div>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
