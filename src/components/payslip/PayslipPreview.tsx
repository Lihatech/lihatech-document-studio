import React, { useRef, useState, useEffect } from 'react';
import { 
  Download, 
  Printer, 
  X,
  Receipt,
  Check
} from 'lucide-react';
import { Payslip, CompanySettings } from '../../types';
import { amountToWords } from '../../utils/amountToWords';
import html2canvas from '../../lib/html2canvas-patch';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import companyWatermark from '../../../only_logo-removebg-preview.png';

interface PayslipPreviewProps {
  payslip: Payslip;
  settings: CompanySettings;
  onClose?: () => void;
  showActions?: boolean;
}

export default function PayslipPreview({ payslip, settings, onClose, showActions = true }: PayslipPreviewProps) {
  const payslipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenPayslipRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [scale, setScale] = useState(showActions ? 1.0 : 0.8);

  useEffect(() => {
    if (showActions) {
      setScale(1.0);
    }
  }, [showActions]);

  // Handle Ctrl + Scroll to zoom when inside the modal (showActions is true)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setScale(prev => {
          const delta = e.deltaY < 0 ? 0.05 : -0.05;
          const newScale = prev + delta;
          return Math.min(Math.max(newScale, 0.25), 3.0);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    // Only register resize observer if not showActions (embedded inline, where it needs to auto-fit)
    if (showActions) return;

    const updateScale = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;
      const padding = 32;
      const baseWidth = 800;

      // Inline/embedded: scale based on width only
      const availableWidth = containerWidth - padding;
      const finalScale = availableWidth / baseWidth;
      setScale(Math.min(Math.max(finalScale, 0.15), 1.05));
    };

    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    updateScale();

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, [showActions]);

  // Math safety
  const basic = Number(payslip.basicSalary || 0);
  const hra = Number(payslip.hra || 0);
  const allowances = Number(payslip.allowances || 0);
  const bonus = Number(payslip.bonus || 0);
  const pf = Number(payslip.pf || 0);
  const pt = Number(payslip.professionalTax || 0);
  const deductions = Number(payslip.deductions || 0);

  const grossSalary = basic + hra + allowances + bonus;
  const totalDeductions = pf + pt + deductions;
  const netSalary = grossSalary - totalDeductions;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return dateStr;
  };

  const formatAddress = (addressStr: string) => {
    if (!addressStr) return [];
    const parts = addressStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length <= 2) return parts;
    
    // Group into 2 lines nicely
    const mid = Math.ceil(parts.length / 2);
    const line1 = parts.slice(0, mid).join(', ');
    const line2 = parts.slice(mid).join(', ');
    return [line1, line2];
  };

  const handleDownloadPDF = async () => {
    const element = offscreenPayslipRef.current || payslipRef.current;
    if (!element) return;
    
    try {
      setExporting(true);
      
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      const fileName = `LihaTech_Payslip_${payslip.employeeId}_${payslip.employeeName.replace(/\s+/g, '_')}_${payslip.monthAndYear.replace(/\s+/g, '_')}.pdf`;
      const pdfBlob = pdf.output('blob');
      saveAs(pdfBlob, fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setExporting(false);
    }
  };

  const renderPayslipContent = () => {
    return (
      <div 
        className="bg-white text-black p-12 mx-auto font-sans relative flex flex-col justify-between"
        style={{ width: '800px', minHeight: '1130px', boxSizing: 'border-box' }}
      >
        {/* Subtle Watermark Logo in center background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0" style={{ opacity: 0.14 }}>
          <img 
            src={companyWatermark} 
            alt="Watermark Logo" 
            className="w-[720px] h-[720px] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-10 space-y-6 flex-1 flex flex-col justify-between">
          <div>
            {/* Elegant Header with Logo on Left, Details on Right */}
            <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4 mb-6 w-full">
              <div>
                {settings.logoUrl ? (
                  <img 
                    src={settings.logoUrl} 
                    alt="LihaTech Logo" 
                    className="h-20 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex items-center space-x-2 text-teal-900">
                    <span className="text-2xl font-black tracking-tight">{settings.name}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-[10px] text-black space-y-1 max-w-[360px] pr-2">
                <p className="font-extrabold text-black text-xs">{settings.name}</p>
                {formatAddress(settings.address).map((line, idx) => (
                  <p key={idx} className="leading-relaxed font-bold">{line}</p>
                ))}
                <p className="font-bold">Email: {settings.email}</p>
                <p className="font-bold">Web: {settings.website}</p>
              </div>
            </div>

            {/* Payslip Header Bar */}
            <div className="bg-[#f1f5f9] py-3 px-4 rounded-xl text-center mb-6">
              <h1 className="text-lg font-black text-[#0f172a] uppercase tracking-widest">
                PAYSLIP FOR THE MONTH OF {payslip.monthAndYear}
              </h1>
            </div>

            {/* Employee Details Grid */}
            <div className="border border-slate-400 rounded-lg overflow-hidden mb-6 text-xs text-left bg-slate-50/50">
              <div className="grid grid-cols-12 border-b border-slate-300">
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Employee Name</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950 border-r border-slate-300">{payslip.employeeName}</div>
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Designation</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950">{payslip.designation}</div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-300">
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Employee ID</div>
                <div className="col-span-3 px-3 py-2 font-mono font-black text-slate-950 border-r border-slate-300">{payslip.employeeId}</div>
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">PAN</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950">{payslip.pan || 'NA'}</div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-300">
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Date of Joining</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950 border-r border-slate-300">{payslip.dateOfJoining || 'NA'}</div>
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Bank Acc/Name</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950">{payslip.bankAccName || 'NA'}</div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-300">
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Location</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950 border-r border-slate-300">{payslip.location || 'Gurgaon'}</div>
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">PF Account Number</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950">{payslip.pfAccountNumber || 'NA'}</div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-300">
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Days in Month</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950 border-r border-slate-300">{payslip.daysInMonth !== undefined ? payslip.daysInMonth : 28}</div>
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">UAN</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950">{payslip.uan || 'NA'}</div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">Effective Work Days</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950 border-r border-slate-300">{payslip.effectiveWorkDays !== undefined ? payslip.effectiveWorkDays : 28}</div>
                <div className="col-span-3 bg-slate-150 px-3 py-2 font-black text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[10px]">LOP</div>
                <div className="col-span-3 px-3 py-2 font-black text-slate-950">{payslip.lop !== undefined ? payslip.lop : 0}</div>
              </div>
            </div>

            {/* Income & Deductions Side-by-Side Double Column table */}
            <div className="grid grid-cols-2 border border-slate-400 rounded-xl overflow-hidden mb-6">
              
              {/* Left Column: Earnings */}
              <div className="border-r border-slate-400 flex flex-col justify-between">
                <div>
                  <div className="bg-slate-100 border-b border-slate-400 px-4 py-2 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-950 uppercase tracking-widest">EARNINGS</span>
                    <span className="text-[10px] font-black text-slate-800">AMOUNT (₹)</span>
                  </div>
                  
                  <div className="px-4 py-3 space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-950 font-black">Basic Salary</span>
                      <span className="text-slate-950 font-black">₹ {basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-950 font-black">HRA (House Rent Allowance)</span>
                      <span className="text-slate-950 font-black">₹ {hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-950 font-black">Special Allowances</span>
                      <span className="text-slate-950 font-black">₹ {allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {bonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-950 font-black">Bonus / Incentives</span>
                        <span className="text-slate-950 font-black">₹ {bonus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-100 border-t border-slate-400 px-4 py-2.5 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-950 uppercase tracking-widest">Gross Salary (A)</span>
                  <span className="text-xs font-black text-slate-950">₹ {grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Right Column: Deductions */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="bg-slate-100 border-b border-slate-400 px-4 py-2 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-950 uppercase tracking-widest">DEDUCTIONS</span>
                    <span className="text-[10px] font-black text-slate-800">AMOUNT (₹)</span>
                  </div>
                  
                  <div className="px-4 py-3 space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-950 font-black">Provident Fund (PF)</span>
                      <span className="text-slate-950 font-black">₹ {pf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-950 font-black">Professional Tax (PT)</span>
                      <span className="text-slate-950 font-black">₹ {pt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {deductions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-950 font-black">Other Deductions</span>
                        <span className="text-slate-950 font-black">₹ {deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-100 border-t border-slate-400 px-4 py-2.5 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-950 uppercase tracking-widest">Total Deductions (B)</span>
                  <span className="text-xs font-black text-[#991B1B]">₹ {totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

            </div>

            {/* Net Pay Box */}
            <div className="border-2 border-[#020617] rounded-xl p-5 bg-[#f8fafc] flex justify-between items-center mb-6">
              <div>
                <span className="text-xxs font-extrabold text-[#94a3b8] uppercase tracking-widest">NET SALARY PAYABLE (A - B)</span>
                <h2 className="text-2xl font-black text-[#0f172a] mt-1">
                  ₹ {netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <div className="text-right max-w-sm">
                <span className="text-xxs font-extrabold text-[#94a3b8] uppercase tracking-widest">Net Pay in Words</span>
                <p className="text-xs font-bold text-[#1e293b] capitalize mt-1 leading-tight">
                  {amountToWords(Math.round(netSalary))} Rupees Only
                </p>
              </div>
            </div>

            {/* Fine print footer */}
            <div className="text-center text-[9px] text-[#94a3b8] font-medium border-t border-[#f1f5f9] pt-3 mt-6">
              This is a computer-generated payslip of {settings.name} and does not require a physical signature. 
              All values are confidential and governed by corporate payroll terms.
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${
        showActions 
          ? 'fixed inset-6 z-50 bg-white dark:bg-slate-900' 
          : 'bg-slate-900/5 dark:bg-slate-900/40 max-w-4xl w-full mx-auto'
      }`}
    >
      
      {/* Top action control bar */}
      {showActions && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-b border-gray-150 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
            <Receipt className="h-5 w-5 text-teal-500" />
            <span className="text-xs font-extrabold uppercase tracking-wider">Salary Slip Preview</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPDF}
              disabled={exporting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exporting ? 'Compiling PDF...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-750 text-slate-700 dark:text-slate-200 hover:bg-gray-50 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Screen Interactive Render View with custom centering on grey stage */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-auto rounded-b-2xl bg-slate-100 dark:bg-slate-950 p-6 flex justify-center items-start cursor-zoom-out"
        style={!showActions ? { maxHeight: 'calc(100vh - 160px)' } : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        <div 
          style={{ 
            width: `${800 * scale}px`,
            height: `${1130 * scale}px`,
            overflow: 'hidden',
          }}
          className="flex-shrink-0"
        >
          <div 
            ref={payslipRef} 
            className="shadow-2xl rounded-sm overflow-hidden bg-white cursor-default" 
            style={{ 
              width: '800px', 
              height: '1130px',
              boxSizing: 'border-box',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderPayslipContent()}
          </div>
        </div>
      </div>

      {/* Off-screen high quality canvas capture node */}
      <div 
        style={{ 
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '800px',
          height: '1130px',
          overflow: 'hidden',
          zIndex: -9999,
          pointerEvents: 'none'
        }}
      >
        <div ref={offscreenPayslipRef}>
          {renderPayslipContent()}
        </div>
      </div>

    </div>
  );
}
