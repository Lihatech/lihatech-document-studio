import React, { useRef, useState } from 'react';
import { 
  Download, 
  Printer, 
  Check, 
  FileCheck, 
  X,
  CreditCard
} from 'lucide-react';
import { Invoice, CompanySettings } from '../../types';
import { amountToWords } from '../../utils/amountToWords';
import html2canvas from '../../lib/html2canvas-patch';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

// Helper to chunk items into paginated lists of 6 items per page
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface InvoicePreviewProps {
  invoice: Invoice;
  settings: CompanySettings;
  onClose?: () => void;
  showActions?: boolean;
}

export default function InvoicePreview({ invoice, settings, onClose, showActions = true }: InvoicePreviewProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const offscreenInvoiceRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(80);

  const itemChunks = invoice.items.length > 0 ? chunk(invoice.items, 6) : [[]];
  const pageCount = itemChunks.length;

  // Helper for formatting currencies
  const formatCurrencySymbol = (curr: string) => {
    switch (curr) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return '₹';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

  const renderDescription = (desc: string) => {
    if (!desc) return null;
    const lines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return (
      <ul className="mt-1.5 space-y-1 pl-4 list-none text-left">
        {lines.map((line, i) => {
          const cleanLine = line.replace(/^[–\-•*\s]+/, '');
          return (
            <li key={i} className="text-slate-600 text-[11px] leading-relaxed flex items-start">
              <span className="mr-1.5 text-slate-500 font-extrabold">–</span>
              <span>{cleanLine}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const handleDownloadPDF = async () => {
    const element = offscreenInvoiceRef.current;
    if (!element) return;
    
    try {
      setExporting(true);
      
      // Wait for fonts to load
      if (document.fonts) {
        await document.fonts.ready;
      }
      
      // Wait for all images within the element to load completely
      const images = element.querySelectorAll('img');
      const imagePromises = Array.from(images).map((imgElement) => {
        const img = imgElement as HTMLImageElement;
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      });
      await Promise.all(imagePromises);
      
      // Small timeout to ensure styling and rendering is complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFFFFF',
        logging: false,
        windowWidth: 794,
        windowHeight: 1123 * pageCount
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      
      for (let i = 0; i < pageCount; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        const posY = -i * pageHeight;
        pdf.addImage(imgData, 'PNG', 0, posY, imgWidth, pageHeight * pageCount, undefined, 'FAST');
      }
      
      const fileName = `LihaTech_Invoice_${invoice.invoiceNumber}_${invoice.clientName.replace(/\s+/g, '_')}.pdf`;
      const pdfBlob = pdf.output('blob');
      saveAs(pdfBlob, fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };



  const renderInvoiceFooter = (isForDownload: boolean = false) => {
    return (
      <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mt-6 border-t border-slate-100 pt-6 w-full text-left" style={{ borderColor: '#F1F5F9' }}>
        {/* Authentic overlapping signature & stamp block */}
        <div className="flex flex-col items-start text-left">
          <div className="relative h-20 w-56 flex items-center mb-1">
            {settings.signatureUrl && (
              <img 
                src={settings.signatureUrl} 
                alt="Director Signature" 
                className="h-14 w-auto object-contain z-10 select-none pointer-events-none" 
                referrerPolicy="no-referrer"
              />
            )}
            {settings.stampUrl && (
              <img 
                src={settings.stampUrl} 
                alt="Authorized Stamp" 
                className="h-20 w-20 object-contain absolute left-24 opacity-85 z-0 select-none pointer-events-none" 
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          
          <div className="text-[11px] text-slate-800 font-extrabold leading-tight" style={{ color: '#1E293B' }}>
            <p className="text-slate-950 font-black text-xs" style={{ color: '#0F172A' }}>Director LihaTech</p>
            <p className="text-slate-500 font-medium italic mt-0.5" style={{ color: '#64748B' }}>Business Development | Client Relations</p>
          </div>
        </div>

        {/* Professional banking credentials box if settings present */}
        {settings.bankName && (
          <div className="text-right text-[10px] text-slate-500 max-w-xs space-y-0.5 border border-slate-100 p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', color: '#64748B' }}>
            <p className="font-extrabold text-slate-800 text-xxs mb-1 uppercase tracking-wider" style={{ color: '#1E293B' }}>Payment Details</p>
            <p><strong>Bank Name:</strong> {settings.bankName}</p>
            <p><strong>Account Holder:</strong> {settings.accountHolder}</p>
            <p><strong>Account Number:</strong> {settings.accountNumber}</p>
            <p><strong>IFSC Code:</strong> {settings.ifscCode}</p>
            {settings.upiId && <p><strong>UPI ID:</strong> {settings.upiId}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderInvoicePage = (chunkItems: typeof invoice.items, pageIndex: number, totalPages: number, isForDownload: boolean) => {
    const companyLines = settings.address.includes('DRS Towers') || settings.address.toLowerCase().includes('toy villa')
      ? ['3rd Floor, Above Toy Villa, DRS Towers,', 'Jawahar Nagar, Kolhapur']
      : formatAddress(settings.address);

    return (
      <div 
        key={pageIndex}
        className={`bg-white text-slate-800 ${isForDownload ? 'p-10' : 'p-10 md:p-12'} font-sans selection:bg-slate-100 flex flex-col justify-between relative`}
        style={{ 
          width: '100%', 
          height: isForDownload ? '1123px' : '297mm',
          boxSizing: 'border-box', 
          backgroundColor: '#FFFFFF', 
          color: '#1E293B'
        }}
      >
        {/* TOP OF PAGE */}
        <div className="w-full">
          {pageIndex === 0 ? (
            <>
              {/* Top Header Row with Logo and Address */}
              <div className="flex justify-between items-start mb-4 w-full">
                <div className="flex flex-col items-start text-left">
                  {settings.logoUrl && (
                    <div className="mb-0 max-w-[280px]">
                      <img 
                        src={settings.logoUrl} 
                        alt="Company Logo" 
                        className="h-20 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
                
                {/* Right side Metadata Dates aligned perfectly to top */}
                <div className="text-right flex flex-col items-end pt-1 text-xs text-slate-700 space-y-1 font-semibold" style={{ color: '#334155' }}>
                  <div>
                    <span className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider mr-2" style={{ color: '#94A3B8' }}>Expiry Date:</span> 
                    <span className="text-slate-900 font-mono text-[12px]" style={{ color: '#0F172A' }}>{formatDate(invoice.dueDate)}</span>
                  </div>
                </div>
              </div>

              {/* Info Grid: From & Bill To side-by-side */}
              <div className="grid grid-cols-2 gap-8 mb-5">
                {/* Sender details (From) */}
                <div className="text-left">
                  <span className="text-[10px] font-black text-slate-400 tracking-widest block uppercase mb-1" style={{ color: '#94A3B8' }}>From</span>
                  <h1 className="text-base font-black text-slate-900 tracking-tight mb-0.5" style={{ color: '#0F172A' }}>
                    {settings.name}
                  </h1>
                  <div className="text-[11px] text-slate-500 leading-relaxed font-semibold space-y-0.5" style={{ color: '#64748B' }}>
                    {companyLines.map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                  <p className="text-slate-800 font-bold mt-2 text-xs tracking-wide" style={{ color: '#1E293B' }}>
                    Date: {formatDate(invoice.invoiceDate)}
                  </p>
                </div>

                {/* Recipient details (Bill To) */}
                <div className="text-left">
                  <span className="text-[10px] font-black text-slate-400 tracking-widest block uppercase mb-1" style={{ color: '#94A3B8' }}>Bill To</span>
                  <h3 className="text-base font-black text-slate-950 mb-0.5" style={{ color: '#020617' }}>{invoice.clientName}</h3>
                  {invoice.clientCompanyName && (
                    <p className="text-xs font-extrabold text-slate-800 mb-0.5" style={{ color: '#1E293B' }}>{invoice.clientCompanyName}</p>
                  )}
                  <div className="text-[11px] text-slate-500 leading-relaxed space-y-0.5" style={{ color: '#64748B' }}>
                    {formatAddress(invoice.clientAddress).map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                  {invoice.clientGst && (
                    <p className="text-[11px] text-slate-400 font-mono mt-1" style={{ color: '#94A3B8' }}>
                      <strong className="text-slate-500">GSTIN:</strong> {invoice.clientGst}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Simple, elegant header on subsequent pages */
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-5 text-left" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-center space-x-2">
                {settings.logoUrl && (
                  <img 
                    src={settings.logoUrl} 
                    alt="Logo" 
                    className="h-6 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="text-[10px] font-black text-slate-900 tracking-tight uppercase" style={{ color: '#0F172A' }}>
                  {settings.name} — Invoice {invoice.invoiceNumber}
                </span>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                Page {pageIndex + 1} of {totalPages}
              </span>
            </div>
          )}

          {/* Crisp Black Grid Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-5" style={{ borderColor: '#CBD5E1' }}>
            <table className="w-full table-fixed text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-300" style={{ backgroundColor: '#000000', color: '#FFFFFF', borderColor: '#CBD5E1' }}>
                  <th className="py-2 px-4 w-12 text-center border-r border-slate-300" style={{ borderColor: '#CBD5E1', verticalAlign: 'middle', lineHeight: '1.2' }}>#</th>
                  <th className="py-2 px-4 border-r border-slate-300" style={{ borderColor: '#CBD5E1', verticalAlign: 'middle', lineHeight: '1.2' }}>Description</th>
                  {invoice.invoiceType !== 'course' && (
                    <th className="py-2 px-4 text-center w-36 border-r border-slate-300" style={{ borderColor: '#CBD5E1', verticalAlign: 'middle', lineHeight: '1.2' }}>Working Hours</th>
                  )}
                  <th className="py-2 px-4 text-right w-40" style={{ verticalAlign: 'middle', lineHeight: '1.2' }}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300" style={{ borderColor: '#CBD5E1' }}>
                {/* Project Group Header (Only on page 1) */}
                {pageIndex === 0 && invoice.projectName && (
                  <tr className="bg-slate-50 font-black text-slate-950 text-xs border-b border-slate-300 text-left" style={{ backgroundColor: '#F8FAFC', color: '#0F172A', borderColor: '#CBD5E1' }}>
                    <td className="py-1.5 px-4 border-r border-slate-300 text-center font-extrabold" style={{ borderColor: '#CBD5E1' }}>—</td>
                    <td colSpan={invoice.invoiceType === 'course' ? 2 : 3} className="py-1.5 px-4 font-black uppercase tracking-wide text-[11px]" style={{ color: '#0F172A' }}>
                      {invoice.projectName}
                    </td>
                  </tr>
                )}

                {/* Items loop */}
                {chunkItems.map((item, itemIdx) => {
                  const globalIdx = pageIndex * 6 + itemIdx;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/20 text-slate-800" style={{ color: '#1E293B' }}>
                      <td className="py-2 px-4 text-center text-slate-700 font-black border-r border-slate-300 font-mono text-xs" style={{ borderColor: '#CBD5E1', color: '#334155', verticalAlign: 'middle', lineHeight: '1.2' }}>{globalIdx + 1}</td>
                      <td className="py-2 px-4 border-r border-slate-300 align-top" style={{ borderColor: '#CBD5E1' }}>
                        <p className="font-extrabold text-slate-950 text-xs" style={{ color: '#0F172A' }}>{item.serviceName}</p>
                        {item.description && renderDescription(item.description)}
                      </td>
                      {invoice.invoiceType !== 'course' && (
                        <td className="py-2 px-4 text-center text-slate-800 font-bold border-r border-slate-300 font-mono text-xs" style={{ borderColor: '#CBD5E1', color: '#1E293B', verticalAlign: 'middle', lineHeight: '1.2' }}>
                          {item.qty}
                        </td>
                      )}
                      <td className="py-2 px-4 text-right font-bold text-slate-950 font-mono text-xs" style={{ color: '#0F172A', verticalAlign: 'middle', lineHeight: '1.2' }}>
                        {formatCurrencySymbol(invoice.currency)}{item.amount.toLocaleString(invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row - ONLY on the last page */}
                {pageIndex === totalPages - 1 && (
                  <>
                    {/* Sub Total Calculation */}
                    <tr className="bg-white border-t border-slate-300 font-extrabold text-slate-900" style={{ backgroundColor: '#FFFFFF', color: '#0F172A', borderColor: '#CBD5E1' }}>
                      <td colSpan={invoice.invoiceType === 'course' ? 2 : 3} className="py-2 px-4 text-right border-r border-slate-300 text-[11px] font-black uppercase tracking-wider" style={{ borderColor: '#CBD5E1' }}>
                        Sub Total
                      </td>
                      <td className="py-2 px-4 text-right font-black text-slate-950 font-mono text-xs" style={{ color: '#0F172A' }}>
                        {formatCurrencySymbol(invoice.currency)}{invoice.subtotal.toLocaleString(invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    </tr>

                    {/* Optional Discount row */}
                    {invoice.discount > 0 && (
                      <tr className="bg-white border-t border-slate-300 font-semibold text-slate-600" style={{ backgroundColor: '#FFFFFF', color: '#475569', borderColor: '#CBD5E1' }}>
                        <td colSpan={invoice.invoiceType === 'course' ? 2 : 3} className="py-2 px-4 text-right border-r border-slate-300 text-xxs font-extrabold uppercase tracking-wider" style={{ borderColor: '#CBD5E1' }}>
                          Discount
                        </td>
                        <td className="py-2 px-4 text-right font-bold text-slate-600 font-mono text-xxs" style={{ color: '#475569' }}>
                          -{formatCurrencySymbol(invoice.currency)}{invoice.discount.toLocaleString(invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    )}

                    {/* Optional GST row */}
                    {invoice.gstAmount > 0 && (
                      <tr className="bg-white border-t border-slate-300 font-semibold text-slate-600" style={{ backgroundColor: '#FFFFFF', color: '#475569', borderColor: '#CBD5E1' }}>
                        <td colSpan={invoice.invoiceType === 'course' ? 2 : 3} className="py-2 px-4 text-right border-r border-slate-300 text-xxs font-extrabold uppercase tracking-wider" style={{ borderColor: '#CBD5E1' }}>
                          GST @ {invoice.gstPercent}%
                        </td>
                        <td className="py-2 px-4 text-right font-bold text-slate-700 font-mono text-xxs" style={{ color: '#334155' }}>
                          {formatCurrencySymbol(invoice.currency)}{invoice.gstAmount.toLocaleString(invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    )}

                    {/* Final Total Amount */}
                    <tr className="bg-slate-50 font-black text-slate-950 border-t-2 border-slate-450" style={{ backgroundColor: '#F8FAFC', color: '#0F172A', borderColor: '#CBD5E1' }}>
                      <td colSpan={invoice.invoiceType === 'course' ? 2 : 3} className="py-3 px-4 text-right border-r border-slate-300 text-[11px] font-black uppercase tracking-widest" style={{ borderColor: '#CBD5E1' }}>
                        Total
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-950 font-mono text-sm" style={{ color: '#0F172A' }}>
                        {formatCurrencySymbol(invoice.currency)}{invoice.totalAmount.toLocaleString(invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Amount in Words (only on last page) */}
          {pageIndex === totalPages - 1 && (
            <div className="mb-4 text-left">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1" style={{ color: '#94A3B8' }}>Amount in Words</span>
              <p className="text-slate-800 font-black italic text-xs leading-relaxed" style={{ color: '#1E293B' }}>
                {invoice.amountInWords || amountToWords(invoice.totalAmount, invoice.currency)}
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM OF PAGE */}
        <div className="w-full">
          {renderInvoiceFooter(isForDownload)}
          {totalPages > 1 && (
            <div className="flex justify-between items-center border-t border-slate-200 pt-2.5 w-full text-left text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-3" style={{ borderColor: '#E2E8F0', color: '#94A3B8' }}>
              <span>Invoice {invoice.invoiceNumber}</span>
              <span>Page {pageIndex + 1} of {totalPages}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderInvoiceDocument = (isForDownload: boolean = false) => {
    const itemChunks = invoice.items.length > 0 ? chunk(invoice.items, 6) : [[]];
    const totalPages = itemChunks.length;

    return (
      <div className={`w-full ${isForDownload ? '' : 'flex flex-col space-y-6 bg-slate-50 dark:bg-slate-900'}`}>
        {itemChunks.map((chunkItems, index) => (
          <div key={index} className={isForDownload ? '' : 'shadow-lg border border-slate-200 dark:border-slate-800'}>
            {renderInvoicePage(chunkItems, index, totalPages, isForDownload)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-6 max-w-4xl mx-auto p-2">
      {/* Sticky Top Controls */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-2 rounded-xl">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Invoice {invoice.invoiceNumber}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                To: {invoice.clientName} ({invoice.clientCompanyName || 'N/A'})
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPDF}
              disabled={exporting}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>{exporting ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
            
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium text-xs rounded-xl transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}


      {/* Invoice Document Box */}
      <div className="overflow-y-auto max-h-[75vh] rounded-2xl border border-blue-100 dark:border-sky-900 shadow-xl bg-blue-50 dark:bg-sky-950 p-4 md:p-6 flex justify-center scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-sky-800">
        <div 
          style={{ 
            width: '100%',
            maxWidth: '210mm',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          {/* Real Printable Invoice Canvas (Screen-facing rendering) */}
          <div 
            ref={invoiceRef}
            id="invoice-print-area"
            className="bg-white text-slate-800 transition-all duration-300 shadow-md rounded-lg"
            style={{ 
              width: '210mm', 
              minHeight: `${297 * pageCount}mm`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              boxSizing: 'border-box',
              marginBottom: `calc(-297mm * ${pageCount} * ${1 - zoom / 100})`
            }}
          >
            {renderInvoiceDocument(false)}
          </div>
        </div>
      </div>
 
      {/* Hidden Fixed-Size Off-screen Canvas for PERFECT High-Quality PDF Downloads (No viewport clipping) */}
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
        <div 
          ref={offscreenInvoiceRef} 
          className="bg-white text-slate-800" 
          style={{ 
            width: '794px', 
            minHeight: `${1123 * pageCount}px`, 
            boxSizing: 'border-box' 
          }}
        >
          {renderInvoiceDocument(true)}
        </div>
      </div>
    </div>
  );
}
