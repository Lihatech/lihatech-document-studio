import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from '../lib/html2canvas-patch';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  Award,
  Settings,
  Sparkles,
  X,
  User,
  Mail,
  Layers,
  FileText,
  Clock,
  ChevronRight,
  Download,
  CheckCircle2
} from 'lucide-react';
import { Certificate, CompanySettings } from '../types';
import CertificatePreview from '../components/certificate/CertificatePreview';

interface OldCertificatesProps {
  certificates: Certificate[];
  settings: CompanySettings;
  onSelectCertificate: (cert: Certificate) => void;
  onEditCertificate: (cert: Certificate) => void;
  onDeleteCertificate: (id: string | string[]) => void;
  navigate: (path: string) => void;
}

interface CertificateGroup {
  id: string;
  isBulk: boolean;
  programName: string;
  certificateType: string;
  issueDate: string;
  createdAt: string;
  certificates: Certificate[];
}

export default function OldCertificates({
  certificates,
  settings,
  onSelectCertificate,
  onEditCertificate,
  onDeleteCertificate,
  navigate
}: OldCertificatesProps) {
  const [search, setSearch] = useState('');
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  
  // State for the Bulk Group Hub modal
  const [selectedBulkGroup, setSelectedBulkGroup] = useState<CertificateGroup | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [bulkCandidateSearch, setBulkCandidateSearch] = useState('');

  // Group certificates by bulk run
  const groups = useMemo(() => {
    const map = new Map<string, CertificateGroup>();

    certificates.forEach(cert => {
      let groupKey = '';
      if (cert.bulkGroupId) {
        groupKey = cert.bulkGroupId;
      } else if (cert.id.startsWith('cert_bulk_')) {
        // Legacy bulk group resolution
        const parts = cert.id.split('_');
        const timestamp = parts[2];
        if (timestamp && !isNaN(Number(timestamp))) {
          // Group certificates created within 10 seconds of each other with the same program name
          const roundedTime = Math.round(Number(timestamp) / 10000) * 10000;
          groupKey = `legacy_bulk_${roundedTime}_${cert.programName}`;
        } else {
          groupKey = `legacy_bulk_${cert.createdAt}_${cert.programName}`;
        }
      }

      if (groupKey) {
        const existing = map.get(groupKey);
        if (existing) {
          existing.certificates.push(cert);
        } else {
          map.set(groupKey, {
            id: groupKey,
            isBulk: true,
            programName: cert.programName,
            certificateType: cert.certificateType,
            issueDate: cert.issueDate,
            createdAt: cert.createdAt,
            certificates: [cert]
          });
        }
      } else {
        // Single certificate gets its own isolated group
        map.set(cert.id, {
          id: cert.id,
          isBulk: false,
          programName: cert.programName,
          certificateType: cert.certificateType,
          issueDate: cert.issueDate,
          createdAt: cert.createdAt,
          certificates: [cert]
        });
      }
    });

    const list = Array.from(map.values());

    // Filter groups based on main search
    const term = search.toLowerCase();
    if (!term) {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const filteredList = list.filter(g => {
      if (g.programName.toLowerCase().includes(term) || g.certificateType.toLowerCase().includes(term)) {
        return true;
      }

      // Check inner individual candidates
      return g.certificates.some(c => 
        c.candidateName.toLowerCase().includes(term) ||
        c.certificateId.toLowerCase().includes(term) ||
        (c.candidateEmail && c.candidateEmail.toLowerCase().includes(term))
      );
    });

    return filteredList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [certificates, search]);

  // Handle deletion triggers
  const handleDeleteClick = (ids: string[]) => {
    setConfirmDeleteIds(ids);
  };

  const executeDelete = () => {
    if (confirmDeleteIds) {
      onDeleteCertificate(confirmDeleteIds);
      
      // If we deleted the current active bulk group, close it
      if (selectedBulkGroup) {
        const remainingGroupCerts = selectedBulkGroup.certificates.filter(
          c => !confirmDeleteIds.includes(c.id)
        );
        if (remainingGroupCerts.length === 0) {
          setSelectedBulkGroup(null);
          setSelectedCandidateId(null);
        } else {
          setSelectedBulkGroup({
            ...selectedBulkGroup,
            certificates: remainingGroupCerts
          });
          // Ensure selectedCandidate is still in the group
          if (selectedCandidateId && confirmDeleteIds.includes(selectedCandidateId)) {
            setSelectedCandidateId(remainingGroupCerts[0].id);
          }
        }
      }
      
      setConfirmDeleteIds(null);
    }
  };

  // Candidates in active bulk group filtered by sub-search
  const filteredBulkCandidates = useMemo(() => {
    if (!selectedBulkGroup) return [];
    const term = bulkCandidateSearch.toLowerCase();
    if (!term) return selectedBulkGroup.certificates;
    return selectedBulkGroup.certificates.filter(c => 
      c.candidateName.toLowerCase().includes(term) || 
      c.certificateId.toLowerCase().includes(term) ||
      (c.candidateEmail && c.candidateEmail.toLowerCase().includes(term))
    );
  }, [selectedBulkGroup, bulkCandidateSearch]);

  // Selected candidate object in bulk preview
  const activeCandidate = useMemo(() => {
    if (!selectedBulkGroup) return null;
    const certId = selectedCandidateId || (selectedBulkGroup.certificates[0]?.id);
    return selectedBulkGroup.certificates.find(c => c.id === certId) || selectedBulkGroup.certificates[0] || null;
  }, [selectedBulkGroup, selectedCandidateId]);

  // Scroll to a specific certificate page inside the bulk container
  const scrollToCertificate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    const container = document.getElementById('bulk-preview-scroll-container');
    const element = document.getElementById(`cert-page-${candidateId}`);
    if (container && element) {
      const containerTop = container.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const relativeTop = elementTop - containerTop + container.scrollTop;
      
      container.scrollTo({
        top: relativeTop - 24, // pad slightly at the top
        behavior: 'smooth'
      });
    }
  };

  // Sync scroll position with left list selection using IntersectionObserver
  React.useEffect(() => {
    if (!selectedBulkGroup) return;

    // Use a short delay to ensure elements are mounted in the DOM
    const timer = setTimeout(() => {
      const container = document.getElementById('bulk-preview-scroll-container');
      if (!container) return;

      const observerOptions = {
        root: container,
        rootMargin: '-30% 0px -30% 0px', // focused center region
        threshold: 0.1,
      };

      const handleIntersection = (entries: IntersectionObserverEntry[]) => {
        const intersecting = entries.find(entry => entry.isIntersecting);
        if (intersecting) {
          const id = intersecting.target.id.replace('cert-page-', '');
          setSelectedCandidateId(id);
        }
      };

      const observer = new IntersectionObserver(handleIntersection, observerOptions);

      filteredBulkCandidates.forEach((c) => {
        const el = document.getElementById(`cert-page-${c.id}`);
        if (el) observer.observe(el);
      });

      return () => {
        observer.disconnect();
      };
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedBulkGroup, filteredBulkCandidates]);

  // Exporting / Download states
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportType, setExportType] = useState<'separate' | 'combined'>('combined');
  const [activeExportCandidate, setActiveExportCandidate] = useState<Certificate | null>(null);
  const offscreenRef = useRef<HTMLDivElement>(null);

  // Single PDF download function
  const downloadSinglePDF = async (c: Certificate) => {
    try {
      setExportingId(c.id);
      setActiveExportCandidate(c);
      
      // Wait for React to render the off-screen component
      await new Promise(resolve => setTimeout(resolve, 300));

      const certElement = offscreenRef.current;
      if (!certElement) {
        throw new Error("Offscreen capture element not found");
      }

      // Capture the certificate preview div as a high-quality image
      const canvas = await html2canvas(certElement, {
        scale: 3, // High-quality display rendering
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFFFFF',
        logging: false,
        width: 1122.52, // 297mm landscape width in pixels
        height: 793.7, // 210mm landscape height in pixels
        windowWidth: 1122.52,
        windowHeight: 793.7,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      
      const fileName = `LihaTech_Certificate_${c.candidateName.replace(/\s+/g, '_')}_${c.certificateId}.pdf`;
      const pdfBlob = pdf.output('blob');
      saveAs(pdfBlob, fileName);
    } catch (err) {
      console.error('Failed to generate Certificate PDF', err);
    } finally {
      setActiveExportCandidate(null);
      setExportingId(null);
    }
  };

  // Bulk PDF download function (Generates single combined multi-page PDF or ZIP of separate individual PDFs)
  const downloadAllPDF = async () => {
    if (!selectedBulkGroup || filteredBulkCandidates.length === 0) return;
    
    try {
      setExportingAll(true);
      
      if (exportType === 'combined') {
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });
        
        for (let i = 0; i < filteredBulkCandidates.length; i++) {
          const c = filteredBulkCandidates[i];
          setActiveExportCandidate(c);
          
          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const certElement = offscreenRef.current;
          if (!certElement) continue;

          const canvas = await html2canvas(certElement, {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: 1122.52,
            height: 793.7,
            windowWidth: 1122.52,
            windowHeight: 793.7,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          });
          
          const imgData = canvas.toDataURL('image/png');
          
          if (i > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
        }
        
        const groupName = selectedBulkGroup.programName.replace(/\s+/g, '_');
        const fileName = `LihaTech_Bulk_Certificates_${groupName}_${selectedBulkGroup.issueDate}.pdf`;
        const pdfBlob = pdf.output('blob');
        saveAs(pdfBlob, fileName);
      } else {
        // ZIP export mode (All Separate PDFs in a ZIP archive)
        const zip = new JSZip();
        
        for (let i = 0; i < filteredBulkCandidates.length; i++) {
          const c = filteredBulkCandidates[i];
          setActiveExportCandidate(c);
          
          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const certElement = offscreenRef.current;
          if (!certElement) continue;

          const canvas = await html2canvas(certElement, {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: 1122.52,
            height: 793.7,
            windowWidth: 1122.52,
            windowHeight: 793.7,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          });
          
          const imgData = canvas.toDataURL('image/png');
          
          const singlePdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          singlePdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
          
          const pdfBlob = singlePdf.output('blob');
          const fileName = `Certificate_${c.candidateName.replace(/\s+/g, '_')}_${c.certificateId}.pdf`;
          zip.file(fileName, pdfBlob);
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const groupName = selectedBulkGroup.programName.replace(/\s+/g, '_');
        saveAs(content, `LihaTech_Bulk_Certificates_${groupName}_${selectedBulkGroup.issueDate}.zip`);
      }
    } catch (err) {
      console.error('Failed to generate bulk certificates PDF', err);
    } finally {
      setActiveExportCandidate(null);
      setExportingAll(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in py-4 max-w-5xl mx-auto" id="old-certificates-page">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-850">
        <div>
          <span className="text-xxs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest block">Certificate Registry</span>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Issued Certificate Archive</h2>
        </div>
        
        {/* Sub Navigation Button Group */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/certificate/old')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#6D1F2A] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-default transition-all shadow-sm"
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
          <button
            onClick={() => navigate('/certificate/bulk')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-[#6D1F2A] hover:text-white dark:hover:bg-[#6D1F2A] text-slate-700 dark:text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Bulk Generation</span>
          </button>
        </div>
      </div>

      {/* Filter and Search board */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by candidate name, certificate ID, program, or type..."
          className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-3 text-xs text-gray-900 dark:text-white font-medium shadow-xs outline-none focus:border-amber-500/50 transition-all"
        />
      </div>

      {/* Grid of certificate items / Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {groups.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">
              <Award className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">No certificates found matching current records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-850 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-extrabold text-xxs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Certificate ID</th>
                  <th className="px-6 py-4">Candidate Name</th>
                  <th className="px-6 py-4">Program Name</th>
                  <th className="px-6 py-4">Certificate Type</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-850 font-medium text-slate-700 dark:text-slate-300">
                {groups.map((group) => {
                  if (group.isBulk) {
                    const firstCert = group.certificates[0];
                    const count = group.certificates.length;
                    const candidatesList = group.certificates.map(c => c.candidateName).slice(0, 2).join(', ');
                    const candidatesLabel = count > 2 ? `${candidatesList} + ${count - 2} more` : candidatesList;
                    const allIds = group.certificates.map(c => c.id);

                    return (
                      <tr key={group.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all bg-amber-500/[0.02] dark:bg-amber-500/[0.01]">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold uppercase tracking-wide">
                            <Layers className="h-3 w-3" />
                            Bulk ({count})
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-gray-900 dark:text-white max-w-[200px] truncate">{candidatesLabel}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Bulk Generation Batch</div>
                        </td>
                        <td className="px-6 py-4 max-w-[200px] truncate">{group.programName}</td>
                        <td className="px-6 py-4 text-slate-500">{group.certificateType}</td>
                        <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono">{group.issueDate}</td>
                        <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedBulkGroup(group);
                              setSelectedCandidateId(group.certificates[0]?.id || null);
                              setBulkCandidateSearch('');
                            }}
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 cursor-pointer transition-colors"
                            title="Open Bulk Preview Hub"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(allIds)}
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                            title="Delete Entire Bulk Group"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  } else {
                    const cert = group.certificates[0];
                    return (
                      <tr key={cert.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white font-mono">{cert.certificateId}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white max-w-[150px] truncate">{cert.candidateName}</div>
                          {cert.candidateEmail && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[150px]">{cert.candidateEmail}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-[200px] truncate">{cert.programName}</td>
                        <td className="px-6 py-4 text-slate-500">{cert.certificateType}</td>
                        <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono">{cert.issueDate}</td>
                        <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => onSelectCertificate(cert)}
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                            title="View Certificate"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEditCertificate(cert)}
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 cursor-pointer transition-colors"
                            title="Edit Certificate"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick([cert.id])}
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                            title="Delete Certificate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup Overlay */}
      {confirmDeleteIds && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
              {confirmDeleteIds.length > 1 ? 'Confirm Bulk Deletion?' : 'Confirm Permanent Deletion?'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {confirmDeleteIds.length > 1 
                ? `Are you absolutely sure you want to delete all ${confirmDeleteIds.length} certificates in this batch? This operation cannot be undone.` 
                : 'Are you absolutely sure you want to delete this certificate? This operation cannot be undone.'
              }
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
                className="px-4 py-2 rounded-xl bg-[#6D1F2A] text-white font-bold text-xs cursor-pointer hover:bg-[#5E1B24]"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ENTRY PREVIEW HUB MODAL */}
      {selectedBulkGroup && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[96vw] xl:max-w-[1600px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh] border border-gray-200 dark:border-slate-800 animate-zoom-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="p-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-2xl flex-shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white truncate">
                      Bulk Certificate Group Hub
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#6D1F2A]/10 text-[#6D1F2A] dark:text-rose-400 dark:bg-rose-900/20 rounded-md flex-shrink-0">
                      {selectedBulkGroup.certificates.length} candidates
                    </span>
                  </div>
                  <p className="text-xxs text-slate-500 dark:text-slate-400 font-medium truncate">
                    Program: <span className="font-bold">{selectedBulkGroup.programName}</span> | Date: {selectedBulkGroup.issueDate}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2.5 ml-4">
                {/* Export Type Selector */}
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Export Type:</span>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value as 'separate' | 'combined')}
                    disabled={exportingId !== null || exportingAll}
                    className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer focus:outline-hidden"
                  >
                    <option value="combined">Combined Multi-page PDF</option>
                    <option value="separate">ZIP (All Separate PDFs)</option>
                  </select>
                </div>

                {/* Download Selected Button */}
                {activeCandidate && (
                  <button
                    onClick={() => downloadSinglePDF(activeCandidate)}
                    disabled={exportingId !== null || exportingAll}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <Download className={`h-3.5 w-3.5 text-rose-600 dark:text-rose-400 ${exportingId === activeCandidate.id ? 'animate-bounce' : ''}`} />
                    <span>
                      {exportingId === activeCandidate.id ? 'Downloading...' : 'Download Selected'}
                    </span>
                  </button>
                )}

                {/* Download All Button */}
                <button
                  onClick={downloadAllPDF}
                  disabled={exportingId !== null || exportingAll}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#6D1F2A] hover:bg-[#5C1A23] text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Download className={`h-3.5 w-3.5 text-white ${exportingAll ? 'animate-bounce' : ''}`} />
                  <span>
                    {exportingAll 
                      ? 'Compiling All...' 
                      : exportType === 'combined' 
                        ? 'Download All PDF' 
                        : 'Download All ZIP'
                    }
                  </span>
                </button>

                <div className="h-5 w-[1px] bg-gray-200 dark:bg-slate-800 mx-1" />

                <button
                  onClick={() => {
                    setSelectedBulkGroup(null);
                    setSelectedCandidateId(null);
                  }}
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Two Column Workspace */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Column: Candidates list */}
              <div className="w-[260px] flex-shrink-0 border-r border-gray-150 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/5 flex flex-col">
                {/* Local search in bulk group */}
                <div className="p-4 border-b border-gray-150 dark:border-slate-800">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      value={bulkCandidateSearch}
                      onChange={(e) => setBulkCandidateSearch(e.target.value)}
                      placeholder="Search batch candidates..."
                      className="block w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs text-gray-900 dark:text-white font-medium outline-none focus:border-amber-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Candidate list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredBulkCandidates.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                      No matching candidates.
                    </div>
                  ) : (
                    filteredBulkCandidates.map((c) => {
                      const isSelected = activeCandidate?.id === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => scrollToCertificate(c.id)}
                          className={`group w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#6D1F2A] text-white shadow-md shadow-[#6D1F2A]/10'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                              {c.candidateName}
                            </p>
                            <p className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-rose-200' : 'text-slate-400 dark:text-slate-500'}`}>
                              {c.certificateId}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBulkGroup(null);
                                onEditCertificate(c);
                              }}
                              className={`p-1.5 rounded-md cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-white/10 hover:bg-white/20 text-white' 
                                  : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400'
                              }`}
                              title="Edit candidate certificate"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick([c.id]);
                              }}
                              className={`p-1.5 rounded-md cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-white/10 hover:bg-white/20 text-white' 
                                  : 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400'
                              }`}
                              title="Remove from batch"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Live Workspace/Preview */}
              <div 
                id="bulk-preview-scroll-container"
                className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto"
              >
                {filteredBulkCandidates.length > 0 ? (
                  <div className="flex flex-col items-center gap-12 py-10 px-6">
                    {filteredBulkCandidates.map((c, index) => {
                      const isSelected = selectedCandidateId ? selectedCandidateId === c.id : index === 0;
                      return (
                        <div 
                          key={c.id}
                          id={`cert-page-${c.id}`}
                          className={`flex flex-col items-center gap-3 w-full scroll-mt-6 transition-all duration-300 ${
                            isSelected ? 'opacity-100 scale-100' : 'opacity-85 scale-98'
                          }`}
                        >
                          {/* Page Label Indicator */}
                          <div className={`flex items-center space-x-2 border px-4 py-1.5 rounded-full shadow-xs text-xs font-bold transition-all duration-300 ${
                            isSelected 
                              ? 'bg-[#6D1F2A] border-[#6D1F2A]/30 text-white shadow-md' 
                              : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/50 text-gray-900 dark:text-white'
                          }`}>
                            <span className={`text-[10px] uppercase font-extrabold tracking-wider ${
                              isSelected ? 'text-rose-200' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              Page {index + 1} of {filteredBulkCandidates.length}
                            </span>
                            <span className="opacity-30">|</span>
                            <span>{c.candidateName}</span>
                            <span className="text-[10px] font-mono opacity-60">({c.certificateId})</span>
                            <span className="opacity-30">|</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadSinglePDF(c);
                              }}
                              disabled={exportingId !== null || exportingAll}
                              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                                isSelected 
                                  ? 'bg-white/15 hover:bg-white/25 text-white' 
                                  : 'bg-rose-50 hover:bg-rose-105 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400'
                              }`}
                              title="Download this certificate"
                            >
                              <Download className={`h-2.5 w-2.5 ${exportingId === c.id ? 'animate-bounce' : ''}`} />
                              <span>{exportingId === c.id ? 'Downloading...' : 'Download'}</span>
                            </button>
                          </div>

                          {/* Certificate Wrapper */}
                          <div 
                            className="w-fit mx-auto flex justify-center origin-center transition-transform duration-300" 
                            style={{ transform: 'scale(0.8)', transformOrigin: 'center center' }}
                          >
                            <CertificatePreview 
                              certificate={c} 
                              settings={settings} 
                              showActions={false} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-gray-100 dark:bg-slate-900 rounded-full text-slate-400">
                      <Award className="h-8 w-8 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">No Certificates</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">There are no certificates matching your search filters.</p>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>,
        document.body
      )}
      {/* OFF-SCREEN CAPTURE AREA FOR PERFECT HIGH-QUALITY PDF GENERATION */}
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
        {activeExportCandidate && (
          <CertificatePreview 
            certificate={activeExportCandidate} 
            settings={settings} 
            showActions={false} 
            renderOnlySheet={true}
            divRef={offscreenRef}
          />
        )}
      </div>

    </div>
  );
}
