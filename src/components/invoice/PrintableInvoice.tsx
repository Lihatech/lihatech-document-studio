import React from 'react';
import { Invoice, CompanySettings } from '../../types';

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface PrintableInvoiceProps {
  invoice: Invoice;
  settings: CompanySettings;
}

export default function PrintableInvoice({ invoice, settings }: PrintableInvoiceProps) {
  const itemChunks = invoice.items.length > 0 ? chunk(invoice.items, 6) : [[]];
  const pageCount = itemChunks.length;

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
    const mid = Math.ceil(parts.length / 2);
    return [parts.slice(0, mid).join(', '), parts.slice(mid).join(', ')];
  };

  const companyLines = settings.address.includes('DRS Towers') || settings.address.toLowerCase().includes('toy villa')
    ? ['3rd Floor, Above Toy Villa, DRS Towers,', 'Jawahar Nagar, Kolhapur']
    : formatAddress(settings.address);

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

  return (
    <div className="bg-white text-slate-800" style={{ width: '794px', minHeight: `${1123 * pageCount}px`, boxSizing: 'border-box' }}>
      {itemChunks.map((chunkItems, pageIndex) => (
        <div 
          key={pageIndex}
          className="bg-white text-slate-800 p-10 font-sans flex flex-col justify-between relative"
          style={{ width: '794px', height: '1123px', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#1E293B' }}
        >
          {/* Header & Details */}
          <div className="w-full">
            {pageIndex === 0 ? (
              <>
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
                  
                  <div className="text-right flex flex-col items-end pt-1 text-xs text-slate-700 space-y-1 font-semibold" style={{ color: '#334155' }}>
                    <div>
                      <span className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider mr-2" style={{ color: '#94A3B8' }}>Expiry Date:</span> 
                      <span className="text-slate-900 font-mono text-[12px]" style={{ color: '#0F172A' }}>{formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-5">
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
              <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-5 text-left" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex items-center space-x-2">
                  {settings.logoUrl && (
                    <img src={settings.logoUrl} alt="Logo" className="h-6 w-auto object-contain" referrerPolicy="no-referrer" />
                  )}
                  <span className="text-[10px] font-black text-slate-900 tracking-tight uppercase" style={{ color: '#0F172A' }}>
                    {settings.name} — Invoice {invoice.invoiceNumber}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                  Page {pageIndex + 1} of {pageCount}
                </span>
              </div>
            )}

            {/* Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-5" style={{ borderColor: '#CBD5E1' }}>
              <table className="w-full table-fixed text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-300" style={{ backgroundColor: '#000000', color: '#FFFFFF', borderColor: '#CBD5E1' }}>
                    <th className="py-2 px-4 w-12 text-center border-r border-slate-300">#</th>
                    <th className="py-2 px-4 border-r border-slate-300">Description</th>
                    {invoice.invoiceType !== 'course' && (
                      <th className="py-2 px-4 text-center w-36 border-r border-slate-300">Working Hours</th>
                    )}
                    <th className="py-2 px-4 text-right w-40">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300" style={{ borderColor: '#CBD5E1' }}>
                  {pageIndex === 0 && invoice.projectName && (
                    <tr className="bg-slate-50 font-black text-slate-950 text-xs border-b border-slate-300 text-left" style={{ backgroundColor: '#F8FAFC', color: '#0F172A', borderColor: '#CBD5E1' }}>
                      <td className="py-1.5 px-4 border-r border-slate-300 text-center font-extrabold">—</td>
                      <td colSpan={invoice.invoiceType === 'course' ? 2 : 3} className="py-1.5 px-4 font-black uppercase tracking-wide text-[11px]">
                        {invoice.projectName}
                      </td>
                    </tr>
                  )}

                  {chunkItems.map((item, itemIdx) => {
                    const globalIdx = pageIndex * 6 + itemIdx;
                    return (
                      <tr key={item.id} className="text-slate-800">
                        <td className="py-2 px-4 text-center text-slate-700 font-black border-r border-slate-300 font-mono text-xs">{globalIdx + 1}</td>
                        <td className="py-2 px-4 border-r border-slate-300 align-top">
                          <p className="font-extrabold text-slate-950 text-xs">{item.serviceName}</p>
                          {item.description && renderDescription(item.description)}
                        </td>
                        {invoice.invoiceType !== 'course' && (
                          <td className="py-2 px-4 text-center text-slate-800 font-bold border-r border-slate-300 font-mono text-xs">
                            {item.qty}
                          </td>
                        )}
                        <td className="py-2 px-4 text-right font-bold text-slate-950 font-mono text-xs">
                          {invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : '₹'}
                          {item.amount.toLocaleString(invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Summary & Footer */}
          <div className="w-full">
            {pageIndex === pageCount - 1 && (
              <div className="flex justify-between items-start gap-6 border-t border-slate-300 pt-4" style={{ borderColor: '#CBD5E1' }}>
                <div className="w-1/2 text-left space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Amount in Words</p>
                  <p className="text-xs font-black text-slate-900 capitalize bg-slate-50 p-2.5 rounded-lg border border-slate-200">{invoice.amountInWords}</p>
                </div>

                <div className="w-1/2 text-right space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : '₹'}{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {invoice.gstAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST ({invoice.gstPercent}%):</span>
                      <span>{invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : '₹'}{invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-950 font-black text-sm border-t border-slate-300 pt-1.5">
                    <span>Total Amount:</span>
                    <span>{invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : '₹'}{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            {pageIndex === pageCount - 1 && (
              <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mt-6 border-t border-slate-100 pt-6 w-full text-left">
                <div className="flex flex-col items-start text-left">
                  <div className="relative h-20 w-56 flex items-center mb-1">
                    {settings.signatureUrl && (
                      <img src={settings.signatureUrl} alt="Signature" className="h-14 w-auto object-contain z-10" referrerPolicy="no-referrer" />
                    )}
                    {settings.stampUrl && (
                      <img src={settings.stampUrl} alt="Stamp" className="h-20 w-20 object-contain absolute left-24 opacity-85 z-0" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-800 font-extrabold leading-tight">
                    <p className="text-slate-950 font-black text-xs">Director LihaTech</p>
                    <p className="text-slate-500 font-medium italic mt-0.5">Business Development | Client Relations</p>
                  </div>
                </div>

                {settings.bankName && (
                  <div className="text-right text-[10px] text-slate-500 max-w-xs space-y-0.5 border border-slate-100 p-3 rounded-xl bg-slate-50">
                    <p className="font-extrabold text-slate-800 text-xxs mb-1 uppercase tracking-wider">Payment Details</p>
                    <p><strong>Bank Name:</strong> {settings.bankName}</p>
                    <p><strong>Account Holder:</strong> {settings.accountHolder}</p>
                    <p><strong>Account Number:</strong> {settings.accountNumber}</p>
                    <p><strong>IFSC Code:</strong> {settings.ifscCode}</p>
                    {settings.upiId && <p><strong>UPI ID:</strong> {settings.upiId}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
