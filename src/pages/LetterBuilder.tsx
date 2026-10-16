import { parseAnnualCompensation } from '../utils/compensation';
import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Mail, 
  Sparkles, 
  FileText,
  Building,
  Calendar,
  DollarSign,
  User,
  Briefcase
} from 'lucide-react';
import { Letter, CompanySettings } from '../types';
import LetterPreview from '../components/letter/LetterPreview';
import type { DocumentRequest } from '../lib/documentRequests';

interface LetterBuilderProps {
  onBack: () => void;
  settings: CompanySettings;
  onSaveLetter: (letter: Letter) => Promise<boolean>;
  editingLetter?: Letter | null;
  requestDraft?: DocumentRequest | null;
  navigate: (path: string) => void;
}

export default function LetterBuilder({
  onBack,
  settings,
  onSaveLetter,
  editingLetter = null,
  requestDraft = null,
  navigate
}: LetterBuilderProps) {
  
  // Selection or Editing State
  const [letterType, setLetterType] = useState<'Internship Offer' | 'Job Offer' | 'Experience Certificate' | 'Relieving Letter' | null>(
    editingLetter ? editingLetter.letterType : null
  );

  // Form Fields State
  const [referenceNo, setReferenceNo] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [companyName, setCompanyName] = useState(settings.name || 'LihaTech Solutions Private Limited');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [authorizedSignatory, setAuthorizedSignatory] = useState(settings.directorName);
  
  // Custom conditional fields
  const [stipend, setStipend] = useState(''); // Stipend or Salary
  const [noStipend, setNoStipend] = useState(false); // No stipend flag for internship offer letters
  const [mode, setMode] = useState('Hybrid'); // Internship mode
  const [reportingInstructions, setReportingInstructions] = useState(''); // Internship reporting info
  const [employmentType, setEmploymentType] = useState('Full-time'); // Job employment type
  const [location, setLocation] = useState(''); // Job office location
  const [conductStatement, setConductStatement] = useState(''); // Experience certificate review statement
  const [collegeName, setCollegeName] = useState(''); // College name for interns
  const [duration, setDuration] = useState(''); // Duration for interns (e.g. "6 months")
  const [addressTo, setAddressTo] = useState<'college' | 'candidate'>('college'); // Add addressTo state

  // Job Offer Candidate Particulars fields
  const [dob, setDob] = useState('');
  const [parentName, setParentName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [uanEsic, setUanEsic] = useState('');
  const [skillCategory, setSkillCategory] = useState('');
  const [reportingTo, setReportingTo] = useState('');
  const [probation, setProbation] = useState('');
  const [workingDays, setWorkingDays] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');

  // Custom Salary Breakdown fields
  const [customSalaryEnabled, setCustomSalaryEnabled] = useState(true);
  const [customBasicMonthly, setCustomBasicMonthly] = useState('');
  const [customHraMonthly, setCustomHraMonthly] = useState('0');
  const [customSpecialMonthly, setCustomSpecialMonthly] = useState('0');
  const [customOtherMonthly, setCustomOtherMonthly] = useState('0');
  const [customEmployerPFMonthly, setCustomEmployerPFMonthly] = useState('0');
  const [customEmployerESICMonthly, setCustomEmployerESICMonthly] = useState('0');
  const [customOtherBenefitsMonthly, setCustomOtherBenefitsMonthly] = useState('0');

  const annualCTC = parseAnnualCompensation(stipend);
  const monthlyCTC = Math.round(annualCTC / 12);
  const calculatedBasicMonthly = Math.max(0, 
    monthlyCTC - (
      (Number(customHraMonthly) || 0) + 
      (Number(customSpecialMonthly) || 0) + 
      (Number(customOtherMonthly) || 0) + 
      (Number(customEmployerPFMonthly) || 0) + 
      (Number(customEmployerESICMonthly) || 0) + 
      (Number(customOtherBenefitsMonthly) || 0)
    )
  );

  // Active Tab for form vs preview (for small screens)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  // Prefill default templates based on selection
  const initializeDefaults = (type: 'Internship Offer' | 'Job Offer' | 'Experience Certificate' | 'Relieving Letter') => {
    setLetterType(type);
    
    const defaults = settings.letterDefaults?.[type] || {};
    setDesignation(defaults.designation || ''); setDepartment(defaults.department || '');
    setStipend(defaults.stipend || ''); setLocation(defaults.location || '');
    setCollegeName(''); setDuration(defaults.duration || '');
    setDob(''); setParentName(''); setAadhaar(''); setUanEsic('');
    setSkillCategory(defaults.skillCategory || '');
    setReportingTo(defaults.reportingTo || ''); setProbation(defaults.probation || '');
    setWorkingDays(defaults.workingDays || ''); setWorkingHours(defaults.workingHours || '');
    setNoticePeriod(defaults.noticePeriod || '');
    setEmploymentType(defaults.employmentType || 'Full-time'); setMode(defaults.mode || 'Hybrid');
    setAuthorizedSignatory(defaults.authorizedSignatory || settings.directorName);
    setReportingInstructions(defaults.reportingInstructions || ''); setConductStatement(defaults.conductStatement || '');
    setStartDate(''); setEndDate(''); setNoStipend(Boolean(defaults.noStipend));
    setCustomSalaryEnabled(true); setCustomBasicMonthly('');
    setCustomHraMonthly('0'); setCustomSpecialMonthly('0'); setCustomOtherMonthly('0');
    setCustomEmployerPFMonthly('0'); setCustomEmployerESICMonthly('0'); setCustomOtherBenefitsMonthly('0');

  };

  // Load editing letter
  useEffect(() => {
    if (editingLetter) {
      setLetterType(editingLetter.letterType);
      setReferenceNo(editingLetter.referenceNo || '');
      setCandidateName(editingLetter.candidateName);
      setDesignation(editingLetter.designation);
      setDepartment(editingLetter.department);
      setStartDate(editingLetter.startDate || '');
      setEndDate(editingLetter.endDate || '');
      setCompanyName(editingLetter.companyName || settings.name);
      setIssueDate(editingLetter.issueDate || '');
      setAuthorizedSignatory(editingLetter.authorizedSignatory || settings.directorName);
      setStipend(editingLetter.stipend || '');
      setNoStipend(editingLetter.noStipend || false);
      setMode(editingLetter.mode || 'Hybrid');
      setReportingInstructions(editingLetter.reportingInstructions || '');
      setEmploymentType(editingLetter.employmentType || 'Full-time');
      setLocation(editingLetter.location || '');
      setConductStatement(editingLetter.conductStatement || '');
      setCollegeName(editingLetter.collegeName || '');
      setDuration(editingLetter.duration || '');
      setAddressTo(editingLetter.addressTo || 'college');
      setDob(editingLetter.dob || '');
      setParentName(editingLetter.parentName || '');
      setAadhaar(editingLetter.aadhaar || '');
      setUanEsic(editingLetter.uanEsic || '');
      setSkillCategory(editingLetter.skillCategory || '');
      setReportingTo(editingLetter.reportingTo || '');
      setProbation(editingLetter.probation || '');
      setWorkingDays(editingLetter.workingDays || '');
      setWorkingHours(editingLetter.workingHours || '');
      setNoticePeriod(editingLetter.noticePeriod || '');
      setCustomSalaryEnabled(editingLetter.customSalaryEnabled !== undefined ? editingLetter.customSalaryEnabled : true);
      setCustomBasicMonthly(editingLetter.customBasicMonthly !== undefined ? String(editingLetter.customBasicMonthly) : '');
      setCustomHraMonthly(editingLetter.customHraMonthly !== undefined ? String(editingLetter.customHraMonthly) : '0');
      setCustomSpecialMonthly(editingLetter.customSpecialMonthly !== undefined ? String(editingLetter.customSpecialMonthly) : '0');
      setCustomOtherMonthly(editingLetter.customOtherMonthly !== undefined ? String(editingLetter.customOtherMonthly) : '0');
      setCustomEmployerPFMonthly(editingLetter.customEmployerPFMonthly !== undefined ? String(editingLetter.customEmployerPFMonthly) : '0');
      setCustomEmployerESICMonthly(editingLetter.customEmployerESICMonthly !== undefined ? String(editingLetter.customEmployerESICMonthly) : '0');
      setCustomOtherBenefitsMonthly(editingLetter.customOtherBenefitsMonthly !== undefined ? String(editingLetter.customOtherBenefitsMonthly) : '0');
    } else if (requestDraft?.kind === 'offer_letter' && requestDraft.offer_type) {
      initializeDefaults(requestDraft.offer_type);
      setCandidateName(requestDraft.candidate_name);
      setDesignation(requestDraft.designation);
      setDepartment(requestDraft.department || requestDraft.student_department || '');
      setStartDate(requestDraft.start_date || '');
      setEndDate(requestDraft.end_date || '');
      setCollegeName(requestDraft.college_name || '');
      setAddressTo(requestDraft.college_name ? 'college' : 'candidate');
      setDuration(requestDraft.start_date && requestDraft.end_date ? `${Math.round((Date.parse(requestDraft.end_date)-Date.parse(requestDraft.start_date))/86400000)+1} days` : '');
    }
  }, [editingLetter, settings, requestDraft]);

  const handleSave = async () => {
    if (!candidateName.trim()) {
      alert('Candidate/Employee Name is required!');
      return;
    }
    if (!designation.trim()) {
      alert('Designation/Role is required!');
      return;
    }
    if (!department.trim()) {
      alert('Department/Domain is required!');
      return;
    }
    if (!letterType) return;
    if (!startDate || !issueDate) { alert('Start date and issue date are required.'); return; }
    if ((letterType === 'Job Offer' || (letterType === 'Internship Offer' && !noStipend)) && !stipend.trim()) {
      alert('Enter the agreed compensation, or select no stipend for an unpaid internship.'); return;
    }

    const savedLetter: Letter = {
      id: editingLetter ? editingLetter.id : crypto.randomUUID(),
      referenceNo: referenceNo.trim() || undefined,
      letterType,
      candidateName,
      designation,
      department,
      startDate,
      endDate: (letterType === 'Internship Offer' || letterType === 'Experience Certificate' || letterType === 'Relieving Letter') ? endDate : undefined,
      companyName,
      issueDate,
      authorizedSignatory,
      stipend: (letterType === 'Internship Offer' || letterType === 'Job Offer') ? stipend : undefined,
      mode: letterType === 'Internship Offer' ? mode : undefined,
      reportingInstructions: letterType === 'Internship Offer' ? reportingInstructions : undefined,
      employmentType: letterType === 'Job Offer' ? employmentType : undefined,
      location: (letterType === 'Job Offer' || letterType === 'Internship Offer') ? location : undefined,
      conductStatement: letterType === 'Experience Certificate' ? conductStatement : undefined,
      collegeName: (letterType === 'Internship Offer' || letterType === 'Job Offer') ? collegeName : undefined,
      duration: letterType === 'Internship Offer' ? duration : undefined,
      addressTo: letterType === 'Internship Offer' ? addressTo : undefined,
      dob: letterType === 'Job Offer' ? dob : undefined,
      parentName: letterType === 'Job Offer' ? parentName : undefined,
      aadhaar: letterType === 'Job Offer' ? aadhaar : undefined,
      uanEsic: letterType === 'Job Offer' ? uanEsic : undefined,
      skillCategory: letterType === 'Job Offer' ? skillCategory : undefined,
      reportingTo: letterType === 'Job Offer' ? reportingTo : undefined,
      probation: (letterType === 'Job Offer' || letterType === 'Internship Offer') ? probation : undefined,
      workingDays: letterType === 'Job Offer' ? workingDays : undefined,
      workingHours: letterType === 'Job Offer' ? workingHours : undefined,
      noticePeriod: (letterType === 'Job Offer' || letterType === 'Internship Offer') ? noticePeriod : undefined,
      customSalaryEnabled: letterType === 'Job Offer' ? true : undefined,
      customBasicMonthly: letterType === 'Job Offer' ? calculatedBasicMonthly : undefined,
      customHraMonthly: letterType === 'Job Offer' ? (Number(customHraMonthly) || 0) : undefined,
      customSpecialMonthly: letterType === 'Job Offer' ? (Number(customSpecialMonthly) || 0) : undefined,
      customOtherMonthly: letterType === 'Job Offer' ? (Number(customOtherMonthly) || 0) : undefined,
      customEmployerPFMonthly: letterType === 'Job Offer' ? (Number(customEmployerPFMonthly) || 0) : undefined,
      customEmployerESICMonthly: letterType === 'Job Offer' ? (Number(customEmployerESICMonthly) || 0) : undefined,
      customOtherBenefitsMonthly: letterType === 'Job Offer' ? (Number(customOtherBenefitsMonthly) || 0) : undefined,
      noStipend: letterType === 'Internship Offer' ? noStipend : undefined,
      createdAt: editingLetter ? editingLetter.createdAt : new Date().toISOString()
    };

    if (!await onSaveLetter(savedLetter)) return;
    navigate('/letter/old');
  };

  // Current temporary letter state for preview
  const currentLetter: Letter = {
    id: editingLetter ? editingLetter.id : 'temp_id',
    referenceNo: referenceNo.trim() || undefined,
    letterType: letterType || 'Internship Offer',
    candidateName: candidateName || '[Candidate Name]',
    designation: designation || '[Designation / Role]',
    department: department || '[Department / Division]',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate,
    companyName: companyName || settings.name,
    issueDate,
    authorizedSignatory,
    stipend,
    mode,
    reportingInstructions,
    employmentType,
    location,
    conductStatement,
    collegeName,
    duration,
    addressTo,
    dob,
    parentName,
    aadhaar,
    uanEsic,
    skillCategory,
    reportingTo,
    probation,
    workingDays,
    workingHours,
    noticePeriod,
    customSalaryEnabled: letterType === 'Job Offer' ? true : undefined,
    customBasicMonthly: letterType === 'Job Offer' ? calculatedBasicMonthly : undefined,
    customHraMonthly: letterType === 'Job Offer' ? (Number(customHraMonthly) || 0) : undefined,
    customSpecialMonthly: letterType === 'Job Offer' ? (Number(customSpecialMonthly) || 0) : undefined,
    customOtherMonthly: letterType === 'Job Offer' ? (Number(customOtherMonthly) || 0) : undefined,
    customEmployerPFMonthly: letterType === 'Job Offer' ? (Number(customEmployerPFMonthly) || 0) : undefined,
    customEmployerESICMonthly: letterType === 'Job Offer' ? (Number(customEmployerESICMonthly) || 0) : undefined,
    customOtherBenefitsMonthly: letterType === 'Job Offer' ? (Number(customOtherBenefitsMonthly) || 0) : undefined,
    noStipend: letterType === 'Internship Offer' ? noStipend : undefined,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="space-y-6 animate-fade-in py-2" id="letter-builder-workspace">
      {requestDraft?.kind === 'offer_letter' && <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950"><strong>Preparing a student request for {requestDraft.candidate_name}.</strong> Complete the official offer details, save and share the letter, then mark the request shared in <button type="button" className="font-bold underline" onClick={() => navigate('/document-requests')}>Document requests</button>.</div>}
      
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Mail className="h-6 w-6 text-indigo-500" />
              <span>{editingLetter ? 'Edit letter' : 'Create letter'}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingLetter ? 'Modify details and regenerate corporate legal letters.' : 'Select a document layout to draft official HR communication.'}
            </p>
          </div>
        </div>

        {letterType && (
          <div className="flex items-center space-x-2">
            {/* View Switching Tabs for Mobile */}
            <div className="flex lg:hidden bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('form')}
                className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors ${activeTab === 'form' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500'}`}
              >
                Form
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors ${activeTab === 'preview' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500'}`}
              >
                Preview
              </button>
            </div>

            <button
              onClick={handleSave}
              className="studio-button studio-button-primary text-sm"
            >
              <Save className="h-4 w-4" />
              <span>Save letter</span>
            </button>
          </div>
        )}
      </div>

      {/* THREE ACTION CARDS SELECTION GRID (Visible when starting new letter and no type is selected yet) */}
      {!letterType && (
        <div className="space-y-6">
          <div className="text-center py-6">
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Choose a letter type</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">Select the document you need, then enter the recipient's details.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Option 1: Internship Offer Letter */}
            <button
              onClick={() => initializeDefaults('Internship Offer')}
              className="group text-left relative overflow-hidden rounded-2xl border-2 border-gray-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none group-hover:scale-110 transition-transform" />
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 p-3 rounded-xl w-fit mb-4">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                Internship Offer Letter
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Draft an official internship offer detailing role duration, hybrid/remote mode, monthly stipends, and mentor instructions.
              </p>
              <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-indigo-600 mt-4">
                Configure Layout &rarr;
              </span>
            </button>

            {/* Option 2: Job Offer Letter */}
            <button
              onClick={() => initializeDefaults('Job Offer')}
              className="group text-left relative overflow-hidden rounded-2xl border-2 border-gray-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none group-hover:scale-110 transition-transform" />
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 p-3 rounded-xl w-fit mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                Job Offer Letter
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Generate official full-time or contract employment offerings with compensation details, office locations, and compliance parameters.
              </p>
              <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-indigo-600 mt-4">
                Configure Layout &rarr;
              </span>
            </button>

            {/* Option 3: Experience Certificate */}
            <button
              onClick={() => initializeDefaults('Experience Certificate')}
              className="group text-left relative overflow-hidden rounded-2xl border-2 border-gray-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none group-hover:scale-110 transition-transform" />
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 p-3 rounded-xl w-fit mb-4">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                Experience Certificate
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Approve work history statements confirming employee working timelines, specific role designations, and corporate conduct praise.
              </p>
              <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-indigo-600 mt-4">
                Configure Layout &rarr;
              </span>
            </button>

            {/* Option 4: Relieving Letter */}
            <button
              onClick={() => initializeDefaults('Relieving Letter')}
              className="group text-left relative overflow-hidden rounded-2xl border-2 border-gray-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none group-hover:scale-110 transition-transform" />
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 p-3 rounded-xl w-fit mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                Relieving Letter
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Draft an official company relieving letter confirming accept of resignation, employee designation, and relieve date.
              </p>
              <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-indigo-600 mt-4">
                Configure Layout &rarr;
              </span>
            </button>

          </div>
        </div>
      )}

      {/* TWO COLUMN INTERACTIVE FORM WORKSPACE */}
      {letterType && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Configuration Input Form */}
          <div className={`lg:col-span-5 space-y-6 ${activeTab === 'form' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document Meta</span>
                <button
                  type="button"
                  onClick={() => {
                    if (editingLetter) {
                      onBack();
                    } else {
                      setLetterType(null);
                    }
                  }}
                  className="text-xxs font-extrabold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest cursor-pointer"
                >
                  Change Layout &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5">
                
                {/* Field: Reference Number / Employee ID */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>Reference No. / Emp ID (Optional)</span>
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400">Default: LT/HR/YYYY/ID</span>
                  </div>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder={`e.g. LT/HR/${new Date().getFullYear()}/001 or EMP-102`}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Leave blank to automatically use the standard company format <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono">LT/HR/{new Date().getFullYear()}/XXXX</code></p>
                </div>

                {/* Field: Candidate Name */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Candidate / Employee Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Shahid Himmat Shaikh"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Field: Designation/Role */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    <span>Designation / Role</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="Associate Software Engineer"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Field: Department */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>Department / Domain</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Engineering"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Fields side by side Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Start Date</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* End date is hidden for Job Offer Letters */}
                  {(letterType === 'Internship Offer' || letterType === 'Experience Certificate' || letterType === 'Relieving Letter') && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>End Date</span>
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* Compensation/Salary Row */}
                {(letterType === 'Internship Offer' || letterType === 'Job Offer') && (
                  <div className="space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                        <span>{letterType === 'Internship Offer' ? 'Stipend Offered' : 'Annual Salary Package'}</span>
                      </label>
                      <input
                        type="text"
                        value={stipend}
                        disabled={letterType === 'Internship Offer' && noStipend}
                        onChange={(e) => setStipend(e.target.value)}
                        placeholder={letterType === 'Internship Offer' ? '₹15,000 / month' : '₹4,50,000 / annum'}
                        className={`w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${(letterType === 'Internship Offer' && noStipend) ? 'opacity-60 bg-slate-50 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    {letterType === 'Internship Offer' && (
                      <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-gray-200 dark:border-slate-800">
                        <input
                          id="no-stipend-toggle"
                          type="checkbox"
                          checked={noStipend}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNoStipend(checked);
                            if (checked) {
                              setStipend('No-Stipend');
                            } else {
                              setStipend('₹12,500 / month');
                            }
                          }}
                          className="h-4.5 w-4.5 rounded-md text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                        />
                        <label htmlFor="no-stipend-toggle" className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer">
                          No-Stipend Internship Format (Changes Page 2 Terms)
                        </label>
                      </div>
                    )}

                    {letterType === 'Job Offer' && (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4" />
                            Compensation Component Breakdown
                          </h4>
                          <p className="text-xs text-slate-500">
                            Adjust components below (Monthly values). The Basic Salary dynamically takes the remaining package value.
                          </p>
                        </div>

                        <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Basic Salary (Monthly ₹) <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">(Auto-Calculated)</span>
                              </label>
                              <div className="w-full px-3 py-2 text-sm rounded-xl border border-dashed border-indigo-200 dark:border-slate-700 bg-indigo-50/20 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black">
                                ₹ {calculatedBasicMonthly.toLocaleString('en-IN')}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">House Rent Allowance (Monthly ₹)</label>
                              <input 
                                type="number"
                                value={customHraMonthly}
                                onChange={(e) => setCustomHraMonthly(e.target.value)}
                                placeholder="e.g. 7500"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Special Allowance (Monthly ₹)</label>
                              <input 
                                type="number"
                                value={customSpecialMonthly}
                                onChange={(e) => setCustomSpecialMonthly(e.target.value)}
                                placeholder="e.g. 10000"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Other Allowance (Monthly ₹)</label>
                              <input 
                                type="number"
                                value={customOtherMonthly}
                                onChange={(e) => setCustomOtherMonthly(e.target.value)}
                                placeholder="e.g. 0"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employer PF (Monthly ₹)</label>
                              <input 
                                type="number"
                                value={customEmployerPFMonthly}
                                onChange={(e) => setCustomEmployerPFMonthly(e.target.value)}
                                placeholder="e.g. 1800"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employer ESIC (Monthly ₹)</label>
                              <input 
                                type="number"
                                value={customEmployerESICMonthly}
                                onChange={(e) => setCustomEmployerESICMonthly(e.target.value)}
                                placeholder="e.g. 0"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Other Benefits / Gratuity Provision (Monthly ₹)</label>
                              <input 
                                type="number"
                                value={customOtherBenefitsMonthly}
                                onChange={(e) => setCustomOtherBenefitsMonthly(e.target.value)}
                                placeholder="e.g. 1500"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                              />
                            </div>
                          </div>

                          {/* Informative real-time totals */}
                          <div className="bg-slate-100 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs flex flex-col gap-1 text-slate-700 dark:text-slate-300">
                            <div className="flex justify-between">
                              <span>Calculated Monthly Gross Salary:</span>
                              <span className="font-extrabold text-slate-900 dark:text-white">
                                ₹{(calculatedBasicMonthly + (Number(customHraMonthly) || 0) + (Number(customSpecialMonthly) || 0) + (Number(customOtherMonthly) || 0)).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-dashed border-slate-300 dark:border-slate-700 font-extrabold text-indigo-600 dark:text-indigo-400">
                              <span>Calculated Monthly Total CTC:</span>
                              <span>
                                ₹{(calculatedBasicMonthly + (Number(customHraMonthly) || 0) + (Number(customSpecialMonthly) || 0) + (Number(customOtherMonthly) || 0) + (Number(customEmployerPFMonthly) || 0) + (Number(customEmployerESICMonthly) || 0) + (Number(customOtherBenefitsMonthly) || 0)).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex justify-between font-extrabold text-indigo-600 dark:text-indigo-400">
                              <span>Calculated Annual Total CTC:</span>
                              <span>
                                ₹{((calculatedBasicMonthly + (Number(customHraMonthly) || 0) + (Number(customSpecialMonthly) || 0) + (Number(customOtherMonthly) || 0) + (Number(customEmployerPFMonthly) || 0) + (Number(customEmployerESICMonthly) || 0) + (Number(customOtherBenefitsMonthly) || 0)) * 12).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional conditional blocks based on types */}
                {letterType === 'Internship Offer' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Internship Mode</label>
                        <select
                          value={mode}
                          onChange={(e) => setMode(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white bg-slate-900 focus:outline-hidden"
                        >
                          <option value="Hybrid">Hybrid</option>
                          <option value="Remote">Remote</option>
                          <option value="Onsite">Onsite</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Issue Date</label>
                        <input
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Address Letter To</label>
                        <select
                          value={addressTo}
                          onChange={(e) => setAddressTo(e.target.value as 'college' | 'candidate')}
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white bg-slate-900 focus:outline-hidden"
                        >
                          <option value="college">College / Institution</option>
                          <option value="candidate">Candidate Directly</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          {addressTo === 'college' ? "Candidate's College Name" : "College Name (Optional)"}
                        </label>
                        <input
                          type="text"
                          value={collegeName}
                          onChange={(e) => setCollegeName(e.target.value)}
                          placeholder="e.g. Bharati Vidyapeeth’s College of Engineering"
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Internship Duration</label>
                        <input
                          type="text"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          placeholder="e.g. 6 months"
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Location / City</label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Kolhapur"
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Probation Period</label>
                        <input
                          type="text"
                          value={probation}
                          onChange={(e) => setProbation(e.target.value)}
                          placeholder="e.g. 90 days"
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Notice Period</label>
                        <input
                          type="text"
                          value={noticePeriod}
                          onChange={(e) => setNoticePeriod(e.target.value)}
                          placeholder="e.g. 30 days"
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Reporting Instructions</label>
                      <textarea
                        value={reportingInstructions}
                        onChange={(e) => setReportingInstructions(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {letterType === 'Job Offer' && (
                  <>
                    <div className="space-y-1.5 text-left text-indigo-900">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Candidate's Address</label>
                      <textarea
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        placeholder="e.g.&#10;Flat 402, Royal Enclave&#10;Nagala Park&#10;Kolhapur, Maharashtra - 416003"
                        rows={3}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Employment Type</label>
                        <select
                          value={employmentType}
                          onChange={(e) => setEmploymentType(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white bg-slate-900 focus:outline-hidden"
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Contract">Contract</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Location</label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Kolhapur Office"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date of Birth</label>
                        <input
                          type="text"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          placeholder="e.g. 15/08/1998"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Father's/Mother's Name</label>
                        <input
                          type="text"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          placeholder="e.g. Himmat Shaikh"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Aadhaar Number (Masked)</label>
                        <input
                          type="text"
                          value={aadhaar}
                          onChange={(e) => setAadhaar(e.target.value)}
                          placeholder="e.g. xxxx-xxxx-1234 or Masked"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">UAN / ESIC Number</label>
                        <input
                          type="text"
                          value={uanEsic}
                          onChange={(e) => setUanEsic(e.target.value)}
                          placeholder="e.g. NA or Number"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Skill Category</label>
                        <input
                          type="text"
                          value={skillCategory}
                          onChange={(e) => setSkillCategory(e.target.value)}
                          placeholder="e.g. Highly Skilled"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Reporting To</label>
                        <input
                          type="text"
                          value={reportingTo}
                          onChange={(e) => setReportingTo(e.target.value)}
                          placeholder="e.g. Director|Business Operations"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Probation Period</label>
                        <input
                          type="text"
                          value={probation}
                          onChange={(e) => setProbation(e.target.value)}
                          placeholder="e.g. 6 months"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Notice Period</label>
                        <input
                          type="text"
                          value={noticePeriod}
                          onChange={(e) => setNoticePeriod(e.target.value)}
                          placeholder="e.g. 45 days"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Working Days</label>
                        <input
                          type="text"
                          value={workingDays}
                          onChange={(e) => setWorkingDays(e.target.value)}
                          placeholder="e.g. 6 days"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Working Hours</label>
                        <input
                          type="text"
                          value={workingHours}
                          onChange={(e) => setWorkingHours(e.target.value)}
                          placeholder="e.g. 9:00 AM - 6:00 PM"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Issue Date</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                      />
                    </div>
                  </>
                )}

                {letterType === 'Experience Certificate' && (
                  <>
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Issue Date</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                      />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Performance & Conduct Review</label>
                      <textarea
                        value={conductStatement}
                        onChange={(e) => setConductStatement(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {letterType === 'Relieving Letter' && (
                  <>
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Issue Date</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                      />
                    </div>
                  </>
                )}

                <div className="border-t border-gray-100 dark:border-slate-800 pt-5">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authorized Signatory</label>
                    <input
                      type="text"
                      value={authorizedSignatory}
                      onChange={(e) => setAuthorizedSignatory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* RIGHT: Letterhead document preview */}
          <div className={`lg:col-span-7 ${activeTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
            <LetterPreview 
              letter={currentLetter}
              settings={settings}
              showActions={false}
            />
          </div>

        </div>
      )}

    </div>
  );
}
