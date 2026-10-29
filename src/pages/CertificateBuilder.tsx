import { confirmAction, showWarning } from '../lib/dialogs';
import SavedOptionSelect from '../components/SavedOptionSelect';
import { getCertificateCategoryOptions } from '../utils/certificateUtils';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Award, 
  Sparkles
} from 'lucide-react';
import { Certificate, CertificateLayout, CertificateLayoutElement, Course, CompanySettings } from '../types';
import { generateCertificateId } from '../utils/idGenerator';
import { 
  getDefaultCompletionText, 
  getCertificateCompletionLine,
  COMPLETION_PRESETS,
  DEFAULT_PRESENTATION_TEXT,
  PRESENTATION_PRESETS,
  LEGACY_DATE_LINE_TEXT,
  getFormattedDateLine,
  CERTIFICATE_TYPE_PRESETS
} from '../utils/certificateUtils';
import CertificatePreview, { CertificateLayoutControls } from '../components/certificate/CertificatePreview';
import type { DocumentRequest } from '../lib/documentRequests';

interface CertificateBuilderProps {
  onBack: () => void;
  courses: Course[];
  existingCertificates: Certificate[];
  settings: CompanySettings;
  onAddCertificateOption: (kind: 'category' | 'partner', name: string) => Promise<string>;
  onSaveCertificate: (cert: Certificate) => Promise<boolean>;
  editingCertificate?: Certificate | null;
  requestDraft?: DocumentRequest | null;
  reviewMode?: boolean;
  onSaveCourse: (course: Course) => Promise<boolean>;
  navigate: (path: string) => void;
}

export default function CertificateBuilder({
  onBack,
  courses,
  existingCertificates,
  settings,
  onSaveCourse,
  onAddCertificateOption,
  onSaveCertificate,
  editingCertificate = null,
  requestDraft = null,
  reviewMode = false,
  navigate
}: CertificateBuilderProps) {
  
  const [showDetails,setShowDetails]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const submitRef=useRef(false);
  // Form Fields State
  const [certificateId, setCertificateId] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [studentId,setStudentId]=useState('');
  const [certificateType, setCertificateType] = useState('Course Completion');
  const [presentationText, setPresentationText] = useState(DEFAULT_PRESENTATION_TEXT);
  const [completionText, setCompletionText] = useState('has successfully completed the course');
  const [programName, setProgramName] = useState('');
  const [programFontSize, setProgramFontSize] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [dateLineText, setDateLineText] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [designTemplate, setDesignTemplate] = useState<'royal' | 'emerald' | 'academic' | 'modern-blue'>(settings.certTemplate||'royal');
  const [partnerProfileId, setPartnerProfileId] = useState('');
  const [certificateLayout, setCertificateLayout] = useState<CertificateLayout>({ offsets: {} });
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [selectedLayoutElement, setSelectedLayoutElement] = useState<CertificateLayoutElement | null>(null);
  const [layoutHistory, setLayoutHistory] = useState<CertificateLayout[]>([]);
  const [layoutFuture, setLayoutFuture] = useState<CertificateLayout[]>([]);
  const layoutRef = useRef(certificateLayout);

  const updateCertificateLayout = (nextLayout: CertificateLayout) => {
    const previousLayout = layoutRef.current;
    if (JSON.stringify(previousLayout) === JSON.stringify(nextLayout)) return;
    setLayoutHistory((history) => [...history, previousLayout].slice(-50));
    setLayoutFuture([]);
    layoutRef.current = nextLayout;
    setCertificateLayout(nextLayout);
  };

  const undoLayout = () => {
    setLayoutHistory((history) => {
      if (!history.length) return history;
      const previousLayout = history[history.length - 1];
      setLayoutFuture((future) => [layoutRef.current, ...future].slice(0, 50));
      layoutRef.current = previousLayout;
      setCertificateLayout(previousLayout);
      return history.slice(0, -1);
    });
  };

  const redoLayout = () => {
    setLayoutFuture((future) => {
      if (!future.length) return future;
      const nextLayout = future[0];
      setLayoutHistory((history) => [...history, layoutRef.current].slice(-50));
      layoutRef.current = nextLayout;
      setCertificateLayout(nextLayout);
      return future.slice(1);
    });
  };

  useEffect(() => {
    layoutRef.current = certificateLayout;
  }, [certificateLayout]);

  // Load editing certificate or generate defaults
  useEffect(() => {
    setStudentId(requestDraft?.student_code || editingCertificate?.studentId || '');
    if (editingCertificate) {
      setCertificateId(editingCertificate.certificateId);
      setCandidateName(editingCertificate.candidateName);
      setCertificateType(editingCertificate.certificateType);
      setPresentationText(editingCertificate.presentationText || DEFAULT_PRESENTATION_TEXT);
      setCompletionText(getCertificateCompletionLine(editingCertificate));
      setProgramName(editingCertificate.programName);
      setProgramFontSize(editingCertificate.programFontSize || 0);
      setStartDate(editingCertificate.startDate || '');
      setEndDate(editingCertificate.endDate || '');
      setEventDate(editingCertificate.eventDate || '');
      setDateLineText(editingCertificate.dateLineText === LEGACY_DATE_LINE_TEXT && (editingCertificate.startDate || editingCertificate.endDate)
        ? '' : editingCertificate.dateLineText || editingCertificate.eventDate || '');
      setIssueDate(editingCertificate.issueDate);
      setDesignTemplate(editingCertificate.designTemplate);
      setPartnerProfileId(editingCertificate.partnerProfileId || '');
      setCertificateLayout(editingCertificate.certificateLayout || { offsets: {} });
    } else {
      // Auto-generate unique ID
      const existing = existingCertificates.map(c => c.certificateId);
      setCertificateId(requestDraft?.certificate_number || generateCertificateId(existing));
      setPresentationText(DEFAULT_PRESENTATION_TEXT);
      setDateLineText('');
      setProgramFontSize(0);
      setCertificateLayout({ offsets: {} });
      setPartnerProfileId(settings.certificatePartners?.[0]?.id || '');
      
      // Load standard defaults
      if (courses.length > 0) {
        const firstCourse = courses[0];
        setProgramName(firstCourse.name);
        setCertificateType(firstCourse.type);
        setCompletionText(getDefaultCompletionText(firstCourse.type));
      } else {
        setProgramName('');
        setCompletionText(getDefaultCompletionText('Course Completion'));
      }
      if (requestDraft?.kind === 'certificate') {
        setCandidateName(requestDraft.candidate_name);
        setCertificateType(requestDraft.certificate_type || 'Course Completion');
        setCompletionText(getDefaultCompletionText(requestDraft.certificate_type || 'Course Completion'));
        setProgramName(requestDraft.certificate_type==='Internship Completion' && requestDraft.designation ? requestDraft.designation : requestDraft.program_name);
        setStartDate(requestDraft.requested_start_date || requestDraft.start_date || '');
        setEndDate(requestDraft.requested_end_date || requestDraft.end_date || '');
      }
    }
  }, [editingCertificate, requestDraft]);

  const selectedPartner = settings.certificatePartners?.find((partner) => partner.id === partnerProfileId);

  const handleSaveCertificate = async () => {
    if(submitRef.current)return;
    if(studentId.trim()&&!/^LT-STU-[0-9]+$/.test(studentId.trim())){showWarning('Enter the student ID shown in Batches & students, or leave it empty for a document without a registered student.');return;}
    if (!candidateName.trim()) {
      showWarning('Candidate Name is required!');
      return;
    }
    if (!programName.trim()) {
      showWarning('Program Name is required!');
      return;
    }

    const savedCert: Certificate = {
      requestId: requestDraft?.id || editingCertificate?.requestId,
      studentId:studentId.trim()||undefined,
      id: editingCertificate ? editingCertificate.id : crypto.randomUUID(),
      certificateId,
      candidateName,
      candidateEmail: editingCertificate?.candidateEmail || requestDraft?.student_email || '',
      candidatePhone: editingCertificate?.candidatePhone || requestDraft?.student_phone || '',
      collegeName: editingCertificate?.collegeName || requestDraft?.college_name || '',
      department: editingCertificate?.department || requestDraft?.student_department || '',
      enrollmentId: '',
      certificateType,
      presentationText: presentationText.trim() || DEFAULT_PRESENTATION_TEXT,
      completionText: getCertificateCompletionLine({ completionText, certificateType, programName }),
      programName,
      programFontSize: programFontSize > 0 ? programFontSize : undefined,
      startDate,
      endDate,
      eventDate,
      dateLineText: dateLineText.trim(),
      duration: '',
      mode: 'Online',
      location: '',
      issueDate,
      textTemplate: '',
      designTemplate,
      partnerProfileId: selectedPartner?.id,
      partnerName: selectedPartner?.name,
      partnerTagline: selectedPartner?.tagline,
      partnerLogoUrl: selectedPartner?.logoUrl,
      certificateLayout,
      createdAt: editingCertificate ? editingCertificate.createdAt : new Date().toISOString()
    };

    submitRef.current=true;setSubmitting(true);
    try {await onSaveCertificate(savedCert);} finally {submitRef.current=false;setSubmitting(false);}
  };

  return (
    <div className={`space-y-8 pb-12 animate-fade-in ${reviewMode?'request-inline-editor':''} ${showDetails?'show-details':''}`}>
      
      {/* Header controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-850">
        <div className="flex items-center space-x-3">
          <div>
            <span className="text-xxs font-bold text-[#B8894D] uppercase tracking-widest block">Certificates</span>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
              {reviewMode ? 'Document preview' : editingCertificate ? 'Edit certificate' : 'Create certificate'}
            </h1>
          </div>
        </div>
        
        <button
          type="button"
          disabled={submitting}
          onClick={handleSaveCertificate}
          className="studio-button studio-button-primary text-sm"
        >
          <Save className="h-4 w-4" />
          <span>{submitting?'Sending…':reviewMode?'Approve and send':'Save certificate'}</span>
        </button>
      </div>

      {reviewMode&&<button type="button" className="request-detail-toggle" aria-expanded={showDetails} onClick={()=>setShowDetails(!showDetails)}>{showDetails?'Done editing':'Edit document details'}</button>}
      {/* Main Studio Editor Row */}
      <div className="request-editor-columns grid grid-cols-1 lg:grid-cols-[minmax(300px,370px)_minmax(0,1fr)] gap-5 items-start">
        
        {/* Left Form Board (2 cols) */}
        <div className="request-editor-fields lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 rounded-2xl">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-sm space-y-4">
          <div className="border-b border-gray-100 dark:border-slate-850 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
              <Award className="h-4.5 w-4.5 text-[#B8894D]" />
                  Certificate content
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold leading-4">Complete the content here. Use Design Mode beside the preview for moving, sizing, and formatting.</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#078EDB]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#07547E] dark:text-sky-300">{editingCertificate ? 'Editing' : 'New'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 p-3.5 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#07547E] dark:text-sky-300">Recipient</p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Identity and partner details</p>
            </div>

          {/* Certificate ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Certificate ID *</label>
            <input
              type="text"
              required
              value={certificateId}
              onChange={(e) => setCertificateId(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white font-mono font-bold"
            />
          </div>

          {/* Candidate Name */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Candidate Full Name *</label>
            <input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Shahid Himmat Shaikh"
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-gray-900 dark:text-white font-semibold"
            />
          </div>
          </div>

          {/* Certification Category */}
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Student ID (optional)<input value={studentId} readOnly={!!requestDraft} onChange={event=>setStudentId(event.target.value)} placeholder="LT-STU-100001" className="mt-2 block w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm font-mono"/></label>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Certification Category</label>
            <SavedOptionSelect label="Certification category" value={certificateType}
              options={getCertificateCategoryOptions(settings.certificateCategories, certificateType)}
              onChange={(newType) => {
                const oldDef = getDefaultCompletionText(certificateType);
                setCertificateType(newType);
                if (!completionText || completionText === oldDef) {
                  setCompletionText(getDefaultCompletionText(newType));
                }
              }}
              onAdd={(name) => onAddCertificateOption('category', name)}
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white font-medium" />
          </div>

          {/* Partner institute */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Partner Institute (optional)</label>
            <SavedOptionSelect label="Partner institute" value={partnerProfileId}
              options={[{ value: '', label: `${settings.name} only` }, ...(settings.certificatePartners || []).map(partner => ({ value: partner.id, label: partner.name }))]}
              onChange={setPartnerProfileId} onAdd={(name) => onAddCertificateOption('partner', name)}
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white font-medium" />
            <p className="mt-1.5 text-[10px] text-gray-400">Add reusable institute logos from Settings → Certificate Settings.</p>
          </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#07547E] dark:text-sky-300">Wording</p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Choose a preset or write your own certificate language</p>
            </div>

          {/* Certify Statement / Preamble Line (THIS IS TO CERTIFY THAT) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Certify Statement / Preamble Line *
              </label>
              <button
                type="button"
                onClick={() => setPresentationText(DEFAULT_PRESENTATION_TEXT)}
                className="text-[10px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold cursor-pointer hover:underline"
              >
                Reset Default
              </button>
            </div>
            <input
              type="text"
              required
              value={presentationText}
              onChange={(e) => setPresentationText(e.target.value)}
              placeholder="e.g. THIS IS TO CERTIFY THAT, PROUDLY PRESENTED TO"
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-gray-900 dark:text-white font-medium"
            />
            {/* Presets */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] text-gray-400 uppercase font-bold mr-1">Presets:</span>
              {PRESENTATION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPresentationText(preset.text)}
                  className={`px-2 py-0.5 text-[10px] rounded-md border transition-all cursor-pointer ${
                    presentationText === preset.text
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                      : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                  title={preset.text}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Completion Statement / Recognition Line */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Completion Statement / Recognition Line *
              </label>
              <button
                type="button"
                onClick={() => setCompletionText(getDefaultCompletionText(certificateType))}
                className="text-[10px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold cursor-pointer hover:underline"
              >
                Reset Default
              </button>
            </div>
            <input
              type="text"
              required
              value={completionText}
              onChange={(e) => setCompletionText(e.target.value)}
              maxLength={120}
              placeholder="e.g. has successfully completed the course"
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-gray-900 dark:text-white font-medium"
            />
            <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">Keep this short. The candidate name, program and dates appear separately on the certificate.</p>
            {/* Presets */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] text-gray-400 uppercase font-bold mr-1">Presets:</span>
              {COMPLETION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setCompletionText(preset.text)}
                  className={`px-2 py-0.5 text-[10px] rounded-md border transition-all cursor-pointer ${
                    completionText === preset.text
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                      : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                  title={preset.text}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 p-3.5 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#07547E] dark:text-sky-300">Schedule & design</p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Program, dates, and the visual template</p>
            </div>

          {/* Program Name */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Program Name *</label>
            <input
              type="text"
              required
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="e.g. Mock Interview & Technical Assessment at DYPCET, Kolhapur, in association with the CSE (Data Science) Department."
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-gray-900 dark:text-white font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium">Saved programme</label>
            <SavedOptionSelect label="Programme" value={courses.some(course => course.name === programName) ? programName : ''}
              options={[{ value: '', label: 'Choose a saved programme' }, ...courses.map(course => ({ value: course.name, label: course.name }))]}
              onChange={(name) => {
                const course = courses.find(course => course.name === name);
                if (course) { setProgramName(course.name); setCertificateType(course.type); setCompletionText(course.defaultText || getDefaultCompletionText(course.type)); }
              }}
              onAdd={async (name) => {
                const existing = courses.find(course => course.name.toLowerCase() === name.toLowerCase());
                if (existing) return existing.name;
                if (!await onSaveCourse({ id: crypto.randomUUID(), name, type: certificateType, duration: '', mode: 'Online', description: '', defaultText: completionText })) throw new Error('Programme could not be saved. Please try again.');
                setProgramName(name); return name;
              }}
              className="block min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 text-xs" />
          </div>

          {/* Design Template Selection */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Design Template</label>
            <select
              value={designTemplate}
              onChange={(e) => setDesignTemplate(e.target.value as any)}
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none text-gray-900 dark:text-white font-medium"
            >
              <option value="royal">Royal Burgundy</option>
              <option value="emerald">Emerald Green</option>
              <option value="academic">Minimal Teal</option>
              <option value="modern-blue">Modern Blue</option>
            </select>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2 text-xs outline-none text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2 text-xs outline-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Optional wording overrides the date range above. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Event Schedule / Date Line (optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setDateLineText('');
                  setEventDate('');
                }}
                className="text-[10px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold cursor-pointer hover:underline"
              >
                Use dates above
              </button>
            </div>
            <input
              type="text"
              value={dateLineText}
              onChange={(e) => {
                setDateLineText(e.target.value);
                setEventDate(e.target.value);
              }}
              placeholder={getFormattedDateLine({ startDate, endDate, certificateType }) || 'Enter dates above or write a custom line'}
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-gray-900 dark:text-white font-medium"
            />
          </div>

          {/* Date of Issue */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date of Issue</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-2 text-xs outline-none text-gray-900 dark:text-white"
            />
          </div>

          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-slate-850 flex justify-end">
            <button
              type="button"
              disabled={submitting}
          onClick={handleSaveCertificate}
              className="studio-button studio-button-primary text-sm"
            >
              <Save className="h-4 w-4" />
              <span>{submitting?'Sending…':reviewMode?'Approve and send':'Save certificate'}</span>
            </button>
          </div>
        </div>
        </div>

        {/* Right Preview Column (3 cols) */}
        <div className="request-editor-preview min-w-0 lg:sticky lg:top-24 space-y-6">
          <div className="flex flex-col xl:flex-row items-stretch gap-4">
            <div className="min-w-0 flex-1 rounded-2xl border border-gray-200 dark:border-slate-880 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h3 className="font-extrabold text-gray-900 dark:text-white text-sm mb-4 border-b border-gray-50 dark:border-slate-850 pb-3 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Live Interactive Preview
              </h3>

              {/* Live Preview Embed */}
              <div className="border border-gray-100 dark:border-slate-850 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/40">
                <CertificatePreview 
                  certificate={{
                    studentId:studentId.trim()||undefined,
                    id: 'preview',
                    certificateId,
                    candidateName,
                    candidateEmail: '',
                    candidatePhone: '',
                    collegeName: '',
                    department: '',
                    enrollmentId: '',
                    certificateType,
                    presentationText: presentationText.trim() || DEFAULT_PRESENTATION_TEXT,
                    completionText: getCertificateCompletionLine({ completionText, certificateType, programName }),
                    programName,
                    programFontSize: programFontSize > 0 ? programFontSize : undefined,
                    startDate,
                    endDate,
                    eventDate,
                    dateLineText: dateLineText.trim(),
                    duration: '',
                    mode: 'Online',
                    location: '',
                    issueDate,
                    textTemplate: '',
                    designTemplate,
                    partnerProfileId: selectedPartner?.id,
                    partnerName: selectedPartner?.name,
                    partnerTagline: selectedPartner?.tagline,
                    partnerLogoUrl: selectedPartner?.logoUrl,
                    certificateLayout,
                    createdAt: new Date().toISOString()
                  }} 
                  settings={settings}
                  showActions={false}
                  enableLayoutEditing={!reviewMode}
                  layoutEditing={layoutEditing}
                  onLayoutEditingChange={setLayoutEditing}
                  selectedLayoutElement={selectedLayoutElement}
                  onSelectedLayoutElementChange={setSelectedLayoutElement}
                  showLayoutControls={false}
                  onUpdateCertificate={(updatedCertificate) => updateCertificateLayout(updatedCertificate.certificateLayout || { offsets: {} })}
                />
              </div>
            </div>

            {!reviewMode&&<CertificateLayoutControls
              certificateLayout={certificateLayout}
              selectedElement={selectedLayoutElement}
              onSelectElement={setSelectedLayoutElement}
              onUpdateLayout={updateCertificateLayout}
              onResetLayout={() => {
                setSelectedLayoutElement(null);
                updateCertificateLayout({ offsets: {}, sizes: {}, styles: {} });
              }}
              onUndo={undoLayout}
              onRedo={redoLayout}
              canUndo={layoutHistory.length > 0}
              canRedo={layoutFuture.length > 0}
              disabled={!layoutEditing}
            />}
          </div>

          {!reviewMode&&<>
          {/* Informational Widget */}
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-xxs text-gray-500 space-y-2.5">
            <div className="flex items-center space-x-1.5 text-amber-600 font-bold">
              <Sparkles className="h-4 w-4" />
              <span>Bulk Generation Workspace Available</span>
            </div>
            <p className="leading-relaxed font-medium">
              Have multiple students to certify? Do not write them one-by-one. Navigate to the Bulk Studio to upload your student list as an Excel file and generate high-resolution PDFs automatically in seconds.
            </p>
            <button
              onClick={async () => {
                if (await confirmAction('Navigate to bulk import? Unsaved builder changes may be lost.')) {
                  navigate('/certificate/bulk');
                }
              }}
              className="w-full text-center py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold rounded-lg cursor-pointer transition-colors uppercase tracking-wider text-[10px]"
            >
              Go to Bulk Studio
            </button>
          </div>
          </>}
        </div>

      </div>

    </div>
  );
}
