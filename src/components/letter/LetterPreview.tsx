import { parseAnnualCompensation } from '../../utils/compensation';
import React, { useRef, useState, useEffect } from 'react';
import { 
  Download, 
  Printer, 
  X,
  Mail,
  Check
} from 'lucide-react';
import { Letter, CompanySettings } from '../../types';
import { saveAs } from 'file-saver';
import { pdf } from '@react-pdf/renderer';
import OfferLetterPDF from './OfferLetterPDF';
import companyWatermark from '../../../only_logo-removebg-preview.png';

interface LetterPreviewProps {
  letter: Letter;
  settings: CompanySettings;
  onClose?: () => void;
  showActions?: boolean;
}

const A4_WIDTH = 800;
const A4_HEIGHT = 1130;
const PREVIEW_PADDING = 48;

export default function LetterPreview({ letter, settings, onClose, showActions = true }: LetterPreviewProps) {
  const numPages = letter.letterType === 'Internship Offer' ? 2 : (letter.letterType === 'Job Offer' ? 4 : 1);
  const totalHeightWithSpacers = A4_HEIGHT * numPages + (numPages - 1) * 32;
  
  const getCandidateLocation = () => {
    if (letter.collegeName && letter.collegeName.trim()) {
      const lines = letter.collegeName.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const commaParts = lastLine.split(',');
        if (commaParts.length > 0) {
          const candidateCity = commaParts[0].trim();
          if (candidateCity && !/^\d+$/.test(candidateCity)) {
            return candidateCity;
          }
        }
        return lastLine;
      }
    }
    return '';
  };

  const getPrefixedName = (name: string) => {
    if (!name) return '';
    return name;
  };

  const getPronouns = (name: string) => {
    if (!name) {
      return {
        subject: 'he/she',
        object: 'him/her',
        possessive: 'his/her',
        possessiveAdjective: 'his/her'
      };
    }
    const lowercase = name.toLowerCase();
    if (lowercase.startsWith('ms.') || lowercase.startsWith('mrs.') || lowercase.startsWith('miss.')) {
      return {
        subject: 'she',
        object: 'her',
        possessive: 'her',
        possessiveAdjective: 'her'
      };
    }
    return {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      possessiveAdjective: 'his'
    };
  };

  const letterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenLetterRef = useRef<HTMLDivElement>(null);
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

      // Inline/embedded: scale based on width only
      const availableWidth = containerWidth - padding;
      const finalScale = availableWidth / A4_WIDTH;
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
    try {
      setExporting(true);
      
      // Compile dynamic vector PDF
      const blob = await pdf(<OfferLetterPDF letter={letter} settings={settings} />).toBlob();
      
      const docType = letter.letterType === 'Job Offer' ? 'Job_Offer' : letter.letterType.replace(/\s+/g, '_');
      const safeCandidateName = letter.candidateName.replace(/\s+/g, '_');
      const fileName = `LihaTech_${docType}_${safeCandidateName}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setExporting(false);
    }
  };

  const renderLetterContent = () => {
    const referenceId = letter.referenceNo || `LT/HR/${new Date(letter.startDate || letter.issueDate || Date.now()).getFullYear()}/${letter.id.slice(-4).toUpperCase()}`;

    if (letter.letterType === 'Internship Offer') {
      return (
        <div className="flex flex-col gap-0" style={{ width: '800px', height: 'auto', boxSizing: 'border-box' }}>
          {/* PAGE 1 */}
          <div 
            className="bg-white text-black pt-12 pb-8 px-16 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
            style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
          >
            {/* Subtle Watermark Logo in center background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.3] select-none z-0">
              <img 
                src={companyWatermark} 
                alt="Watermark Logo" 
                className="w-[560px] h-[560px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                {/* Elegant Header with Logo on Left, Details on Right */}
                <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4 mb-4 w-full">
                  <div>
                    {settings.logoUrl ? (
                      <img 
                        src={settings.logoUrl} 
                        alt="LihaTech Logo" 
                        className="h-20 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex items-center space-x-2 text-indigo-900">
                        <span className="text-2xl font-black tracking-tight">{settings.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[13.5px] text-black space-y-1 max-w-[360px] pr-2 font-semibold">
                    <p className="font-extrabold text-black text-[16px]">{settings.name}</p>
                    {formatAddress(settings.address).map((line, idx) => (
                      <p key={idx} className="leading-relaxed">{line}</p>
                    ))}
                    <p>Email: {settings.email}</p>
                    <p>Web: {settings.website}</p>
                  </div>
                </div>

                {/* Document Meta Section */}
                <div className="flex justify-between items-start text-[15.5px] font-semibold text-[#1e293b] mt-4 mb-4">
                  <div className="text-left font-mono">
                    <span className="text-[#64748b] font-medium">Ref No: </span>
                    <span className="text-black font-extrabold">{referenceId}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#64748b] font-medium">Date: </span>
                    <span className="text-black font-extrabold">{formatDate(letter.issueDate)}</span>
                  </div>
                </div>

                 {/* Address to Candidate directly vs College */}
                {letter.addressTo === 'candidate' ? (
                  <div className="text-left text-[18px] text-black font-semibold space-y-0.5 mt-2 mb-4">
                    <p className="font-extrabold text-[#1e293b] uppercase text-[13.5px] tracking-wider mb-1">To,</p>
                    <p className="font-black text-black">{letter.candidateName},</p>
                    {letter.collegeName && (
                      <p className="font-bold text-slate-800">{letter.collegeName}</p>
                    )}
                    <p className="font-bold text-slate-800">{letter.location || ''}</p>
                  </div>
                ) : (
                  <div className="text-left text-[18px] text-black font-semibold space-y-0.5 mt-2 mb-4">
                    <p className="font-extrabold text-[#1e293b] uppercase text-[13.5px] tracking-wider mb-1">To,</p>
                    <p className="font-bold text-slate-800">The Director/Principal,</p>
                    <p className="font-black text-black">{letter.collegeName || ''}</p>
                    <p className="font-bold text-slate-800">{letter.location || ''}</p>
                  </div>
                )}

                {/* Subject / Title */}
                <div className="text-center my-2">
                  <h1 className="text-[21px] font-black uppercase tracking-wider text-black border-b-2 border-[#94a3b8] pb-1 inline-block">
                    Internship Offer Letter
                  </h1>
                </div>

                {/* Salutation */}
                <div className="text-left text-[18px] text-black font-semibold space-y-4 mt-4">
                  {letter.addressTo === 'candidate' ? (
                    <p className="font-black text-black">Dear {letter.candidateName},</p>
                  ) : (
                    <p className="font-black text-black">Respected Sir/Madam,</p>
                  )}

                  {/* Body Paragraphs */}
                  <div className="leading-relaxed text-black font-semibold space-y-3.5 text-justify text-[16px]">
                    {letter.addressTo === 'candidate' ? (
                      <p>
                        We are pleased to extend an offer for position <strong className="text-black font-black">{letter.designation || ''}</strong> to you{letter.collegeName ? ` from ${letter.collegeName}` : ''}. This internship is an excellent opportunity for you to gain hands-on experience in these rapidly growing fields, enhancing your academic learning with practical industry exposure.
                      </p>
                    ) : (
                      <p>
                        We are pleased to extend an offer for position <strong className="text-black font-black">{letter.designation || ''}</strong> to <strong className="text-black font-black">{letter.candidateName}</strong> from your esteemed institution. This internship is an excellent opportunity for him/her to gain hands-on experience in these rapidly growing fields, enhancing their academic learning with practical industry exposure.
                      </p>
                    )}

                    {/* Bullet Info */}
                    <div className="space-y-1 text-black mt-2">
                      <p className="font-extrabold text-black text-[18px]">Internship Details:</p>
                      <ul className="pl-6 space-y-1 font-semibold text-black text-[16px] list-none">
                        <li className="flex items-center gap-2">
                          <span className="text-lg leading-none">•</span>
                          <span>Position: <strong className="font-black text-black">{letter.designation || ''}</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-lg leading-none">•</span>
                          <span>Start Date: <strong className="font-black text-black">{formatDate(letter.startDate)}</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-lg leading-none">•</span>
                          <span>Duration: <strong className="font-black text-black">{letter.duration || ''}</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-lg leading-none">•</span>
                          <span>Location: <strong className="font-black text-black">{letter.location || ''}</strong></span>
                        </li>
                      </ul>
                    </div>

                    <p className="pt-2">
                      We believe this internship will provide a valuable learning experience, bridging the gap between theoretical knowledge and practical application.
                    </p>
                    <p>
                      {letter.addressTo === 'candidate' 
                        ? "We look forward to a rewarding and successful association with you." 
                        : "Thank you for your attention and support."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Stamp and Signature Block */}
              <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mt-6 border-t border-slate-100 pt-6 w-full text-left" style={{ borderColor: '#F1F5F9' }}>
                {/* Authentic overlapping signature & stamp block */}
                <div className="flex flex-col items-start text-left">
                  <div className="relative flex items-center mb-1" style={{ height: '95px', width: '275px' }}>
                    {settings.signatureUrl && (
                      <img 
                        src={settings.signatureUrl} 
                        alt="Director Signature" 
                        className="object-contain z-10 select-none pointer-events-none absolute left-0" 
                        style={{ height: '90px', width: '185px', top: '2px' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {settings.stampUrl && (
                      <img 
                        src={settings.stampUrl} 
                        alt="Authorized Stamp" 
                        className="object-contain absolute opacity-85 z-0 select-none pointer-events-none" 
                        style={{ height: '115px', width: '115px', left: '115px', top: '-8px' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  
                  <div className="text-[11px] text-slate-800 font-extrabold leading-tight" style={{ color: '#1E293B' }}>
                    <p className="text-slate-950 font-black text-xs" style={{ color: '#0F172A' }}>{settings.directorDesignation}</p>
                    <p className="text-slate-500 font-medium italic mt-0.5" style={{ color: '#64748B' }}>Business Development | Client Relations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PAGE BREAK SPACER */}
          <div className="no-print h-8 w-full bg-transparent"></div>

          {/* PAGE 2 */}
          <div 
            className="bg-white text-black pt-12 pb-8 px-16 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
            style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
          >
            {/* Subtle Watermark Logo in center background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.3] select-none z-0">
              <img 
                src={companyWatermark} 
                alt="Watermark Logo" 
                className="w-[560px] h-[560px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4 flex-1 flex flex-col justify-start">
                <div>
                  {/* Header Title */}
                  <div className="text-center my-2">
                    <h2 className="text-[21px] font-black uppercase tracking-wider text-black border-b-2 border-[#94a3b8] pb-1 inline-block">
                      Terms and Conditions
                    </h2>
                  </div>

                  {/* Terms Content */}
                  <div className="text-[15px] text-black font-semibold space-y-3.5 text-justify mt-6 leading-relaxed">
                    {letter.noStipend ? (
                      <>
                        <p>
                          <strong className="text-black font-extrabold">Probation Period:</strong> The initial probation period will be <strong className="text-black font-black">{letter.probation || ''}</strong>.
                        </p>
                        <p>
                          This internship is with <strong className="text-black font-black">No-Stipend</strong>.
                        </p>
                        <p>
                          Once the intern completes their degree, the company <strong className="text-black font-black">reserves the right to convert the internship into an on-roll position</strong> with <strong className="text-black font-black">{settings.name}</strong>, subject to performance and organizational requirements.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">Rights Reserved:</strong> All rights related to the candidate’s <strong className="text-black font-black">candidature and internship</strong> are strictly reserved with the company.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">Leave Policy:</strong> The candidate shall <strong className="text-black font-black">not take leave without prior written approval</strong> from the company.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">Notice Period:</strong> In case the candidate wishes to <strong className="text-black font-black">discontinue, switch jobs, or leave the internship</strong>, they must serve a <strong className="text-black font-black">Notice Period (NP) of {letter.noticePeriod || ''}</strong> as per company policy.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong className="text-black font-extrabold">1. Probation Period:</strong> The initial probation period will be <strong className="text-black font-black">{letter.probation || ''}</strong>.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">2. Confirmation:</strong> Based on a performance assessment, you will be moved to an <strong className="text-black font-black">on-roll position</strong> upon successful completion of the probation period. [Provided that you must complete your degree].
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">3. Stipend:</strong> During the probation period, if the candidate’s performance is found to be good and commendable, they will be eligible for a stipend of <strong className="text-black font-black">{letter.stipend || '₹12,500 per month'}</strong>.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">4. Conversion:</strong> Once the intern completes their degree, the company reserves the right to convert the internship into an <strong className="text-black font-black">on-roll position with {settings.name}</strong>, subject to performance and organizational requirements.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">5. Rights Reserved:</strong> All rights related to the candidate’s candidature and internship are strictly reserved with the company.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">6. Leave Policy:</strong> The candidate shall <strong className="text-black font-black">not take leave without prior written approval</strong> from the company.
                        </p>
                        <p>
                          <strong className="text-black font-extrabold">7. Notice Period:</strong> In case the candidate wishes to discontinue, switch jobs, or leave the internship, they must serve a <strong className="text-black font-black">Notice Period (NP) of {letter.noticePeriod || ''}</strong> as per company policy.
                        </p>
                      </>
                    )}

                    {/* Acknowledgement Block */}
                    <div className="mt-4">
                      <p className="font-extrabold text-black mb-1 text-[16px] uppercase tracking-wider">Acknowledgement</p>
                      <p className="text-[13.5px] leading-relaxed text-slate-800 font-semibold text-justify">
                        I, the employee/intern, acknowledge and understand the terms and conditions contained in this agreement, and I was given a copy of the intended agreement and given a reasonable opportunity to seek independent advice before I entered into it. I was not induced to enter into this agreement by any oppressive means, undue influence or duress by the Company.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Acknowledgement Signatures Block */}
                <div className="grid grid-cols-2 gap-8 mt-12 pt-4 border-t border-[#f1f5f9] text-[16px] font-semibold text-black">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[#64748b] min-w-[70px]">Name:</span>
                      <span className="border-b border-dashed border-slate-400 flex-1 h-5 block text-black font-extrabold text-[15px]">{letter.candidateName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#64748b] min-w-[70px]">Signature:</span>
                      <span className="border-b border-dashed border-slate-400 flex-1 h-5 block"></span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[#64748b] min-w-[50px]">Date:</span>
                      <span className="border-b border-dashed border-slate-400 flex-1 h-5 block text-black font-extrabold text-[15px]">{formatDate(letter.issueDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#64748b] min-w-[50px]">Place:</span>
                      <span className="border-b border-dashed border-slate-400 flex-1 h-5 block text-black font-extrabold text-[15px]">{letter.location || ''}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer details in fine print */}
              <div className="text-center text-[12px] text-[#94a3b8] font-medium border-t border-[#f1f5f9] pt-2 mt-4">
                This is a computer-generated document on official letterhead of {settings.name}. 
                All contents are confidential and property of {settings.name} Solutions Private Limited.
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (letter.letterType === 'Job Offer') {


      const formatRupees = (val: number) => {
        return '₹' + Math.round(val).toLocaleString('en-IN');
      };

      const annualCTC = parseAnnualCompensation(letter.stipend || '');
      const monthlyCTC = Math.round(annualCTC / 12);
      
      let employerPF = annualCTC >= 250000 ? 1800 : 0;
      let employerESIC = (monthlyCTC <= 21000) ? Math.round(monthlyCTC * 0.0325) : 0;
      let gratuityProvision = Math.round((monthlyCTC - employerPF) * 0.0481);
      let grossFixedEarnings = monthlyCTC - employerPF - employerESIC - gratuityProvision;
      
      let basicPay = Math.round(grossFixedEarnings * 0.50);
      let hra = Math.round(basicPay * 0.40);
      let specialAllowance = grossFixedEarnings - basicPay - hra;
      let otherAllowance = 0;

      if (letter.customSalaryEnabled) {
        hra = (letter.customHraMonthly !== undefined && !isNaN(Number(letter.customHraMonthly))) ? Number(letter.customHraMonthly) : 0;
        specialAllowance = (letter.customSpecialMonthly !== undefined && !isNaN(Number(letter.customSpecialMonthly))) ? Number(letter.customSpecialMonthly) : 0;
        otherAllowance = (letter.customOtherMonthly !== undefined && !isNaN(Number(letter.customOtherMonthly))) ? Number(letter.customOtherMonthly) : 0;
        employerPF = (letter.customEmployerPFMonthly !== undefined && !isNaN(Number(letter.customEmployerPFMonthly))) ? Number(letter.customEmployerPFMonthly) : 0;
        employerESIC = (letter.customEmployerESICMonthly !== undefined && !isNaN(Number(letter.customEmployerESICMonthly))) ? Number(letter.customEmployerESICMonthly) : 0;
        gratuityProvision = (letter.customOtherBenefitsMonthly !== undefined && !isNaN(Number(letter.customOtherBenefitsMonthly))) ? Number(letter.customOtherBenefitsMonthly) : 0;
        
        basicPay = Math.max(0, monthlyCTC - (hra + specialAllowance + otherAllowance + employerPF + employerESIC + gratuityProvision));
        grossFixedEarnings = basicPay + hra + specialAllowance + otherAllowance;
      }

      const calcMonthlyCTC = letter.customSalaryEnabled 
        ? (grossFixedEarnings + employerPF + employerESIC + gratuityProvision)
        : monthlyCTC;
      const calcAnnualCTC = letter.customSalaryEnabled
        ? (calcMonthlyCTC * 12)
        : annualCTC;

      const renderCandidateAddress = () => {
        if (letter.collegeName && letter.collegeName.trim()) {
          const lines = letter.collegeName.split('\n').map(s => s.trim()).filter(Boolean);
          return (
            <div className="space-y-0.5 text-black font-semibold text-[14px]">
              <p className="font-extrabold text-black">{letter.candidateName}</p>
              {lines.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-0.5 text-slate-400 italic text-[14px]">
            <p className="font-extrabold text-black not-italic">{letter.candidateName}</p>
            <p>[Address Line 1]</p>
            <p>[Address Line 2]</p>
            <p>[City, State – PIN Code]</p>
          </div>
        );
      };

      return (
        <div className="flex flex-col gap-0" style={{ width: '800px', height: 'auto', boxSizing: 'border-box' }}>
          {/* PAGE 1 */}
          <div 
            className="bg-white text-black pt-8 pb-6 px-12 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
            style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
          >
            {/* Subtle Watermark Logo in center background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.25] select-none z-0">
              <img 
                src={companyWatermark} 
                alt="Watermark Logo" 
                className="w-[560px] h-[560px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between text-[14px] leading-relaxed text-justify text-black font-semibold">
              <div>
                {/* Elegant Header with Logo on Left, Details on Right */}
                <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4 mb-4 w-full">
                  <div>
                    {settings.logoUrl ? (
                      <img 
                        src={settings.logoUrl} 
                        alt="LihaTech Logo" 
                        className="h-16 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex items-center space-x-2 text-indigo-900">
                        <span className="text-xl font-black tracking-tight">{settings.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[13.5px] text-black space-y-0.5 max-w-[360px] pr-2">
                    <p className="font-extrabold text-black text-[15px] uppercase tracking-wide">{settings.name}</p>
                    {formatAddress(settings.address).map((line, idx) => (
                      <p key={idx} className="font-bold">{line}</p>
                    ))}
                    <p className="font-bold">Email: {settings.email} | Web: {settings.website}</p>
                  </div>
                </div>

                {/* Document Meta Section */}
                <div className="flex justify-between items-start text-[15px] font-bold text-black mb-6">
                  <div className="font-mono">
                    <span className="text-slate-700 font-semibold">Ref No: </span>
                    <span className="text-black font-black">{referenceId}</span>
                  </div>
                  <div>
                    <span className="text-slate-700 font-semibold">Date: </span>
                    <span className="text-black font-black">{formatDate(letter.issueDate)}</span>
                  </div>
                </div>

                {/* Candidate Address Block */}
                <div className="mb-6">
                  {renderCandidateAddress()}
                </div>

                {/* Subject Title */}
                <div className="text-center mb-6">
                  <h1 className="text-[20px] font-black uppercase tracking-widest text-black border-b-2 border-slate-400 pb-1.5 inline-block">
                    Offer of Employment
                  </h1>
                </div>

                {/* Letter Body */}
                <div className="space-y-4 font-bold text-black text-[14.5px] leading-relaxed">
                  <p className="font-black text-black text-[15.5px]">Dear {letter.candidateName},</p>
                  
                  <p className="font-black text-[15.5px] text-black uppercase tracking-wide">
                    Welcome to LihaTech.
                  </p>
                  
                  <p>
                    With reference to your application and subsequent discussions, we are pleased to offer you the position of <strong className="text-black font-black">“{letter.designation}”</strong> at LihaTech, subject to the terms and conditions mentioned in this letter.
                  </p>
                  
                  <p>
                    We look forward to your joining on or before <strong className="text-black font-black">{formatDate(letter.startDate)}</strong>. Your employment will be effective from your date of joining.
                  </p>
                  
                  <p>
                    You will be based at our <strong className="text-black font-black">{letter.location || ''}</strong>.
                  </p>

                  <p>
                    Your annual Cost to Company will be <strong className="text-black font-black">{formatRupees(annualCTC)}</strong>, as detailed in <strong className="text-black font-black">Annexure I</strong>.
                  </p>

                  <p>
                    Please sign and return a copy of this letter as confirmation of your acceptance.
                  </p>

                  <p className="font-black text-black text-[14.5px]">
                    We are pleased to welcome you to LihaTech and look forward to a successful and mutually rewarding association.
                  </p>
                </div>
              </div>

              {/* Page Footer */}
              <div className="text-center text-[12px] text-slate-600 font-bold border-t border-slate-300 pt-1.5 flex justify-between">
                <span>Page 1 of {numPages}</span>
                <span>LihaTech - Employment Offer Letter</span>
              </div>
            </div>
          </div>

          {/* PAGE BREAK SPACER */}
          <div className="no-print h-8 w-full bg-transparent"></div>

          {/* PAGE 2 */}
          <div 
            className="bg-white text-black pt-8 pb-6 px-12 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
            style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
          >
            {/* Subtle Watermark Logo in center background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.25] select-none z-0">
              <img 
                src={companyWatermark} 
                alt="Watermark Logo" 
                className="w-[560px] h-[560px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between text-[13.5px] leading-relaxed text-justify text-black font-semibold">
              <div>
                {/* Simplified Header */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-1 mb-2">
                  <span className="font-extrabold uppercase text-[12.5px] tracking-wider text-black">{settings.name}</span>
                  <span className="text-[11.5px] text-slate-700 font-bold">Ref: {referenceId}</span>
                </div>

                <div className="text-center mb-2">
                  <h2 className="text-[15px] font-black uppercase tracking-wider text-black border-b border-slate-300 pb-0.5 inline-block">
                    Terms and Conditions of Employment
                  </h2>
                </div>

                <div className="space-y-1.5 text-black">
                  <p>
                    <strong className="text-black font-extrabold">1. Working Hours:</strong> Your normal working hours will be from <strong className="text-black font-black">{letter.workingHours || ''}</strong>, from <strong className="text-black font-black">{letter.workingDays || ''}</strong>. Depending on project, training or client requirements, you may occasionally be required to work beyond normal working hours.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">2. Probation Period:</strong> You will be on probation for a period of <strong className="text-black font-black">{letter.probation || ''}</strong> from your date of joining. Your confirmation will be based on satisfactory performance, conduct and attendance and will be communicated to you in writing. The probation period may be extended if additional performance evaluation is required.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">3. Salary and Benefits:</strong> Your annual Cost to Company will be <strong className="text-black font-black">{formatRupees(annualCTC)}</strong>. The detailed salary structure is provided in Annexure I. Your salary will be subject to statutory deductions, including Professional Tax, Provident Fund, ESIC and Income Tax, wherever applicable.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">4. Leave:</strong> You will be eligible for leave and holidays according to LihaTech’s leave policy and applicable law. All planned leave must be approved in advance by your reporting manager.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">5. Duties and Responsibilities:</strong> You will perform the duties related to your position and any other reasonable responsibilities assigned by the Company. You are expected to perform your duties honestly, professionally and in the best interests of LihaTech and its clients.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">6. Place of Work:</strong> Your initial place of work will be <strong className="text-black font-black">{letter.location || ''}</strong>. Depending on business or project requirements, you may be assigned to another project, department, client location, remote working arrangement or office location.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">7. Confidentiality:</strong> You must maintain confidentiality regarding all non-public information relating to LihaTech, its clients, students, employees and business partners. This includes source code, project documents, AI workflows, datasets, course material, client information, passwords, API keys, pricing and business plans. Confidential information must not be copied, shared, published or used for any unauthorised purpose during or after your employment.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">8. Intellectual Property:</strong> All software, source code, designs, documents, training material, presentations, AI agents, prompts, workflows, datasets and other work created by you during your employment for LihaTech or its clients will belong to LihaTech or the concerned client, as applicable.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">9. Outside Employment:</strong> You must not undertake any employment, freelancing, consultancy, training assignment or business activity that conflicts with your duties at LihaTech without prior written approval.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">10. Company Property:</strong> All laptops, documents, identity cards, accounts, software access, credentials and other property provided by LihaTech or its clients must be used only for official work. All Company and client property must be returned at the time of resignation, termination or whenever requested.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">11. Professional Conduct:</strong> You are expected to maintain professional behaviour and comply with the Company’s policies relating to attendance, workplace conduct, information security, prevention of harassment and client interaction.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">12. Background Verification:</strong> This offer is subject to verification of the information and documents provided by you. If any information or document is found to be materially false or misleading, the Company may withdraw this offer or take appropriate disciplinary action.
                  </p>
                </div>
              </div>

              {/* Page Footer */}
              <div className="text-center text-[12px] text-slate-600 font-bold border-t border-slate-300 pt-1 flex justify-between">
                <span>Page 2 of {numPages}</span>
                <span>LihaTech - Employment Offer Letter</span>
              </div>
            </div>
          </div>

          {/* PAGE BREAK SPACER */}
          <div className="no-print h-8 w-full bg-transparent"></div>

          {/* PAGE 3 */}
          <div 
            className="bg-white text-black pt-8 pb-6 px-12 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
            style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
          >
            {/* Subtle Watermark Logo in center background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.25] select-none z-0">
              <img 
                src={companyWatermark} 
                alt="Watermark Logo" 
                className="w-[560px] h-[560px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between text-[13.5px] leading-relaxed text-justify text-black font-semibold">
              <div>
                {/* Simplified Header */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 mb-2">
                  <span className="font-extrabold uppercase text-[12.5px] tracking-wider text-black">{settings.name}</span>
                  <span className="text-[11.5px] text-slate-700 font-bold">Ref: {referenceId}</span>
                </div>

                <div className="space-y-1.5 text-black text-[13px] leading-relaxed">
                  <p>
                    <strong className="text-black font-extrabold">13. Notice Period:</strong> During probation, either party may terminate the employment by giving <strong className="text-black font-black">15 days’ written notice</strong> or salary in lieu of notice. After confirmation, either party may terminate the employment by giving <strong className="text-black font-black">{letter.noticePeriod || ''}’ written notice</strong> or salary in lieu of notice, subject to Company approval and applicable law. The Company may terminate employment in cases of serious misconduct, fraud, data theft, breach of confidentiality, harassment, document falsification or wilful damage to Company or client property.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">14. Resignation and Handover:</strong> At the time of resignation or termination, you must complete the required notice period, project handover, knowledge transfer, return of assets and clearance formalities. Final settlement and employment documents will be processed after completion of the exit formalities.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">15. Company Policies:</strong> You will be governed by LihaTech’s rules, regulations and policies as amended from time to time. Any major change relating to your designation, fixed salary or employment type will be communicated to you in writing.
                  </p>
                  <p>
                    <strong className="text-black font-extrabold">16. Governing Law:</strong> Your employment will be governed by the applicable laws of India. Subject to the jurisdiction of the appropriate labour authorities and tribunals, courts at <strong className="text-black font-black">Kolhapur, Maharashtra</strong> will have jurisdiction over matters arising from your employment.
                  </p>
                </div>

                {/* Annexure I Details */}
                <div className="mt-3 border-t border-slate-300 pt-2">
                  <h2 className="text-[14.5px] font-black uppercase tracking-wider text-black mb-1 text-center">
                    Annexure I — Compensation Details
                  </h2>
                  <div className="grid grid-cols-2 text-[12.5px] text-black font-black mb-1 px-1">
                    <div>Employee Name: <span className="text-black font-extrabold">{letter.candidateName}</span></div>
                    <div className="text-right">Designation: <span className="text-black font-extrabold">{letter.designation}</span></div>
                  </div>

                  <table className="w-full text-left text-[12px] border border-collapse border-slate-300 mb-1">
                    <thead>
                      <tr className="bg-slate-100 font-extrabold text-black">
                        <th className="border border-slate-300 p-0.5 pl-1.5 w-[60%]">Particulars</th>
                        <th className="border border-slate-300 p-0.5 text-right pr-1.5 w-[20%]">Monthly</th>
                        <th className="border border-slate-300 p-0.5 text-right pr-1.5 w-[20%]">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Basic Salary</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(basicPay)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(basicPay * 12)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">House Rent Allowance</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(hra)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(hra * 12)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Special Allowance</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(specialAllowance)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(specialAllowance * 12)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Other Allowance</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(otherAllowance)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(otherAllowance * 12)}</td>
                      </tr>
                      <tr className="bg-slate-50 font-extrabold text-slate-950">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Gross Salary</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(grossFixedEarnings)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(grossFixedEarnings * 12)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Employer PF Contribution</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(employerPF)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(employerPF * 12)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Employer ESIC Contribution</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(employerESIC)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(employerESIC * 12)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 font-bold text-black">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Other Benefits</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(gratuityProvision)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(gratuityProvision * 12)}</td>
                      </tr>
                      <tr className="bg-indigo-50 font-black text-indigo-950 text-[12.5px]">
                        <td className="border border-slate-300 p-0.5 pl-1.5">Total CTC</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(calcMonthlyCTC)}</td>
                        <td className="border border-slate-300 p-0.5 text-right pr-1.5">{formatRupees(calcAnnualCTC)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[11.5px] italic text-slate-700 font-bold text-center leading-normal mt-1">
                    Salary will be subject to statutory deductions and other deductions permitted under applicable law.
                  </p>
                </div>

                {/* Acceptance Title & Text */}
                <div className="border-t border-slate-300 pt-2 mt-2">
                  <h3 className="text-[14px] font-black uppercase tracking-wider text-black mb-0.5">Acceptance</h3>
                  <p className="text-[13px] leading-relaxed text-black font-bold">
                    I, <strong className="text-black">{letter.candidateName}</strong>, confirm that I have read, understood and accepted the terms and conditions stated in this Offer of Employment.
                  </p>
                </div>
              </div>

              {/* Dynamic Bottom Row Signatures */}
              <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mt-6 border-t border-slate-100 pt-6 w-full text-left" style={{ borderColor: '#F1F5F9' }}>
                {/* Employee Sign-off */}
                <div className="text-left space-y-1 text-[13px] text-black font-normal" style={{ minWidth: '220px' }}>
                  <p className="font-extrabold">Employee Signature: <span className="font-normal">__________________</span></p>
                  <p className="font-extrabold">Employee Name: <span className="font-normal">{letter.candidateName}</span></p>
                  <p className="font-extrabold">Place: <span className="font-normal">{getCandidateLocation() || letter.location || ''}</span></p>
                </div>

                {/* Authentic overlapping signature & stamp block */}
                <div className="flex flex-col items-start text-left" style={{ marginRight: '40px' }}>
                  <div className="relative flex items-center mb-1" style={{ height: '95px', width: '275px' }}>
                    {settings.signatureUrl && (
                      <img 
                        src={settings.signatureUrl} 
                        alt="Director Signature" 
                        className="object-contain z-10 select-none pointer-events-none absolute left-0" 
                        style={{ height: '90px', width: '185px', top: '2px' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {settings.stampUrl && (
                      <img 
                        src={settings.stampUrl} 
                        alt="Authorized Stamp" 
                        className="object-contain absolute opacity-85 z-0 select-none pointer-events-none" 
                        style={{ height: '115px', width: '115px', left: '115px', top: '-8px' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  
                  <div className="text-[11px] text-slate-800 font-extrabold leading-tight" style={{ color: '#1E293B' }}>
                    <p className="text-slate-950 font-black text-xs" style={{ color: '#0F172A' }}>{settings.directorDesignation}</p>
                    <p className="text-slate-500 font-medium italic mt-0.5" style={{ color: '#64748B' }}>Business Operations</p>
                  </div>
                </div>
              </div>

              {/* Page Footer */}
              <div className="text-center text-[12px] text-slate-600 font-bold border-t border-slate-300 pt-1 flex justify-between">
                <span>Page 3 of {numPages}</span>
                <span>LihaTech - Employment Offer Letter</span>
              </div>
            </div>
          </div>

          {/* PAGE BREAK SPACER */}
          <div className="no-print h-8 w-full bg-transparent"></div>

          {/* PAGE 4 - Annexure II */}
          <div 
            className="bg-white text-black pt-8 pb-6 px-12 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
            style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
          >
            {/* Subtle Watermark Logo in center background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.25] select-none z-0">
              <img 
                src={companyWatermark} 
                alt="Watermark Logo" 
                className="w-[560px] h-[560px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between text-[13.5px] leading-relaxed text-justify text-black font-semibold">
              <div>
                {/* Simplified Header */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 mb-2">
                  <span className="font-extrabold uppercase text-[12.5px] tracking-wider text-black">{settings.name}</span>
                  <span className="text-[11.5px] text-slate-700 font-bold">Ref: {referenceId}</span>
                </div>

                <div className="text-center mb-3">
                  <h2 className="text-[14.5px] font-black uppercase tracking-wider text-black border-b border-slate-300 pb-0.5 inline-block">
                    Annexure II — Required Documents
                  </h2>
                </div>

                <p className="text-[12.5px] font-bold text-black text-justify mb-3">
                  Every employee as per the terms of Offer of Employment is requested to submit the following documents to our HR Personnel at the time of your reporting to duty at {settings.name || 'HPC consulting'} Office.
                </p>

                <div className="space-y-3.5 text-black text-[12px] leading-relaxed">
                  <div>
                    <h3 className="font-extrabold text-black uppercase tracking-wider mb-1 text-[12.5px]">1. Personal Data:</h3>
                    <ul className="grid grid-cols-1 gap-1 pl-4">
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">a.</span>
                        <span>Passport copy (along with all used pages)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">b.</span>
                        <span>3 Photographs (Passport size)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">c.</span>
                        <span>Aadhar card copy</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">d.</span>
                        <span>PAN Card Copy</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">e.</span>
                        <span>Proof of present and permanent address (photocopy)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">f.</span>
                        <span>Mark Sheets and Certificate of Class X & Class XII</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">g.</span>
                        <span>Graduation Certificate (all mark memos and certificates)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">h.</span>
                        <span>Post-Graduation Certificate (all mark memos and certificates)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">i.</span>
                        <span>Mark sheets and Certificates of Diploma(s)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">j.</span>
                        <span>Mark sheets and Certificates of any training(s) attended</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">k.</span>
                        <span>Any other additional diplomas/certificates (Mark-sheets)</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-black uppercase tracking-wider mb-1 text-[12.5px]">2. Previous Employment Record:</h3>
                    <ul className="grid grid-cols-1 gap-1 pl-4">
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">a.</span>
                        <span>Relieving Letter and Service / Experience Certificate from all previous employer(s)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">b.</span>
                        <span>Copy of the resignation acceptance letter</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">c.</span>
                        <span>Salary slips/ certificate from all employers (min last 3 months)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">d.</span>
                        <span>Form 16/ TDS certificate from all ex-employers (as required)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-black text-black min-w-[15px]">e.</span>
                        <span>Form 12B /Provisional Form 16 for the current financial year</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bottom signatures block matching page 3 exactly */}
              <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mt-6 border-t border-slate-100 pt-6 w-full text-left" style={{ borderColor: '#F1F5F9' }}>
                {/* Employee Sign-off */}
                <div className="text-left space-y-1 text-[13px] text-black font-normal" style={{ minWidth: '220px' }}>
                  <p className="font-extrabold">Candidate Signature: <span className="font-normal">__________________</span></p>
                  <p className="font-extrabold">Candidate Name: <span className="font-normal">{letter.candidateName}</span></p>
                  <p className="font-extrabold">Place: <span className="font-normal">{getCandidateLocation() || letter.location || ''}</span></p>
                </div>

                {/* Authentic overlapping signature & stamp block */}
                <div className="flex flex-col items-start text-left" style={{ marginRight: '40px' }}>
                  <div className="relative flex items-center mb-1" style={{ height: '95px', width: '275px' }}>
                    {settings.signatureUrl && (
                      <img 
                        src={settings.signatureUrl} 
                        alt="Director Signature" 
                        className="object-contain z-10 select-none pointer-events-none absolute left-0" 
                        style={{ height: '90px', width: '185px', top: '2px' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {settings.stampUrl && (
                      <img 
                        src={settings.stampUrl} 
                        alt="Authorized Stamp" 
                        className="object-contain absolute opacity-85 z-0 select-none pointer-events-none" 
                        style={{ height: '115px', width: '115px', left: '115px', top: '-8px' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  
                  <div className="text-[11px] text-slate-800 font-extrabold leading-tight" style={{ color: '#1E293B' }}>
                    <p className="text-slate-950 font-black text-xs" style={{ color: '#0F172A' }}>{settings.directorDesignation}</p>
                    <p className="text-slate-500 font-medium italic mt-0.5" style={{ color: '#64748B' }}>Business Operations</p>
                  </div>
                </div>
              </div>

              {/* Page Footer */}
              <div className="text-center text-[12px] text-slate-600 font-bold border-t border-slate-300 pt-1 flex justify-between">
                <span>Page 4 of {numPages}</span>
                <span>{settings.name} - Employment Offer Letter</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (letter.letterType === 'Experience Certificate') {
      const pronouns = getPronouns(letter.candidateName);
      return (
        <div 
          className="bg-white text-black p-16 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
          style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
        >
          {/* Subtle Watermark Logo in center background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.3] select-none z-0">
            <img 
              src={companyWatermark} 
              alt="Watermark Logo" 
              className="w-[560px] h-[560px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="relative z-10 space-y-6 flex-1 flex flex-col justify-between">
            <div>
              {/* Elegant Header with Logo on Left, Details on Right */}
              <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-8 w-full">
                <div>
                  {settings.logoUrl ? (
                    <img 
                      src={settings.logoUrl} 
                      alt="Company Logo" 
                      className="h-24 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 text-indigo-900">
                      <span className="text-2xl font-black tracking-tight">{settings.name}</span>
                    </div>
                  )}
                </div>
                <div className="text-right text-[14px] text-black space-y-1 max-w-[360px] pr-2">
                  <p className="font-extrabold text-black text-[16px]">{settings.name}</p>
                  {formatAddress(settings.address).map((line, idx) => (
                    <p key={idx} className="leading-relaxed font-bold">{line}</p>
                  ))}
                  <p className="font-bold">Email: {settings.email}</p>
                  <p className="font-bold">Web: {settings.website}</p>
                </div>
              </div>

              {/* Date Block on Top Right */}
              <div className="text-right text-[15px] font-bold text-black mb-8">
                Date: {formatDate(letter.issueDate)}
              </div>

              {/* Candidate Info Block on Left */}
              <div className="text-left text-[15.5px] text-black space-y-1 mb-8 leading-normal">
                <p className="font-black text-[17px] text-black">{getPrefixedName(letter.candidateName)}</p>
                <p className="font-bold text-slate-900">Emp ID: <span className="text-black font-black">{referenceId}</span></p>
                <p className="font-bold text-slate-900">Designation: <span className="text-black font-black">{letter.designation}</span></p>
              </div>

              {/* Subject / Title centered and underlined */}
              <div className="text-center my-8">
                <h2 className="text-[20px] font-black underline uppercase tracking-widest text-black inline-block" style={{ textUnderlineOffset: '6px' }}>
                  TO WHOMSOEVER IT MAY CONCERN
                </h2>
              </div>

              {/* Dynamic Narrative Letter Body matching the image */}
              <div className="leading-relaxed text-black font-medium space-y-6 text-justify text-[16px]">
                <p>
                  This is to certify that <strong className="text-black font-black">{getPrefixedName(letter.candidateName)}</strong>, Emp ID: <strong className="text-black font-black">{referenceId}</strong> has been associated with our organization as <strong className="text-black font-black">{letter.designation}</strong> for the period from <strong className="text-black font-black">{formatDate(letter.startDate)}</strong> to <strong className="text-black font-black">{letter.endDate ? formatDate(letter.endDate) : 'present'}</strong>.
                </p>
                <p>
                  We found <strong className="text-black font-black">{getPrefixedName(letter.candidateName)}</strong> is effective in discharging responsibilities assigned to {pronouns.object}.
                </p>
                <p>
                  During {pronouns.possessiveAdjective} tenure with us for the above period, we found {pronouns.object} efficient, {pronouns.possessiveAdjective} character and conduct were good.
                </p>
                <p>
                  We wish {pronouns.object} success in {pronouns.possessiveAdjective} future assignments.
                </p>
              </div>
            </div>

            {/* Bottom Stamp and Signature Block styled exactly like the image */}
            <div className="space-y-6 text-left text-[15px] pt-4">
              <div>
                <p className="font-medium text-black">Yours Sincerely,</p>
                <p className="font-extrabold text-black uppercase mt-1">For {settings.name || 'LANCE SOFT ENGINEERING PRIVATE LIMITED'},</p>
              </div>
              
              {/* Authentic overlapping signature & stamp block */}
              <div className="relative flex items-center" style={{ height: '95px', width: '275px' }}>
                {settings.signatureUrl && (
                  <img 
                    src={settings.signatureUrl} 
                    alt="Director Signature" 
                    className="object-contain z-10 select-none pointer-events-none absolute left-0" 
                    style={{ height: '90px', width: '185px', top: '2px' }}
                    referrerPolicy="no-referrer"
                  />
                )}
                {settings.stampUrl && (
                  <img 
                    src={settings.stampUrl} 
                    alt="Authorized Stamp" 
                    className="object-contain absolute opacity-85 z-0 select-none pointer-events-none" 
                    style={{ height: '115px', width: '115px', left: '115px', top: '-8px' }}
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              
              <div className="text-[14.5px] text-black leading-tight">
                <p className="font-black text-black">{letter.authorizedSignatory}</p>
                <p className="text-slate-600 font-bold mt-0.5">{settings.directorDesignation || 'HR Manager – Human Resources'}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (letter.letterType === 'Relieving Letter') {
      return (
        <div 
          className="bg-white text-black p-16 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
          style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
        >
          {/* Subtle Watermark Logo in center background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.3] select-none z-0">
            <img 
              src={companyWatermark} 
              alt="Watermark Logo" 
              className="w-[560px] h-[560px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="relative z-10 space-y-6 flex-1 flex flex-col justify-between">
            <div>
              {/* Elegant Header with Logo on Left, Details on Right */}
              <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-8 w-full">
                <div>
                  {settings.logoUrl ? (
                    <img 
                      src={settings.logoUrl} 
                      alt="Company Logo" 
                      className="h-24 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 text-indigo-900">
                      <span className="text-2xl font-black tracking-tight">{settings.name}</span>
                    </div>
                  )}
                </div>
                <div className="text-right text-[14px] text-black space-y-1 max-w-[360px] pr-2">
                  <p className="font-extrabold text-black text-[16px]">{settings.name}</p>
                  {formatAddress(settings.address).map((line, idx) => (
                    <p key={idx} className="leading-relaxed font-bold">{line}</p>
                  ))}
                  <p className="font-bold">Email: {settings.email}</p>
                  <p className="font-bold">Web: {settings.website}</p>
                </div>
              </div>

              {/* Date Block on Top Right */}
              <div className="text-right text-[15px] font-bold text-black mb-8">
                Date: {formatDate(letter.issueDate)}
              </div>

              {/* Candidate Info Block on Left */}
              <div className="text-left text-[15.5px] text-black space-y-1 mb-8 leading-normal">
                <p className="font-black text-[17px] text-black">{getPrefixedName(letter.candidateName)}</p>
                <p className="font-bold text-slate-900">Emp ID: <span className="text-black font-black">{referenceId}</span></p>
                <p className="font-bold text-slate-900">Designation: <span className="text-black font-black">{letter.designation}</span></p>
              </div>

              {/* Subject / Title centered and underlined */}
              <div className="text-center my-8">
                <h2 className="text-[17px] font-black underline uppercase tracking-wider text-black inline-block" style={{ textUnderlineOffset: '6px' }}>
                  Sub: Relieving Letter
                </h2>
              </div>

              {/* Salutation */}
              <div className="text-left mb-6 text-[16px] font-bold text-black">
                Dear {letter.candidateName},
              </div>

              {/* Dynamic Narrative Letter Body matching the image */}
              <div className="leading-relaxed text-black font-medium space-y-6 text-justify text-[16px]">
                <p>
                  This has reference to your resignation letter. This is to inform you that your resignation has been accepted and you are relieved from the services of <strong className="text-black font-black">{settings.name}</strong> on the close of working hours on <strong className="text-black font-black">{letter.endDate ? formatDate(letter.endDate) : formatDate(letter.issueDate)}</strong>.
                </p>
                <p>
                  You are requested to deposit the company Id and any other company property entrusted to you during your employment with us.
                </p>
                <p>
                  We wish you all success in your future endeavors.
                </p>
              </div>
            </div>

            {/* Bottom Stamp and Signature Block styled exactly like the image */}
            <div className="space-y-6 text-left text-[15px] pt-4">
              <div>
                <p className="font-medium text-black">Yours Sincerely,</p>
                <p className="font-extrabold text-black uppercase mt-1">For {settings.name || 'LANCE SOFT ENGINEERING PRIVATE LIMITED'},</p>
              </div>
              
              {/* Authentic overlapping signature & stamp block */}
              <div className="relative flex items-center" style={{ height: '95px', width: '275px' }}>
                {settings.signatureUrl && (
                  <img 
                    src={settings.signatureUrl} 
                    alt="Director Signature" 
                    className="object-contain z-10 select-none pointer-events-none absolute left-0" 
                    style={{ height: '90px', width: '185px', top: '2px' }}
                    referrerPolicy="no-referrer"
                  />
                )}
                {settings.stampUrl && (
                  <img 
                    src={settings.stampUrl} 
                    alt="Authorized Stamp" 
                    className="object-contain absolute opacity-85 z-0 select-none pointer-events-none" 
                    style={{ height: '115px', width: '115px', left: '115px', top: '-8px' }}
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              
              <div className="text-[14.5px] text-black leading-tight">
                <p className="font-black text-black">{letter.authorizedSignatory}</p>
                <p className="text-slate-600 font-bold mt-0.5">{settings.directorDesignation || 'HR Manager – Human Resources'}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default 1-page layout for Job Offer and Experience Certificate
    return (
      <div 
        className="bg-white text-black p-16 mx-auto font-sans relative flex flex-col justify-between shadow-2xl rounded-sm border border-slate-200/50 print:shadow-none print:rounded-none print:border-none"
        style={{ width: '800px', height: '1130px', boxSizing: 'border-box' }}
      >
        {/* Subtle Watermark Logo in center background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.3] select-none z-0">
          <img 
            src={companyWatermark} 
            alt="Watermark Logo" 
            className="w-[560px] h-[560px] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-10 space-y-8 flex-1 flex flex-col justify-between">
          <div>
            {/* Elegant Header with Logo on Left, Details on Right */}
            <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-8 w-full">
              <div>
                {settings.logoUrl ? (
                  <img 
                    src={settings.logoUrl} 
                    alt="LihaTech Logo" 
                    className="h-24 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex items-center space-x-2 text-indigo-900">
                    <span className="text-2xl font-black tracking-tight">{settings.name}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-[14px] text-black space-y-1 max-w-[360px] pr-2">
                <p className="font-extrabold text-black text-[16px]">{settings.name}</p>
                {formatAddress(settings.address).map((line, idx) => (
                  <p key={idx} className="leading-relaxed font-bold">{line}</p>
                ))}
                <p className="font-bold">Email: {settings.email}</p>
                <p className="font-bold">Web: {settings.website}</p>
              </div>
            </div>

            {/* Document Meta Section */}
            <div className="flex justify-between items-start text-[16px] font-semibold text-[#1e293b] mt-6 mb-8">
              <div className="text-left font-mono">
                <span className="text-[#64748b] font-medium">Ref No: </span>
                <span className="text-black font-extrabold">{referenceId}</span>
              </div>
              <div className="text-right">
                <span className="text-[#64748b] font-medium">Date: </span>
                <span className="text-black font-extrabold">{formatDate(letter.issueDate)}</span>
              </div>
            </div>

            {/* Subject / Title */}
            <div className="text-center my-8">
              <h1 className="text-3xl font-black uppercase tracking-wider text-black border-b-2 border-[#94a3b8] pb-2 inline-block">
                {letter.letterType}
              </h1>
            </div>

            {/* Salutation */}
            <div className="text-left text-[18px] text-black font-extrabold space-y-6">
              <p className="font-black text-black text-[18px]">TO WHOMSOEVER IT MAY CONCERN</p>

              {/* Dynamic Narrative Letter Body */}
              <div className="leading-relaxed text-black font-semibold space-y-4 text-justify text-[16px]">
                <p>
                  This is to certify that <strong className="text-black font-black">{letter.candidateName}</strong> was employed with <strong className="text-black font-black">{letter.companyName || settings.name}</strong> as a <strong className="text-black font-black">{letter.designation}</strong> in the <strong className="text-black font-black">{letter.department}</strong> department.
                </p>
                <p>
                  The employee served from <strong className="text-black font-black">{formatDate(letter.startDate)}</strong> to <strong className="text-black font-black">{letter.endDate ? formatDate(letter.endDate) : 'present'}</strong>.
                </p>
                <p>
                  <strong className="text-black font-black">Performance & Conduct:</strong> {letter.conductStatement || 'During their tenure, we found them to be highly professional, diligent, and honest. Their dedication to tasks and cooperative conduct were highly appreciated.'}
                </p>
                <p>
                  We appreciate their valuable contributions and service to our organization. We wish them all the success in their future professional endeavors.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Stamp and Signature Block */}
          <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mt-6 border-t border-slate-100 pt-6 w-full text-left" style={{ borderColor: '#F1F5F9' }}>
            {/* Authentic overlapping signature & stamp block */}
            <div className="flex flex-col items-start text-left">
              <div className="relative flex items-center mb-1" style={{ height: '95px', width: '275px' }}>
                {settings.signatureUrl && (
                  <img 
                    src={settings.signatureUrl} 
                    alt="Director Signature" 
                    className="object-contain z-10 select-none pointer-events-none absolute left-0" 
                    style={{ height: '90px', width: '185px', top: '2px' }}
                    referrerPolicy="no-referrer"
                  />
                )}
                {settings.stampUrl && (
                  <img 
                    src={settings.stampUrl} 
                    alt="Authorized Stamp" 
                    className="object-contain absolute opacity-85 z-0 select-none pointer-events-none" 
                    style={{ height: '115px', width: '115px', left: '115px', top: '-8px' }}
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              
              <div className="text-[11px] text-slate-800 font-extrabold leading-tight" style={{ color: '#1E293B' }}>
                <p className="text-slate-950 font-black text-xs" style={{ color: '#0F172A' }}>{settings.directorDesignation}</p>
                <p className="text-slate-500 font-medium italic mt-0.5" style={{ color: '#64748B' }}>Business Development | Client Relations</p>
              </div>
            </div>
          </div>

          {/* Footer details in fine print */}
          <div className="text-center text-[12.5px] text-[#94a3b8] font-medium border-t border-[#f1f5f9] pt-3 mt-8">
            This is a computer-generated document on official letterhead of {settings.name}. 
            All contents are confidential and property of {settings.name} Solutions Private Limited.
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
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
            <Mail className="h-5 w-5 text-indigo-500" />
            <span className="text-xs font-extrabold uppercase tracking-wider">{letter.letterType} Preview</span>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={handleDownloadPDF}
              disabled={exporting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors disabled:opacity-50"
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
        className="overflow-auto rounded-b-2xl bg-slate-100 dark:bg-slate-950 p-6 flex justify-center items-start transition-all duration-300"
        style={showActions ? { flex: 1, minHeight: 0 } : { height: `${totalHeightWithSpacers * scale + PREVIEW_PADDING}px` }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        <div 
          style={{ 
            width: `${A4_WIDTH * scale}px`,
            height: `${totalHeightWithSpacers * scale}px`,
            margin: 'auto',
          }}
          className="flex-shrink-0 transition-all duration-200"
        >
          <div 
            ref={letterRef} 
            className="cursor-default" 
            style={{ 
              width: `${A4_WIDTH}px`,
              height: `${totalHeightWithSpacers}px`,
              boxSizing: 'border-box',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderLetterContent()}
          </div>
        </div>
      </div>

      {/* Off-screen high quality canvas capture node for PDF downloads */}
      <div 
        style={{ 
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '800px',
          height: `${totalHeightWithSpacers}px`,
          overflow: 'hidden',
          zIndex: -9999,
          pointerEvents: 'none'
        }}
      >
        <div ref={offscreenLetterRef}>
          {renderLetterContent()}
        </div>
      </div>

    </div>
  );
}
