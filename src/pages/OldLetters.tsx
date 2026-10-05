import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  Mail,
  X,
  FileText,
  Calendar,
  Briefcase,
  Building
} from 'lucide-react';
import { Letter, CompanySettings } from '../types';
import LetterPreview from '../components/letter/LetterPreview';

interface OldLettersProps {
  letters: Letter[];
  settings: CompanySettings;
  onEditLetter: (letter: Letter) => void;
  onDeleteLetter: (id: string) => void;
  navigate: (path: string) => void;
}

export default function OldLetters({
  letters,
  settings,
  onEditLetter,
  onDeleteLetter,
  navigate
}: OldLettersProps) {
  const [search, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter letters based on search query
  const filteredLetters = useMemo(() => {
    return letters.filter(letter => {
      const query = search.toLowerCase();
      return (
        letter.candidateName.toLowerCase().includes(query) ||
        letter.designation.toLowerCase().includes(query) ||
        letter.department.toLowerCase().includes(query) ||
        letter.letterType.toLowerCase().includes(query)
      );
    });
  }, [letters, search]);

  const handleDelete = (id: string) => {
    onDeleteLetter(id);
    setConfirmDeleteId(null);
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'Internship Offer':
        return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/40';
      case 'Job Offer':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40';
      case 'Relieving Letter':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/40';
      default:
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-500 border border-amber-200/40';
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

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto py-6" id="old-letters-dashboard">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6 text-indigo-500" />
            <span>Official Letter Records</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search, preview, and print archived Internship Offer Letters, Job Offer Letters, Experience Certificates, and Relieving Letters.
          </p>
        </div>
        <button
          onClick={() => navigate('/letter/new')}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New HR Letter</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee name, department, role, or layout..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* Grid List View of Letters */}
      {filteredLetters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLetters.map((letter) => (
            <div 
              key={letter.id}
              className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${getBadgeStyle(letter.letterType)}`}>
                    {letter.letterType}
                  </span>
                  <span className="text-xxs font-mono text-slate-400 dark:text-slate-500">
                    ID: {letter.id.slice(-4).toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1.5 text-left">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight truncate">
                    {letter.candidateName}
                  </h3>
                  
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{letter.designation}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{letter.department}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Issue Date: {formatDate(letter.issueDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setSelectedLetter(letter)}
                  className="inline-flex items-center space-x-1 text-xxs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEditLetter(letter)}
                    className="p-1.5 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg cursor-pointer transition-colors border border-gray-100 dark:border-slate-700"
                    title="Edit Record"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(letter.id)}
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
            <Mail className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">No Corporate Letters Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search ? 'No results matched your search query. Try clearing filters or refining terms.' : 'Draft Internship offers, job packages, and experience certificates using standard letterheads.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => navigate('/letter/new')}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Draft First Letter</span>
            </button>
          )}
        </div>
      )}

      {/* PORTAL: Overlay Detailed Document Preview Modal */}
      {selectedLetter && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedLetter(null)}
        >
          <div 
            className="w-full h-full max-w-none animate-zoom-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <LetterPreview 
              letter={selectedLetter}
              settings={settings}
              onClose={() => setSelectedLetter(null)}
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
                Are you absolutely sure you want to delete this corporate letter? This action cannot be undone, and the history record will be permanently removed.
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
