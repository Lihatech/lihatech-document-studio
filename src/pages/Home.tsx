import React from 'react';
import { 
  FileText, 
  Award, 
  PlusCircle, 
  FolderOpen,
  Settings,
  Mail,
  Receipt
} from 'lucide-react';

interface HomeProps {
  navigate: (path: string) => void;
}

export default function Home({ navigate }: HomeProps) {
  return (
    <div className="space-y-12 animate-fade-in py-8 max-w-6xl mx-auto" id="home-dashboard">
      
      {/* Title & Subtitle Header Block */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/15">
          LihaTech Document Generator
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white font-sans mt-2">
          LihaTech Document Generator
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
          The ultimate multi-document creation suite. Generate professional invoices, certificates, letter templates, and payslips effortlessly.
        </p>
      </div>

      {/* Four Premium Service Workspace Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        
        {/* CARD 1: INVOICE GENERATOR */}
        <div 
          className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all duration-350 flex flex-col justify-between"
          id="invoice-generator-card"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-tr-3xl pointer-events-none" />
          
          <div className="p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="bg-emerald-500/10 text-[#0F766E] dark:text-emerald-400 p-4 rounded-2xl">
                <FileText className="h-7 w-7" />
              </div>
              <span className="text-[10px] font-extrabold text-[#0F766E] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/10 font-mono">
                Invoice Suite
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Invoice Generator
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Create and track professional GST-compliant invoices for websites, software development, consultancies, and digital services.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/invoice/new')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Generate New</span>
            </button>
            <button
              onClick={() => navigate('/invoice/old')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-755 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span>View Records</span>
            </button>
          </div>
        </div>

        {/* CARD 2: CERTIFICATE GENERATOR */}
        <div 
          className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all duration-350 flex flex-col justify-between"
          id="certificate-generator-card"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-tr-3xl pointer-events-none" />
          
          <div className="p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="bg-amber-500/10 text-[#6D1F2A] dark:text-amber-500 p-4 rounded-2xl">
                <Award className="h-7 w-7" />
              </div>
              <span className="text-[10px] font-extrabold text-[#6D1F2A] dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full uppercase tracking-widest border border-amber-500/10 font-mono">
                Certify Suite
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Certificate Generator
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Issue premium certificate models for program completions, workshops, internships, and educational achievements.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/certificate/new')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#6D1F2A] hover:bg-[#5E1B24] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Generate New</span>
            </button>
            <button
              onClick={() => navigate('/certificate/old')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-755 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span>View Records</span>
            </button>
          </div>
        </div>

        {/* CARD 3: LETTER GENERATOR */}
        <div 
          className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all duration-350 flex flex-col justify-between"
          id="letter-generator-card"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-tr-3xl pointer-events-none" />
          
          <div className="p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 p-4 rounded-2xl">
                <Mail className="h-7 w-7" />
              </div>
              <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-500/10 font-mono">
                HR Letters
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Letter Generator
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Draft Internship Offer Letters, Job Offer Letters, Experience Certificates, and Relieving Letters on official company letterheads.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/letter/new')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Generate New</span>
            </button>
            <button
              onClick={() => navigate('/letter/old')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-755 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span>View Records</span>
            </button>
          </div>
        </div>

        {/* CARD 4: PAYSLIP GENERATOR */}
        <div 
          className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all duration-350 flex flex-col justify-between"
          id="payslip-generator-card"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-tr-3xl pointer-events-none" />
          
          <div className="p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="bg-teal-500/10 text-teal-700 dark:text-teal-400 p-4 rounded-2xl">
                <Receipt className="h-7 w-7" />
              </div>
              <span className="text-[10px] font-extrabold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-full uppercase tracking-widest border border-teal-500/10 font-mono">
                Payroll
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Payslip Generator
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Formulate official monthly employee payslips with automatic tax, PF, HRA, allowance, and net salary calculations.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/payslip/new')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Generate New</span>
            </button>
            <button
              onClick={() => navigate('/payslip/old')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-755 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span>View Records</span>
            </button>
          </div>
        </div>

      </div>

      {/* Settings Navigation Board */}
      <div className="p-6 bg-slate-100/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Corporate Preferences</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Configure corporate branding assets, bank options, signatory and stamps.</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors shadow-xs"
        >
          <Settings className="h-4 w-4" />
          <span>General Settings</span>
        </button>
      </div>

    </div>
  );
}

