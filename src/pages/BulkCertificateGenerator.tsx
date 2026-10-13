import SavedOptionSelect from '../components/SavedOptionSelect';
import { getCertificateCategoryOptions } from '../utils/certificateUtils';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Award, 
  Sparkles, 
  Upload, 
  Download, 
  Trash2, 
  CheckCircle, 
  Play, 
  AlertCircle,
  FileSpreadsheet,
  Edit2,
  Check,
  FileText,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ExternalLink,
  Minus,
  Sliders
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { Certificate, CertificateLayout, CompanySettings, Course } from '../types';
import { generateCertificateId } from '../utils/idGenerator';
import { 
  getDefaultCompletionText, 
  COMPLETION_PRESETS,
  DEFAULT_PRESENTATION_TEXT,
  PRESENTATION_PRESETS,
  DEFAULT_DATE_LINE_TEXT,
  DATE_LINE_PRESETS,
  getFormattedDateLine,
  getAutoProgramFontSize,
  PROGRAM_FONT_SIZE_PRESETS,
  CERTIFICATE_TYPE_PRESETS
} from '../utils/certificateUtils';
import CertificatePreview from '../components/certificate/CertificatePreview';
import { addCertificateImageToPdf, captureCertificate, createCertificatePdf } from '../utils/certificateExport';

const downloadBlob = (blob: Blob | string, filename: string) => {
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof blob !== 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

interface BulkCertificateGeneratorProps {
  courses: Course[];
  settings: CompanySettings;
  onAddCertificateOption: (kind: 'category' | 'partner', name: string) => Promise<string>;
  existingCertificates: Certificate[];
  onSaveCourse: (course: Course) => Promise<boolean>;
  onSaveCertificates: (certs: Certificate[]) => Promise<boolean>;
  navigate: (path: string) => void;
}

interface StudentRow {
  id: string;
  certificateId: string;
  candidateName: string;
  startDate: string;
  endDate: string;
  eventDate: string;
  issueDate: string;
  completionText?: string;
  presentationText?: string;
  dateLineText?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  pdfBlob?: Blob;
  pdfUrl?: string;
  previewUrl?: string;
}

export default function BulkCertificateGenerator({
  courses,
  settings,
  onSaveCourse,
  onAddCertificateOption,
  existingCertificates,
  onSaveCertificates,
  navigate
}: BulkCertificateGeneratorProps) {
  // Custom course states
  const [programName, setProgramName] = useState('');
  const [programFontSize, setProgramFontSize] = useState<number>(0);
  const [certificateType, setCertificateType] = useState('Course Completion');
  const [presentationText, setPresentationText] = useState(DEFAULT_PRESENTATION_TEXT);
  const [completionText, setCompletionText] = useState(() => getDefaultCompletionText('Course Completion'));
  const [dateLineText, setDateLineText] = useState(DEFAULT_DATE_LINE_TEXT);
  const [designTemplate, setDesignTemplate] = useState<'royal' | 'emerald' | 'academic' | 'modern-blue'>('royal');
  const [partnerProfileId, setPartnerProfileId] = useState('');
  const [certificateLayout, setCertificateLayout] = useState<CertificateLayout>({ offsets: {} });

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [previewStudentIndex, setPreviewStudentIndex] = useState<number>(0);

  // Generation progress
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [exportType, setExportType] = useState<'separate' | 'combined'>('separate');
  const [combinedPdf, setCombinedPdf] = useState<jsPDF | null>(null);

  // PDF/Image Preview states
  const [combinedPdfUrl, setCombinedPdfUrl] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  const [activePreviewTab, setActivePreviewTab] = useState<'image' | 'pdf'>('image');
  const [isInIframe, setIsInIframe] = useState(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const selectedPartner = settings.certificatePartners?.find((partner) => partner.id === partnerProfileId);
  const partnerSnapshot = {
    partnerProfileId: selectedPartner?.id,
    partnerName: selectedPartner?.name,
    partnerTagline: selectedPartner?.tagline,
    partnerLogoUrl: selectedPartner?.logoUrl
  };

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Clean up generated object URLs once, on unmount. Do not revoke them on
  // every students state update or existing previews/downloads will break.
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const offscreenRef = useRef<HTMLDivElement>(null);

  // Set default form values on mount
  useEffect(() => {
    setPartnerProfileId(settings.certificatePartners?.[0]?.id || '');
    if (courses.length > 0) {
      const first = courses[0];
      setProgramName(first.name);
      setCertificateType(first.type);
      setCompletionText(getDefaultCompletionText(first.type));
    } else {
      setProgramName('');
      setCompletionText(getDefaultCompletionText('Course Completion'));
    }
  }, []);

  // Download sample template file
  const downloadSampleTemplate = () => {
    const headers = [
      'Certificate ID',
      'Candidate Name',
      'Certify Statement',
      'Completion Statement',
      'Schedule Date Line',
      'Start Date',
      'End Date',
      'Event Date',
      'Issue Date'
    ];
    
    const sampleData = [
      {
        'Certificate ID': '',
        'Candidate Name': 'Example Candidate',
        'Certify Statement': 'THIS IS TO CERTIFY THAT',
        'Completion Statement': 'has successfully completed the course',
        'Schedule Date Line': 'held in May 2026',
        'Start Date': new Date().toISOString().split('T')[0],
        'End Date': new Date().toISOString().split('T')[0],
        'Event Date': '',
        'Issue Date': new Date().toISOString().split('T')[0]
      },
      {
        'Certificate ID': '',
        'Candidate Name': 'Example Candidate',
        'Certify Statement': 'THIS IS TO CERTIFY THAT',
        'Completion Statement': 'in appreciation of outstanding contribution and dedication to',
        'Schedule Date Line': 'held in May 2026',
        'Start Date': new Date().toISOString().split('T')[0],
        'End Date': new Date().toISOString().split('T')[0],
        'Event Date': '',
        'Issue Date': new Date().toISOString().split('T')[0]
      },
      {
        'Certificate ID': '',
        'Candidate Name': 'Example Candidate',
        'Certify Statement': 'PROUDLY PRESENTED TO',
        'Completion Statement': 'for outstanding performance and exceptional dedication to',
        'Schedule Date Line': 'held in May 2026',
        'Start Date': new Date().toISOString().split('T')[0],
        'End Date': new Date().toISOString().split('T')[0],
        'Event Date': '',
        'Issue Date': new Date().toISOString().split('T')[0]
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'LihaTech_Bulk_Template.xlsx');
  };

  // File drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawJson.length === 0) {
          alert('The uploaded file appears to be empty.');
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        const existingIds = existingCertificates.map(c => c.certificateId);
        
        let localIdsPool = [...existingIds];

        const mapped: StudentRow[] = rawJson.map((row, index) => {
          // Generate a series of unique IDs sequentially
          const certId = generateCertificateId(localIdsPool);
          localIdsPool.push(certId);

          return {
            id: 'row_' + Date.now() + '_' + index,
            certificateId: row['Certificate ID'] || row['Enrollment ID'] || certId,
            candidateName: row['Candidate Name'] || row['Name'] || '',
            startDate: row['Start Date'] || today,
            endDate: row['End Date'] || today,
            eventDate: row['Event Date'] || '',
            issueDate: row['Issue Date'] || today,
            completionText: row['Completion Statement'] || row['Completion Text'] || row['Statement'] || row['Recognition'] || undefined,
            presentationText: row['Certify Statement'] || row['Presentation Line'] || row['Preamble'] || undefined,
            dateLineText: row['Schedule Date Line'] || row['Schedule Line'] || row['Date Line'] || undefined,
            status: 'pending' as const
          };
        }).filter(r => r.candidateName.trim().length > 0);

        if (mapped.length === 0) {
          alert('Could not parse any valid student records. Make sure the spreadsheet has a column named "Candidate Name" or "Name".');
          return;
        }

        setStudents(mapped);
        setPreviewStudentIndex(0);
        setGenerationComplete(false);
        setCurrentIndex(-1);
      } catch (err) {
        console.error(err);
        alert('Failed to parse Excel file. Please ensure it is a valid Excel format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Edit / Delete student record row
  const handleDeleteRow = (id: string) => {
    setStudents(prev => {
      const nextStudents = prev.filter(s => s.id !== id);
      setPreviewStudentIndex(prevIndex => {
        if (prevIndex >= nextStudents.length) {
          return Math.max(0, nextStudents.length - 1);
        }
        return prevIndex;
      });
      return nextStudents;
    });
  };

  const handleUpdateRowValue = (id: string, field: keyof StudentRow, value: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Bulk Generator Loop Engine
  const startBulkGeneration = async () => {
    if (students.length === 0) {
      alert('Please import a list of students first.');
      return;
    }

    if (!programName.trim()) {
      alert('Please provide a valid Program Name.');
      return;
    }

    setIsGenerating(true);
    setGenerationComplete(false);
    setCombinedPdf(null);

    // Revoke previous URLs to avoid memory leaks.
    setCombinedPdfUrl(null);
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();

    // Prepare container for merged outputs if requested
    let pdfBundle: jsPDF | null = null;
    if (exportType === 'combined') {
      pdfBundle = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
    }

    const compiledCertificates: Certificate[] = [];
    const bulkGroupId = 'bulk_group_' + Date.now();

    // Process each student sequentially
    for (let i = 0; i < students.length; i++) {
      setCurrentIndex(i);
      setStudents(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'processing' } : s));

      // Wait brief tick for DOM rendering to update with active item
      await new Promise(resolve => setTimeout(resolve, 500));

      const activeStudent = students[i];
      const captureTarget = offscreenRef.current;

      if (!captureTarget) {
        setStudents(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'failed', error: 'Render element not found' } : s));
        continue;
      }

      try {
        const canvas = await captureCertificate(captureTarget);
        const output = await createCertificatePdf(canvas);

        // Compile database record
        const certRecord: Certificate = {
          id: crypto.randomUUID(),
          certificateId: activeStudent.certificateId,
          candidateName: activeStudent.candidateName,
          candidateEmail: '',
          collegeName: '',
          department: '',
          enrollmentId: '',
          certificateType: certificateType,
          presentationText: activeStudent.presentationText || presentationText || DEFAULT_PRESENTATION_TEXT,
          completionText: activeStudent.completionText || completionText || getDefaultCompletionText(certificateType),
          programName: programName,
          programFontSize: programFontSize > 0 ? programFontSize : undefined,
          startDate: activeStudent.startDate,
          endDate: activeStudent.endDate,
          eventDate: activeStudent.eventDate,
          dateLineText: activeStudent.dateLineText || dateLineText || getFormattedDateLine({ eventDate: activeStudent.eventDate, startDate: activeStudent.startDate, endDate: activeStudent.endDate }),
          duration: '',
          mode: 'Online',
          location: '',
          issueDate: activeStudent.issueDate,
          textTemplate: '',
          designTemplate: designTemplate,
      certificateLayout,
      ...partnerSnapshot,
          createdAt: new Date().toISOString(),
          bulkGroupId: bulkGroupId
        };

        compiledCertificates.push(certRecord);

        // Always create a single-page PDF for live preview
        const pdfBlob = output.pdfBlob;
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const previewUrl = output.previewUrl;
        objectUrlsRef.current.add(pdfUrl);
        if (previewUrl) objectUrlsRef.current.add(previewUrl);

        if (exportType === 'combined' && pdfBundle) {
          // If combined mode, add page sequentially
          if (i > 0) {
            pdfBundle.addPage('a4', 'landscape');
          }
          addCertificateImageToPdf(pdfBundle, output.imageData);
        }

        setStudents(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed', pdfBlob, pdfUrl, previewUrl } : s));
      } catch (err: any) {
        console.error(err);
        setStudents(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'failed', error: err.message || 'Capture failed' } : s));
      }
    }

    // Save all to parent registry
    if (compiledCertificates.length > 0) {
      if (!await onSaveCertificates(compiledCertificates)) {
        setIsGenerating(false); setCurrentIndex(-1); return;
      }
    }

    if (exportType === 'combined' && pdfBundle) {
      setCombinedPdf(pdfBundle);
      const combinedBlob = pdfBundle.output('blob');
      const combinedUrl = URL.createObjectURL(combinedBlob);
      objectUrlsRef.current.add(combinedUrl);
      setCombinedPdfUrl(combinedUrl);
    }

    setIsGenerating(false);
    setGenerationComplete(true);
    setCurrentIndex(-1);
  };

  const downloadCombinedBundle = () => {
    if (combinedPdf) {
      const blob = combinedPdf.output('blob');
      downloadBlob(blob, `LihaTech_Bulk_Compile_${Date.now()}.pdf`);
    }
  };

  const downloadSeparateZip = async () => {
    const completedStudents = students.filter(s => s.status === 'completed' && s.pdfBlob);
    if (completedStudents.length === 0) {
      alert('No completed certificates found to package.');
      return;
    }

    try {
      const zip = new JSZip();
      completedStudents.forEach(student => {
        if (student.pdfBlob) {
          const fileName = `Certificate_${student.candidateName.replace(/\s+/g, '_')}_${student.certificateId}.pdf`;
          zip.file(fileName, student.pdfBlob);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, `Certificates_${programName.replace(/\s+/g, '_')}_${Date.now()}.zip`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate ZIP archive: ' + err.message);
    }
  };

  const processingItem = currentIndex >= 0 ? students[currentIndex] : null;

  // Active compiled record format for preview
  const currentPreviewRecord: Certificate | null = processingItem ? {
    id: processingItem.id,
    certificateId: processingItem.certificateId,
    candidateName: processingItem.candidateName,
    candidateEmail: '',
    collegeName: '',
    department: '',
    enrollmentId: '',
    certificateType: certificateType,
    presentationText: processingItem.presentationText || presentationText || DEFAULT_PRESENTATION_TEXT,
    completionText: processingItem.completionText || completionText || getDefaultCompletionText(certificateType),
    programName: programName,
    programFontSize: programFontSize > 0 ? programFontSize : undefined,
    startDate: processingItem.startDate,
    endDate: processingItem.endDate,
    eventDate: processingItem.eventDate,
    dateLineText: processingItem.dateLineText || dateLineText || getFormattedDateLine({ eventDate: processingItem.eventDate, startDate: processingItem.startDate, endDate: processingItem.endDate }),
    duration: '',
    mode: 'Online',
    location: '',
    issueDate: processingItem.issueDate,
    textTemplate: '',
    designTemplate: designTemplate,
    certificateLayout,
    ...partnerSnapshot,
    createdAt: new Date().toISOString()
  } : null;

  // Real-time Preview logic
  const dummyStudent: StudentRow = {
    id: 'dummy',
    certificateId: `LT-CERT-${new Date().getFullYear()}-XXXX`,
    candidateName: 'Candidate name',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    eventDate: '',
    issueDate: new Date().toISOString().split('T')[0],
    status: 'pending' as const
  };

  const activePreviewStudent = students.length > 0 
    ? (students[previewStudentIndex] || students[0]) 
    : dummyStudent;

  const activePreviewCertificate: Certificate = {
    id: activePreviewStudent.id,
    certificateId: activePreviewStudent.certificateId,
    candidateName: activePreviewStudent.candidateName,
    candidateEmail: '',
    collegeName: '',
    department: '',
    enrollmentId: '',
    certificateType: certificateType,
    presentationText: activePreviewStudent.presentationText || presentationText || DEFAULT_PRESENTATION_TEXT,
    completionText: activePreviewStudent.completionText || completionText || getDefaultCompletionText(certificateType),
    programName: programName,
    programFontSize: programFontSize > 0 ? programFontSize : undefined,
    startDate: activePreviewStudent.startDate,
    endDate: activePreviewStudent.endDate,
    eventDate: activePreviewStudent.eventDate,
    dateLineText: activePreviewStudent.dateLineText || dateLineText || getFormattedDateLine({ eventDate: activePreviewStudent.eventDate, startDate: activePreviewStudent.startDate, endDate: activePreviewStudent.endDate }),
    duration: '',
    mode: 'Online',
    location: '',
    issueDate: activePreviewStudent.issueDate,
    textTemplate: '',
    designTemplate: designTemplate,
    certificateLayout,
    ...partnerSnapshot,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="space-y-6 animate-fade-in py-2" id="bulk-certificates-page">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-850">
        <div>
          <span className="text-xxs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest block">Certificates</span>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Bulk certificates</h1>
        </div>
        
        {/* Sub Navigation Button Group */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/certificate/old')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-[#6D1F2A] hover:text-white dark:hover:bg-[#6D1F2A] text-slate-700 dark:text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-xs"
          >
            <Award className="h-3.5 w-3.5" />
            <span>Issued Registry</span>
          </button>
          <button
            onClick={() => navigate('/certificate/new')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-[#6D1F2A] hover:text-white dark:hover:bg-[#6D1F2A] text-slate-700 dark:text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Configurator & Importer Column */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Configurator Card */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-[#B8894D]" />
              Course Configurator
            </h3>

            <div className="space-y-3.5">
              {/* Certificate Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Certificate Type</label>
                <SavedOptionSelect label="Certification category" value={certificateType}
                  options={getCertificateCategoryOptions(settings.certificateCategories, certificateType)}
                  onChange={(newType) => {
                    const oldDef = getDefaultCompletionText(certificateType);
                    setCertificateType(newType);
                    if (!completionText || completionText === oldDef) setCompletionText(getDefaultCompletionText(newType));
                  }}
                  onAdd={(name) => onAddCertificateOption('category', name)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium" />
                <div className="flex flex-wrap gap-1 pt-1">
                  {CERTIFICATE_TYPE_PRESETS.slice(0, 4).map((preset) => {
                    const t = preset.value;
                    return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const oldDef = getDefaultCompletionText(certificateType);
                        setCertificateType(t);
                        if (!completionText || completionText === oldDef) {
                          setCompletionText(getDefaultCompletionText(t));
                        }
                      }}
                      className={`px-1.5 py-0.5 text-[9px] rounded-md border transition-colors cursor-pointer ${
                        certificateType === t
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                    );
                  })}
                </div>
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

              {/* Partner institute */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Partner Institute (optional)</label>
                <SavedOptionSelect label="Partner institute" value={partnerProfileId}
                  options={[{ value: '', label: `${settings.name} only` }, ...(settings.certificatePartners || []).map(partner => ({ value: partner.id, label: partner.name }))]}
                  onChange={setPartnerProfileId} onAdd={(name) => onAddCertificateOption('partner', name)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium" />
                <p className="text-[9px] text-gray-400">Reusable institute logos are managed in Certificate Settings.</p>
              </div>

              {/* Certify Statement / Preamble Line */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Certify Statement (THIS IS TO CERTIFY THAT)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPresentationText(DEFAULT_PRESENTATION_TEXT)}
                    className="text-[9px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="text"
                  value={presentationText}
                  onChange={(e) => setPresentationText(e.target.value)}
                  placeholder="e.g. THIS IS TO CERTIFY THAT, PROUDLY PRESENTED TO"
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {PRESENTATION_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPresentationText(p.text)}
                      className={`px-1.5 py-0.5 text-[9px] rounded-md border transition-colors cursor-pointer ${
                        presentationText === p.text
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Completion Statement / Recognition Line */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Completion Statement
                  </label>
                  <button
                    type="button"
                    onClick={() => setCompletionText(getDefaultCompletionText(certificateType))}
                    className="text-[9px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="text"
                  value={completionText}
                  onChange={(e) => setCompletionText(e.target.value)}
                  placeholder="e.g. has successfully completed the course"
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {COMPLETION_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setCompletionText(p.text)}
                      className={`px-1.5 py-0.5 text-[9px] rounded-md border transition-colors cursor-pointer ${
                        completionText === p.text
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                      title={p.text}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Schedule / Date Line */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Schedule / Date Line (e.g. held in May 2026)
                  </label>
                  <button
                    type="button"
                    onClick={() => setDateLineText(DEFAULT_DATE_LINE_TEXT)}
                    className="text-[9px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="text"
                  value={dateLineText}
                  onChange={(e) => setDateLineText(e.target.value)}
                  placeholder="e.g. held in May 2026, held on 8 & 9 May 2026"
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {DATE_LINE_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDateLineText(p.text)}
                      className={`px-1.5 py-0.5 text-[9px] rounded-md border transition-colors cursor-pointer ${
                        dateLineText === p.text
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Program Name</label>
                  <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    {programFontSize > 0 ? `${programFontSize}px` : `Auto (${getAutoProgramFontSize(programName)}px)`}
                  </span>
                </div>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g. Mock Interview & Technical Assessment at DYPCET, Kolhapur, in association with the CSE (Data Science) Department."
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium"
                />

                {/* Font Size Adjuster for Program Name */}
                <div className="mt-1 flex flex-wrap items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-gray-500 dark:text-gray-400">Size:</span>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const current = programFontSize > 0 ? programFontSize : getAutoProgramFontSize(programName);
                        setProgramFontSize(Math.max(12, current - 1));
                      }}
                      className="p-0.5 text-gray-600 dark:text-gray-300 hover:text-amber-600 cursor-pointer"
                      title="Smaller font"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="range"
                      min="12"
                      max="36"
                      value={programFontSize > 0 ? programFontSize : getAutoProgramFontSize(programName)}
                      onChange={(e) => setProgramFontSize(parseInt(e.target.value, 10))}
                      className="w-16 accent-amber-600 cursor-pointer h-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = programFontSize > 0 ? programFontSize : getAutoProgramFontSize(programName);
                        setProgramFontSize(Math.min(36, current + 1));
                      }}
                      className="p-0.5 text-gray-600 dark:text-gray-300 hover:text-amber-600 cursor-pointer"
                      title="Larger font"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-gray-800 dark:text-gray-200 pl-1 border-l border-gray-200 dark:border-slate-800">
                      {programFontSize > 0 ? `${programFontSize}px` : 'Auto'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {PROGRAM_FONT_SIZE_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setProgramFontSize(p.value)}
                        className={`px-1.5 py-0.5 text-[9px] rounded-md transition-colors cursor-pointer ${
                          (p.value === 0 ? programFontSize === 0 : programFontSize === p.value)
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-amber-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Design Template */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Design Template</label>
                <select
                  value={designTemplate}
                  onChange={(e) => setDesignTemplate(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-medium"
                >
                  <option value="royal">Royal Burgundy</option>
                  <option value="emerald">Emerald Green</option>
                  <option value="academic">Minimal Teal</option>
                  <option value="modern-blue">Modern Blue</option>
                </select>
              </div>
            </div>
          </div>

          {/* Import Source Excel Card */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#B8894D]" />
              Data Source
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={downloadSampleTemplate}
                className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 border border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-colors shadow-xs"
              >
                <Download className="h-3.5 w-3.5 text-[#B8894D]" />
                <span>Download Excel Template</span>
              </button>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-amber-500 bg-amber-500/5' 
                    : 'border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 hover:border-slate-400'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1.5" />
                <span className="text-xxs font-extrabold text-gray-600 dark:text-slate-300 block">Upload spreadsheet</span>
                <span className="text-[9px] text-gray-400 block mt-0.5">Drag & Drop Excel/CSV or Click</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Live Interactive Preview Column */}
        <div className="lg:col-span-2 space-y-6">
          {generationComplete && students.some(s => s.status === 'completed') ? (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col h-full justify-between">
              {/* Compiled Previews Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-150 dark:border-slate-850">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">
                    Compiled Certificates ({students.filter(s => s.status === 'completed').length} Previews)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadSeparateZip}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs"
                    title="Download all certificates as a single ZIP archive"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download ZIP (All)</span>
                  </button>
                  <button
                    onClick={() => {
                      setGenerationComplete(false);
                    }}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Edit Template
                  </button>
                </div>
              </div>

              {/* Scrollable list of generated certificates */}
              <div className="flex-1 overflow-y-auto max-h-[550px] space-y-6 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {students.filter(s => s.status === 'completed').map((student, i) => {
                  const certRecord: Certificate = {
                    id: student.id,
                    certificateId: student.certificateId,
                    candidateName: student.candidateName,
                    candidateEmail: '',
                    collegeName: '',
                    department: '',
                    enrollmentId: '',
                    certificateType: certificateType,
                    presentationText: student.presentationText || presentationText || DEFAULT_PRESENTATION_TEXT,
                    completionText: student.completionText || completionText || getDefaultCompletionText(certificateType),
                    programName: programName,
                    programFontSize: programFontSize > 0 ? programFontSize : undefined,
                    startDate: student.startDate,
                    endDate: student.endDate,
                    eventDate: student.eventDate,
                    dateLineText: student.dateLineText || dateLineText || getFormattedDateLine({ eventDate: student.eventDate, startDate: student.startDate, endDate: student.endDate }),
                    duration: '',
                    mode: 'Online',
                    location: '',
                    issueDate: student.issueDate,
                    textTemplate: '',
                    designTemplate: designTemplate,
                    certificateLayout,
                    ...partnerSnapshot,
                    createdAt: new Date().toISOString()
                  };

                  return (
                    <div 
                      key={student.id} 
                      className="border border-gray-150 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3"
                    >
                      {/* Individual Certificate Header with Single Download Button */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
                        <span>#{i + 1} - {student.candidateName} ({student.certificateId})</span>
                        <button
                          onClick={() => {
                            if (student.pdfBlob) {
                              downloadBlob(student.pdfBlob, `Certificate_${student.candidateName.replace(/\s+/g, '_')}_${student.certificateId}.pdf`);
                            } else if (student.pdfUrl) {
                              downloadBlob(student.pdfUrl, `Certificate_${student.candidateName.replace(/\s+/g, '_')}_${student.certificateId}.pdf`);
                            }
                          }}
                          className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-lg transition-colors cursor-pointer font-extrabold uppercase tracking-wider text-[9px]"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download PDF</span>
                        </button>
                      </div>

                      {/* Rendered Certificate Area */}
                      <div className="w-full overflow-hidden rounded-lg shadow-xs border border-gray-150 dark:border-slate-850 bg-white">
                        {student.previewUrl ? (
                          <img 
                            src={student.previewUrl}
                            alt={`Certificate for ${student.candidateName}`}
                            className="w-full h-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="p-4 scale-[0.8] origin-top">
                            <CertificatePreview 
                              certificate={certRecord} 
                              settings={settings} 
                              showActions={false} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-normal italic mt-2">
                Use the scrollbar above to inspect all generated certificates. You can download individual certificates or click "Download ZIP" to save all.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col h-full justify-between">
              
              {/* Live Preview Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-150 dark:border-slate-850">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-[#B8894D]" />
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">
                    Live Certificate Template Preview
                  </h3>
                </div>

                {students.length === 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                    Showing Sample Candidate
                  </span>
                ) : (
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Preview Row:</span>
                    <button
                      disabled={previewStudentIndex <= 0}
                      onClick={() => setPreviewStudentIndex(prev => Math.max(0, prev - 1))}
                      className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous Student"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <select
                      value={previewStudentIndex}
                      onChange={(e) => setPreviewStudentIndex(Number(e.target.value))}
                      className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-xxs font-bold text-slate-800 dark:text-slate-200 max-w-[150px] truncate"
                    >
                      {students.map((student, idx) => (
                        <option key={student.id} value={idx}>
                          {idx + 1}. {student.candidateName}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={previewStudentIndex >= students.length - 1}
                      onClick={() => setPreviewStudentIndex(prev => Math.min(students.length - 1, prev + 1))}
                      className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next Student"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Sized Scaling Certificate Preview Wrapper */}
              <div className="flex-1 flex items-center justify-center py-2">
                <div className="w-full">
                  <CertificatePreview 
                    certificate={activePreviewCertificate} 
                    settings={settings} 
                    showActions={false} 
                    enableLayoutEditing
                    onUpdateCertificate={(updatedCertificate) => setCertificateLayout(updatedCertificate.certificateLayout || { offsets: {} })}
                  />
                </div>
              </div>

              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-normal italic mt-2">
                Any changes made to the configuration on the left will immediately reflect in this real-time layout rendering.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Uploaded Students list preview panel */}
      {students.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs space-y-4">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">
                Imported Students Registry ({students.length} Records)
              </h3>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                Inspect and tweak information below before starting compiling process
              </p>
            </div>

            {/* Actions for generation */}
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Export Type:</span>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as any)}
                  disabled={isGenerating}
                  className="rounded-lg border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                >
                  <option value="separate">Separate Individual PDFs</option>
                  <option value="combined">Combined Single Multi-page PDF</option>
                </select>
              </div>

              {!isGenerating && !generationComplete ? (
                <button
                  onClick={startBulkGeneration}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Start Bulk Compile</span>
                </button>
              ) : isGenerating ? (
                <div className="flex items-center space-x-2 text-amber-600 text-xs font-extrabold uppercase">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating ({currentIndex + 1}/{students.length})...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-1 text-emerald-600 text-xs font-extrabold uppercase">
                    <CheckCircle className="h-4 w-4" />
                    <span>Generation Complete!</span>
                  </div>
                  {exportType === 'combined' && combinedPdf && (
                    <>
                      {combinedPdfUrl && (
                        <button
                          onClick={() => {
                            const imgs = students.filter(s => s.status === 'completed' && s.previewUrl).map(s => s.previewUrl as string);
                            setPreviewImages(imgs);
                            setPreviewImageIndex(0);
                            setPreviewPdfUrl(combinedPdfUrl);
                            setPreviewPdfTitle('Combined Multi-page PDF');
                          }}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview PDF</span>
                        </button>
                      )}
                      <button
                        onClick={downloadCombinedBundle}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Multi-page PDF</span>
                      </button>
                      {combinedPdfUrl && (
                        <button
                          onClick={() => {
                            window.open(combinedPdfUrl, '_blank');
                          }}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors"
                          title="Open combined PDF directly in a new browser tab to print or save"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open in New Tab</span>
                        </button>
                      )}
                    </>
                  )}
                  {exportType === 'separate' && students.some(s => s.status === 'completed') && (
                    <button
                      onClick={downloadSeparateZip}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors animate-fade-in"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download ZIP (All PDFs)</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setStudents([]);
                      setGenerationComplete(false);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isGenerating && (
            <div className="px-6">
              <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / students.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-400 mt-1 block">
                Currently capturing: <span className="text-slate-700 dark:text-slate-200 font-extrabold">{students[currentIndex]?.candidateName}</span> (ID: {students[currentIndex]?.certificateId})
              </span>
            </div>
          )}

          {/* Table list */}
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-850 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Certificate ID</th>
                  <th className="px-4 py-3">Candidate Name</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Event Date</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-850 font-medium text-slate-700 dark:text-slate-300">
                {students.map((student) => {
                  const isEditing = editingRowId === student.id;

                  return (
                    <tr key={student.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all ${
                      student.status === 'processing' ? 'bg-amber-500/5' : ''
                    }`}>
                      {/* Cert ID */}
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white font-mono">
                        {isEditing ? (
                          <input
                            type="text"
                            value={student.certificateId}
                            onChange={(e) => handleUpdateRowValue(student.id, 'certificateId', e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-850 rounded px-1.5 py-0.5 text-xs w-28"
                          />
                        ) : (
                          student.certificateId
                        )}
                      </td>

                      {/* Candidate Name */}
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {isEditing ? (
                          <input
                            type="text"
                            value={student.candidateName}
                            onChange={(e) => handleUpdateRowValue(student.id, 'candidateName', e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-850 rounded px-1.5 py-0.5 text-xs w-32"
                          />
                        ) : (
                          student.candidateName
                        )}
                      </td>

                      {/* Start Date */}
                      <td className="px-4 py-3 text-slate-500">
                        {isEditing ? (
                          <input
                            type="date"
                            value={student.startDate}
                            onChange={(e) => handleUpdateRowValue(student.id, 'startDate', e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-850 rounded px-1 py-0.5 text-xs"
                          />
                        ) : (
                          student.startDate || '--'
                        )}
                      </td>

                      {/* End Date */}
                      <td className="px-4 py-3 text-slate-500">
                        {isEditing ? (
                          <input
                            type="date"
                            value={student.endDate}
                            onChange={(e) => handleUpdateRowValue(student.id, 'endDate', e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-850 rounded px-1 py-0.5 text-xs"
                          />
                        ) : (
                          student.endDate || '--'
                        )}
                      </td>

                      {/* Event Date */}
                      <td className="px-4 py-3 text-slate-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={student.eventDate}
                            onChange={(e) => handleUpdateRowValue(student.id, 'eventDate', e.target.value)}
                            placeholder="e.g. 8 & 9 May 2026"
                            className="bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-850 rounded px-1.5 py-0.5 text-xs w-28"
                          />
                        ) : (
                          student.eventDate || '--'
                        )}
                      </td>

                      {/* Issue Date */}
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {isEditing ? (
                          <input
                            type="date"
                            value={student.issueDate}
                            onChange={(e) => handleUpdateRowValue(student.id, 'issueDate', e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-850 rounded px-1 py-0.5 text-xs"
                          />
                        ) : (
                          student.issueDate || '--'
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {student.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] uppercase">
                            Pending
                          </span>
                        )}
                        {student.status === 'processing' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold text-[9px] uppercase flex items-center w-fit gap-1">
                            <Loader2 className="h-2 w-2 animate-spin" />
                            Rendering
                          </span>
                        )}
                        {student.status === 'completed' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase">
                            Compiled
                          </span>
                        )}
                        {student.status === 'failed' && (
                          <span 
                            title={student.error}
                            className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-[9px] uppercase cursor-help flex items-center w-fit gap-1"
                          >
                            <AlertCircle className="h-2.5 w-2.5" />
                            Error
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        {student.status === 'completed' && student.pdfUrl && (
                          <>
                            <button
                              onClick={() => {
                                if (student.previewUrl) {
                                  setPreviewImages([student.previewUrl]);
                                  setPreviewImageIndex(0);
                                } else {
                                  setPreviewImages([]);
                                }
                                setPreviewPdfUrl(student.pdfUrl!);
                                setPreviewPdfTitle(`Certificate - ${student.candidateName}`);
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer animate-fade-in"
                              title="Preview Generated PDF"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (student.pdfBlob) {
                                  downloadBlob(student.pdfBlob, `Certificate_${student.candidateName.replace(/\s+/g, '_')}_${student.certificateId}.pdf`);
                                } else if (student.pdfUrl) {
                                  downloadBlob(student.pdfUrl, `Certificate_${student.candidateName.replace(/\s+/g, '_')}_${student.certificateId}.pdf`);
                                }
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer animate-fade-in"
                              title="Download Certificate PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (student.pdfUrl) {
                                  window.open(student.pdfUrl, '_blank');
                                }
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer animate-fade-in"
                              title="Open PDF in New Tab (Direct Save/Print)"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            if (isEditing) {
                              setEditingRowId(null);
                            } else {
                              setEditingRowId(student.id);
                            }
                          }}
                          disabled={isGenerating}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          {isEditing ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Edit2 className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRow(student.id)}
                          disabled={isGenerating}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OFF-SCREEN CAPTURE AREA FOR DYNAMIC EXCEL RENDERING ENGINE */}
      <div 
        style={{ 
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1122.52px',
          height: '793.7px',
          overflow: 'hidden',
          zIndex: -9999,
          pointerEvents: 'none'
        }}
      >
        {currentPreviewRecord && (
          <CertificatePreview 
            certificate={currentPreviewRecord} 
            settings={settings} 
            showActions={false} 
            renderOnlySheet={true}
            divRef={offscreenRef}
          />
        )}
      </div>

      {/* DYNAMIC COMPILATION PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#B8894D]" />
                  {previewPdfTitle || 'Generated Certificate PDF Preview'}
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                  Real-time generated document file viewer
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Page Navigation if multiple pages */}
                {previewImages.length > 1 && activePreviewTab === 'image' && (
                  <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                    <button
                      disabled={previewImageIndex === 0}
                      onClick={() => setPreviewImageIndex(p => Math.max(0, p - 1))}
                      className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-40 transition-colors"
                      title="Previous Page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 min-w-[70px] text-center">
                      Page {previewImageIndex + 1} of {previewImages.length}
                    </span>
                    <button
                      disabled={previewImageIndex === previewImages.length - 1}
                      onClick={() => setPreviewImageIndex(p => Math.min(previewImages.length - 1, p + 1))}
                      className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-40 transition-colors"
                      title="Next Page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setPreviewPdfUrl(null);
                    setPreviewPdfTitle(null);
                    setPreviewImages([]);
                    setPreviewImageIndex(0);
                    setActivePreviewTab('image');
                  }}
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Close Preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tab Selection */}
            {previewImages.length > 0 && (
              <div className="flex border-b border-gray-150 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-6 py-1.5 gap-4">
                <button
                  onClick={() => setActivePreviewTab('image')}
                  className={`py-1.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activePreviewTab === 'image'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Document View
                </button>
                <button
                  onClick={() => setActivePreviewTab('pdf')}
                  className={`py-1.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activePreviewTab === 'pdf'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Interactive PDF Viewer
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 flex items-center justify-center relative overflow-hidden">
              {activePreviewTab === 'image' && previewImages.length > 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center overflow-auto p-2">
                  <img
                    src={previewImages[previewImageIndex]}
                    alt={`Certificate page ${previewImageIndex + 1}`}
                    className="max-w-full max-h-[58vh] rounded-xl border border-gray-200 dark:border-slate-800 shadow-lg object-contain bg-white"
                  />
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3.5 italic font-semibold">
                    Accurate 300 DPI layout design output
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <iframe
                    src={`${previewPdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                    title="PDF Preview Document"
                    className="w-full h-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                  />
                  <div className="absolute bottom-4 left-4 right-4 pointer-events-none text-center">
                    <span className="inline-block bg-black/75 px-3 py-1 rounded-xs text-[9px] text-gray-300 font-medium">
                      Tip: If the PDF plugin doesn't load under your browser's security policy, switch to "Document View" or download.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-150 dark:border-slate-800 flex justify-end gap-3 bg-gray-50 dark:bg-slate-900">
              <button
                onClick={async () => {
                  if (previewPdfUrl) {
                    try {
                      const res = await fetch(previewPdfUrl);
                      const blob = await res.blob();
                      downloadBlob(blob, previewPdfTitle ? `${previewPdfTitle.replace(/\s+/g, '_')}.pdf` : 'Certificate.pdf');
                    } catch (e) {
                      downloadBlob(previewPdfUrl, previewPdfTitle ? `${previewPdfTitle.replace(/\s+/g, '_')}.pdf` : 'Certificate.pdf');
                    }
                  }
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PDF</span>
              </button>
              {previewPdfUrl && (
                <button
                  onClick={() => {
                    window.open(previewPdfUrl, '_blank');
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-xs cursor-pointer"
                  title="Open PDF directly in a new browser tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in New Tab</span>
                </button>
              )}
              <button
                onClick={() => {
                  setPreviewPdfUrl(null);
                  setPreviewPdfTitle(null);
                  setPreviewImages([]);
                  setPreviewImageIndex(0);
                  setActivePreviewTab('image');
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
