import React, { useRef, useState, useEffect } from 'react';
import { 
  Download, 
  Printer, 
  Award, 
  Check, 
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Palette,
  Loader2,
  Edit3,
  Type,
  Minus,
  Plus,
  Sliders
} from 'lucide-react';
import { Certificate, CertificateLayout, CertificateLayoutElement, CertificateLayoutElementStyle, CompanySettings } from '../../types';
import { 
  getDefaultCompletionText, 
  COMPLETION_PRESETS, 
  getCertificateSubtitle, 
  getDefaultCertificateDescription,
  DEFAULT_PRESENTATION_TEXT,
  PRESENTATION_PRESETS,
  DEFAULT_DATE_LINE_TEXT,
  DATE_LINE_PRESETS,
  getFormattedDateLine,
  getAutoProgramFontSize,
  getProgramFontSizeStyle,
  PROGRAM_FONT_SIZE_PRESETS
} from '../../utils/certificateUtils';
import html2canvas from '../../lib/html2canvas-patch';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import royalBg from '../../../Certificate BG.png';
import emeraldBg from '../../../Certificate BG Green.png';
import academicBg from '../../../Certificate BG Teal.png';
import modernBlueBg from '../../../Certificate BG Blue.png';

interface CertificatePreviewProps {
  certificate: Certificate;
  settings: CompanySettings;
  onClose?: () => void;
  showActions?: boolean;
  renderOnlySheet?: boolean;
  divRef?: React.RefObject<HTMLDivElement>;
  onUpdateCertificate?: (cert: Certificate) => void;
  enableLayoutEditing?: boolean;
  layoutEditing?: boolean;
  onLayoutEditingChange?: (editing: boolean) => void;
  selectedLayoutElement?: CertificateLayoutElement | null;
  onSelectedLayoutElementChange?: (element: CertificateLayoutElement | null) => void;
  showLayoutControls?: boolean;
}

const DEFAULT_ELEMENT_SIZES: Record<CertificateLayoutElement, { width: number; height: number }> = {
  issuer: { width: 320, height: 112 },
  partner: { width: 260, height: 100 },
  title: { width: 760, height: 100 },
  presentation: { width: 560, height: 34 },
  candidate: { width: 700, height: 96 },
  completion: { width: 700, height: 42 },
  program: { width: 760, height: 72 },
  date: { width: 500, height: 34 },
  organizer: { width: 700, height: 36 },
  description: { width: 600, height: 96 },
  badge: { width: 160, height: 160 },
  certificateId: { width: 220, height: 80 },
  stamp: { width: 190, height: 190 },
  issueDate: { width: 220, height: 80 },
  signature: { width: 190, height: 110 }
};

const getCertificateElementLabel = (key: CertificateLayoutElement) => ({
  issuer: 'Company logo',
  partner: 'Partner logo',
  title: 'Certificate title',
  presentation: 'Presentation line',
  candidate: 'Candidate name',
  completion: 'Completion line',
  program: 'Program title',
  date: 'Date line',
  organizer: 'Organizer line',
  description: 'Description',
  badge: 'Completion badge',
  certificateId: 'Certificate ID',
  stamp: 'Stamp',
  issueDate: 'Date of issue',
  signature: 'Signature'
}[key]);

export interface CertificateLayoutControlsProps {
  certificateLayout: CertificateLayout;
  selectedElement: CertificateLayoutElement | null;
  onSelectElement: (element: CertificateLayoutElement | null) => void;
  onUpdateLayout: (layout: CertificateLayout) => void;
  onResetLayout?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  disabled?: boolean;
}

export function CertificateLayoutControls({
  certificateLayout,
  selectedElement,
  onSelectElement,
  onUpdateLayout,
  onResetLayout,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  disabled = false
}: CertificateLayoutControlsProps) {
  const getOffset = (key: CertificateLayoutElement) => certificateLayout.offsets[key] || { x: 0, y: 0 };
  const getSize = (key: CertificateLayoutElement) => certificateLayout.sizes?.[key] || DEFAULT_ELEMENT_SIZES[key];
  const getStyle = (key: CertificateLayoutElement): CertificateLayoutElementStyle => certificateLayout.styles?.[key] || {};
  const selectedSizePercent = selectedElement
    ? Math.round(Math.min(
        getSize(selectedElement).width / DEFAULT_ELEMENT_SIZES[selectedElement].width,
        getSize(selectedElement).height / DEFAULT_ELEMENT_SIZES[selectedElement].height
      ) * 100)
    : 100;

  const updateSelectedOffset = (x: number, y: number) => {
    if (!selectedElement) return;
    const offset = getOffset(selectedElement);
    onUpdateLayout({
      offsets: {
        ...certificateLayout.offsets,
        [selectedElement]: { x: offset.x + x, y: offset.y + y }
      },
      sizes: certificateLayout.sizes
    });
  };

  const resizeSelectedElement = (scalePercent: number) => {
    if (!selectedElement) return;
    const defaultSize = DEFAULT_ELEMENT_SIZES[selectedElement];
    const factor = scalePercent / 100;
    onUpdateLayout({
      offsets: certificateLayout.offsets,
      sizes: {
        ...certificateLayout.sizes,
        [selectedElement]: {
          width: Math.round(defaultSize.width * factor),
          height: Math.round(defaultSize.height * factor)
        }
      }
    });
  };

  const centerSelectedElement = () => {
    if (!selectedElement) return;
    onUpdateLayout({
      offsets: { ...certificateLayout.offsets, [selectedElement]: { x: 0, y: getOffset(selectedElement).y } },
      sizes: certificateLayout.sizes
    });
  };

  const updateSelectedStyle = (nextStyle: CertificateLayoutElementStyle) => {
    if (!selectedElement) return;
    onUpdateLayout({
      offsets: certificateLayout.offsets,
      sizes: certificateLayout.sizes,
      styles: {
        ...certificateLayout.styles,
        [selectedElement]: { ...getStyle(selectedElement), ...nextStyle }
      }
    });
  };

  const isTextElement = selectedElement && !['issuer', 'partner', 'badge', 'stamp'].includes(selectedElement);
  const controlsDisabled = disabled || !selectedElement;

  return (
    <aside className={`w-64 shrink-0 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm ${disabled ? 'opacity-60 grayscale' : ''}`} aria-disabled={disabled}>
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Selected element</p>
        {disabled ? (
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Turn on Design Mode to edit the layout.</p>
        ) : selectedElement ? (
          <h4 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{getCertificateElementLabel(selectedElement)}</h4>
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Click any certificate element to edit it.</p>
        )}
      </div>

      {selectedElement && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Move</p>
            <div className="mx-auto grid w-fit grid-cols-3 gap-1.5">
              <span />
              <button type="button" disabled={controlsDisabled} aria-label="Move up" onClick={() => updateSelectedOffset(0, -5)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#078EDB] hover:text-[#078EDB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><ArrowUp className="h-4 w-4" /></button>
              <span />
              <button type="button" disabled={controlsDisabled} aria-label="Move left" onClick={() => updateSelectedOffset(-5, 0)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#078EDB] hover:text-[#078EDB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /></button>
              <button type="button" disabled={controlsDisabled} aria-label="Center horizontally" onClick={centerSelectedElement} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#078EDB]/40 bg-[#078EDB]/10 text-[#07547e] hover:bg-[#078EDB]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300">C</button>
              <button type="button" disabled={controlsDisabled} aria-label="Move right" onClick={() => updateSelectedOffset(5, 0)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#078EDB] hover:text-[#078EDB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><ArrowRight className="h-4 w-4" /></button>
              <span />
              <button type="button" disabled={controlsDisabled} aria-label="Move down" onClick={() => updateSelectedOffset(0, 5)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#078EDB] hover:text-[#078EDB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><ArrowDown className="h-4 w-4" /></button>
              <span />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Size</p>
              <span className="text-xs font-bold text-[#07547e] dark:text-sky-300">{selectedSizePercent}%</span>
            </div>
            <input
              aria-label="Element size"
              disabled={controlsDisabled}
              type="range"
              min="50"
              max="300"
              value={Math.min(300, Math.max(50, selectedSizePercent))}
              onChange={(event) => resizeSelectedElement(Number(event.target.value))}
              className="w-full accent-[#078EDB]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Smaller</span><span>Larger</span></div>
          </div>

          <button type="button" disabled={controlsDisabled} onClick={centerSelectedElement} className="w-full rounded-lg border border-[#078EDB]/40 bg-[#078EDB]/10 px-3 py-2 text-xs font-bold text-[#07547e] hover:bg-[#078EDB]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300">Center horizontally</button>

          {isTextElement && (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Text formatting</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={controlsDisabled} aria-label="Bold" onClick={() => updateSelectedStyle({ fontWeight: getStyle(selectedElement).fontWeight === 'bold' ? 'normal' : 'bold' })} className={`flex h-10 w-10 items-center justify-center rounded-lg border ${getStyle(selectedElement).fontWeight === 'bold' ? 'border-[#078EDB] bg-[#078EDB]/10 text-[#07547e]' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}><Bold className="h-4 w-4" /></button>
                <button type="button" disabled={controlsDisabled} aria-label="Italic" onClick={() => updateSelectedStyle({ fontStyle: getStyle(selectedElement).fontStyle === 'italic' ? 'normal' : 'italic' })} className={`flex h-10 w-10 items-center justify-center rounded-lg border ${getStyle(selectedElement).fontStyle === 'italic' ? 'border-[#078EDB] bg-[#078EDB]/10 text-[#07547e]' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}><Italic className="h-4 w-4" /></button>
                <button type="button" disabled={controlsDisabled} aria-label="Align left" onClick={() => updateSelectedStyle({ textAlign: 'left' })} className={`flex h-10 w-10 items-center justify-center rounded-lg border ${getStyle(selectedElement).textAlign === 'left' ? 'border-[#078EDB] bg-[#078EDB]/10 text-[#07547e]' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}><AlignLeft className="h-4 w-4" /></button>
                <button type="button" disabled={controlsDisabled} aria-label="Align center" onClick={() => updateSelectedStyle({ textAlign: 'center' })} className={`flex h-10 w-10 items-center justify-center rounded-lg border ${(!getStyle(selectedElement).textAlign || getStyle(selectedElement).textAlign === 'center') ? 'border-[#078EDB] bg-[#078EDB]/10 text-[#07547e]' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}><AlignCenter className="h-4 w-4" /></button>
                <button type="button" disabled={controlsDisabled} aria-label="Align right" onClick={() => updateSelectedStyle({ textAlign: 'right' })} className={`flex h-10 w-10 items-center justify-center rounded-lg border ${getStyle(selectedElement).textAlign === 'right' ? 'border-[#078EDB] bg-[#078EDB]/10 text-[#07547e]' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}><AlignRight className="h-4 w-4" /></button>
              </div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Line spacing: {getStyle(selectedElement).lineHeight?.toFixed(1) || '1.5'}
                <input
                  disabled={controlsDisabled}
                  aria-label="Line spacing"
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={getStyle(selectedElement).lineHeight || 1.5}
                  onChange={(event) => updateSelectedStyle({ lineHeight: Number(event.target.value) })}
                  className="mt-2 w-full accent-[#078EDB]"
                />
              </label>
            </div>
          )}

          {onUndo && onRedo && (
            <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button type="button" onClick={onUndo} disabled={disabled || !canUndo} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 enabled:hover:border-[#078EDB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
              <button type="button" onClick={onRedo} disabled={disabled || !canRedo} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 enabled:hover:border-[#078EDB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Redo2 className="h-3.5 w-3.5" /> Redo</button>
            </div>
          )}

          {onResetLayout && (
            <button type="button" disabled={disabled} onClick={onResetLayout} className="w-full rounded-lg border border-[#6D1F2A]/30 bg-[#6D1F2A]/5 px-3 py-2 text-xs font-bold text-[#6D1F2A] hover:bg-[#6D1F2A]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300">Reset full layout</button>
          )}
          <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">Drag the selected element for fine positioning. Changes are saved automatically.</p>
        </div>
      )}
    </aside>
  );
}

export default function CertificatePreview({ 
  certificate, 
  settings, 
  onClose, 
  showActions = true,
  renderOnlySheet = false,
  divRef,
  onUpdateCertificate,
  enableLayoutEditing = false,
  layoutEditing: controlledLayoutEditing,
  onLayoutEditingChange,
  selectedLayoutElement: controlledSelectedElement,
  onSelectedLayoutElementChange,
  showLayoutControls = true
}: CertificatePreviewProps) {
  const certRef = useRef<HTMLDivElement>(null);
  const offscreenCertRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(showActions ? 1.0 : 0.8);
  const [statement, setStatement] = useState(
    certificate.completionText || getDefaultCompletionText(certificate.certificateType)
  );
  const [presentation, setPresentation] = useState(
    certificate.presentationText || DEFAULT_PRESENTATION_TEXT
  );
  const [dateLine, setDateLine] = useState(
    getFormattedDateLine(certificate)
  );
  const [programTitle, setProgramTitle] = useState(
    certificate.programName || ''
  );
  const [programFontSize, setProgramFontSize] = useState<number>(
    certificate.programFontSize || 0
  );
  const [showStatementEditor, setShowStatementEditor] = useState(false);
  const [internalLayoutEditing, setInternalLayoutEditing] = useState(false);
  const [internalSelectedElement, setInternalSelectedElement] = useState<CertificateLayoutElement | null>(null);
  const layoutEditing = controlledLayoutEditing ?? internalLayoutEditing;
  const selectedElement = controlledSelectedElement !== undefined ? controlledSelectedElement : internalSelectedElement;
  const setLayoutEditingValue = (editing: boolean) => {
    onLayoutEditingChange?.(editing);
    if (!onLayoutEditingChange) setInternalLayoutEditing(editing);
  };
  const setSelectedElementValue = (element: CertificateLayoutElement | null) => {
    onSelectedLayoutElementChange?.(element);
    if (!onSelectedLayoutElementChange) setInternalSelectedElement(element);
  };
  const [certificateLayout, setCertificateLayout] = useState<CertificateLayout>(
    certificate.certificateLayout || { offsets: {} }
  );
  const selectedTemplate = certificate.designTemplate || 'royal';
  const dragState = useRef<{
    key: CertificateLayoutElement;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeState = useRef<{
    key: CertificateLayoutElement;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  useEffect(() => {
    setStatement(certificate.completionText || getDefaultCompletionText(certificate.certificateType));
    setPresentation(certificate.presentationText || DEFAULT_PRESENTATION_TEXT);
    setDateLine(getFormattedDateLine(certificate));
    setProgramTitle(certificate.programName || '');
    setProgramFontSize(certificate.programFontSize || 0);
    setCertificateLayout(certificate.certificateLayout || { offsets: {} });
  }, [
    certificate.completionText, 
    certificate.certificateType, 
    certificate.presentationText, 
    certificate.dateLineText, 
    certificate.eventDate, 
    certificate.startDate, 
    certificate.endDate,
    certificate.programName,
    certificate.programFontSize,
    certificate.certificateLayout
  ]);

  useEffect(() => {
    setSelectedElementValue(null);
  }, [certificate.id]);

  const updateLayout = (nextLayout: CertificateLayout) => {
    const normalizedLayout: CertificateLayout = {
      offsets: nextLayout.offsets,
      sizes: nextLayout.sizes ?? certificateLayout.sizes
    };
    setCertificateLayout(normalizedLayout);
    onUpdateCertificate?.({ ...certificate, certificateLayout: normalizedLayout });
  };

  const getOffset = (key: CertificateLayoutElement) => certificateLayout.offsets[key] || (
    key === 'certificateId' && selectedTemplate === 'modern-blue' ? { x: 220, y: 0 } :
    key === 'stamp' && selectedTemplate === 'modern-blue' ? { x: 240, y: 18 } :
    key === 'issuer' && hasPartner ? { x: -180, y: 0 } :
    key === 'partner' ? { x: 180, y: 0 } :
    { x: 0, y: 0 }
  );
  const getSize = (key: CertificateLayoutElement) => certificateLayout.sizes?.[key] || DEFAULT_ELEMENT_SIZES[key];
  const getElementScale = (key: CertificateLayoutElement) => {
    const savedSize = certificateLayout.sizes?.[key];
    if (!savedSize) return 1;
    const defaultSize = DEFAULT_ELEMENT_SIZES[key];
    return Math.max(0.35, Math.min(savedSize.width / defaultSize.width, savedSize.height / defaultSize.height));
  };
  const getElementTextStyle = (key: CertificateLayoutElement): React.CSSProperties => {
    const style = certificateLayout.styles?.[key];
    return {
      ...(style?.fontWeight ? { fontWeight: style.fontWeight } : {}),
      ...(style?.fontStyle ? { fontStyle: style.fontStyle } : {}),
      ...(style?.lineHeight ? { lineHeight: style.lineHeight } : {}),
      ...(style?.textAlign ? { textAlign: style.textAlign } : {})
    };
  };
  const getElementClass = (key: CertificateLayoutElement) => (
    layoutEditing && selectedElement === key ? 'ring-2 ring-[#078EDB]/60 ring-offset-2' : ''
  );
  const getDragStyle = (key: CertificateLayoutElement): React.CSSProperties => {
    const offset = getOffset(key);
    return offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : {};
  };

  const getLayoutBoxStyle = (key: CertificateLayoutElement, top: string): React.CSSProperties => {
    const hasSavedSize = Boolean(certificateLayout.sizes?.[key]);
    if (!layoutEditing && !hasSavedSize) return { top, ...getDragStyle(key) };
    const size = getSize(key);
    return {
      top,
      ...getDragStyle(key),
      width: `${size.width}px`,
      height: `${size.height}px`,
      left: '50%',
      right: 'auto',
      marginLeft: `-${size.width / 2}px`,
      marginRight: 0,
      boxSizing: 'border-box'
    };
  };

  const getFooterBoxStyle = (key: CertificateLayoutElement): React.CSSProperties => {
    const hasSavedSize = Boolean(certificateLayout.sizes?.[key]);
    if (!layoutEditing && !hasSavedSize) return getDragStyle(key);
    const size = getSize(key);
    return {
      ...getDragStyle(key),
      width: `${size.width}px`,
      height: `${size.height}px`,
      flex: '0 0 auto',
      boxSizing: 'border-box'
    };
  };

  const handleLayoutPointerDown = (event: React.PointerEvent, key: CertificateLayoutElement) => {
    if (!layoutEditing) return;
    event.preventDefault();
    setSelectedElementValue(key);
    const offset = getOffset(key);
    dragState.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleLayoutPointerMove = (event: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    const nextOffset = {
      x: Math.round(drag.originX + (event.clientX - drag.startX) / scale),
      y: Math.round(drag.originY + (event.clientY - drag.startY) / scale)
    };
    updateLayout({
      offsets: { ...certificateLayout.offsets, [drag.key]: nextOffset },
      sizes: certificateLayout.sizes
    });
  };

  const handleResizePointerDown = (event: React.PointerEvent, key: CertificateLayoutElement) => {
    if (!layoutEditing) return;
    event.preventDefault();
    event.stopPropagation();
    const size = getSize(key);
    resizeState.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: size.width,
      originHeight: size.height
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (event: React.PointerEvent) => {
    const resize = resizeState.current;
    if (!resize) return;
    const nextSize = {
      width: Math.round(Math.min(1600, Math.max(80, resize.originWidth + (event.clientX - resize.startX) / scale))),
      height: Math.round(Math.min(600, Math.max(24, resize.originHeight + (event.clientY - resize.startY) / scale)))
    };
    updateLayout({
      offsets: certificateLayout.offsets,
      sizes: { ...certificateLayout.sizes, [resize.key]: nextSize }
    });
  };

  const handleResizePointerUp = () => {
    resizeState.current = null;
  };

  const renderResizeHandle = (key: CertificateLayoutElement) => layoutEditing && selectedElement === key ? (
    <span
      role="button"
      aria-label={`Resize ${key}`}
      className="absolute -right-2 -bottom-2 z-30 h-4 w-4 rounded-[2px] bg-[#078EDB] border-2 border-white shadow cursor-nwse-resize"
      onPointerDown={(event) => handleResizePointerDown(event, key)}
      onPointerMove={handleResizePointerMove}
      onPointerUp={handleResizePointerUp}
      onPointerCancel={handleResizePointerUp}
    />
  ) : null;

  const handleLayoutPointerUp = () => {
    dragState.current = null;
  };

  const resetLayout = () => {
    setSelectedElementValue(null);
    updateLayout({ offsets: {}, sizes: {}, styles: {} });
  };

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
      const A4_WIDTH = 1122.52;

      // Inline/embedded: scale based on width only
      const availableWidth = containerWidth - padding;
      const finalScale = availableWidth / A4_WIDTH;
      setScale(Math.min(Math.max(finalScale, 0.15), 1.0));
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

  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setExporting(true);
      
      const safeCandidateName = (certificate.candidateName || 'Candidate')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_');
      
      const fileName = `LihaTech_Certificate_${safeCandidateName}_${certificate.certificateId || 'ID'}.pdf`;

      // Prefer offscreen capture node for perfect unscaled 1:1 crispness
      const targetElement = offscreenCertRef.current || divRef?.current || certRef.current;
      if (!targetElement) {
        throw new Error('Certificate render element not found');
      }

      // Wait for any images within the element to load completely
      const images = targetElement.querySelectorAll('img');
      const imagePromises = Array.from(images).map((imgElement) => {
        const img = imgElement as HTMLImageElement;
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      });
      await Promise.all(imagePromises);
      
      // Small timeout to ensure font and style layout rendering is fully stabilized
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(targetElement, {
        scale: 3, // High-quality 300+ DPI crisp vector-like render
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFFFFF',
        logging: false,
        width: 1122.52, // 297mm in pixels
        height: 793.7,  // 210mm in pixels
        windowWidth: 1122.52,
        windowHeight: 793.7,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      });

      const imgData = canvas.toDataURL('image/png');

      const pdfDoc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      pdfDoc.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      const pdfBlob = pdfDoc.output('blob');
      saveAs(pdfBlob, fileName);
    } catch (error) {
      console.error('Failed to generate certificate PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Styling maps based on chosen template
  const getTemplateStyles = () => {
    switch (selectedTemplate) {
      case 'modern-blue':
        return {
          wrapperBg: 'bg-white',
          borderColor: 'border-[#1E40AF]',
          innerBorderColor: 'border-blue-200',
          textColor: 'text-[#0D1F3D]',
          headingColor: 'text-[#0D1F3D]',
          nameColor: 'text-[#1E40AF]',
          lineColor: 'bg-[#1E40AF]',
          subTitleColor: 'text-[#1E40AF]',
          cornerColor: '#1E40AF',
          badgeGold: '#1D4ED8',
          bgWatermark: 'none',
          corners: true,
        };
      case 'emerald':
        return {
          wrapperBg: 'bg-[#FCFDF9]',
          borderColor: 'border-[#3F633D]',
          innerBorderColor: 'border-[#A8884D]/45',
          textColor: 'text-[#1F2D20]',
          headingColor: 'text-[#355C37]',
          nameColor: 'text-[#355C37]',
          lineColor: 'bg-[#A8884D]',
          subTitleColor: 'text-[#355C37]',
          cornerColor: '#355C37',
          badgeGold: '#A8884D',
          bgWatermark: 'none',
          corners: true,
        };
      case 'academic':
        return {
          wrapperBg: 'bg-[#F7FBFA]',
          borderColor: 'border-[#286C72]',
          innerBorderColor: 'border-[#79B7B3]/45',
          textColor: 'text-[#1F3C40]',
          headingColor: 'text-[#205B61]',
          nameColor: 'text-[#286C72]',
          lineColor: 'bg-[#5E9FA0]',
          subTitleColor: 'text-[#286C72]',
          cornerColor: '#286C72',
          badgeGold: '#5E9FA0',
          bgWatermark: 'none',
          corners: true,
        };
      case 'royal':
      default:
        return {
          wrapperBg: 'bg-[#FCFAF4]', // Warm Ivory
          borderColor: 'border-[#0A0D14]', // Dark elegant black
          innerBorderColor: 'border-[#D6B56D]/60', // Gold inset
          textColor: 'text-slate-900',
          headingColor: 'text-[#4C1019]', // Dark Burgundy
          nameColor: 'text-[#1E40AF]', // Deep Blue
          lineColor: 'bg-[#D6B56D]',
          subTitleColor: 'text-[#D6B56D]',
          cornerColor: '#3B0C13',
          badgeGold: '#D6B56D',
          bgWatermark: 'radial-gradient(circle, rgba(214,181,109,0.04) 0%, rgba(255,255,255,0) 70%)',
          corners: true,
        };
    }
  };

  const styles = getTemplateStyles();
  const backgroundByTemplate = {
    royal: royalBg,
    emerald: emeraldBg,
    academic: academicBg,
    'modern-blue': modernBlueBg,
  } as const;

  const isDefaultLogo = !settings.logoUrl || settings.logoUrl.includes('DEFAULT_LOGO_SVG') || settings.logoUrl.startsWith('data:image/svg+xml');
  const hasPartner = Boolean(certificate.partnerName || certificate.partnerLogoUrl);

  // Auto font-size logic for Candidate name
  const getCandidateFontSize = (name: string) => {
    const len = name.length;
    if (len <= 25) return '46px';
    if (len <= 35) return '38px';
    return '32px';
  };

  // Auto / Custom font-size logic for Program name
  const getProgramFontSize = (name: string, customSize?: number) => {
    const sizeToUse = customSize !== undefined && customSize > 0 ? customSize : programFontSize;
    return getProgramFontSizeStyle(name, sizeToUse);
  };

  const renderSheet = (targetRef?: React.RefObject<HTMLDivElement>) => (
    <div
      ref={targetRef || divRef || certRef}
      id="certificate-print-area"
      className={`relative w-[297mm] h-[210mm] ${styles.textColor} p-12 flex flex-col justify-between selection:bg-amber-100`}
      style={{ 
        width: '297mm', 
        height: '210mm', 
        boxSizing: 'border-box',
        backgroundImage: `url(${backgroundByTemplate[selectedTemplate]})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
          {/* Definitions for Premium Gradients and Patterns */}
          <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
            <defs>
              <linearGradient id="premium-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E8C875" />
                <stop offset="25%" stopColor="#FFF3CD" />
                <stop offset="50%" stopColor="#D6B56D" />
                <stop offset="75%" stopColor="#FFF3CD" />
                <stop offset="100%" stopColor="#A8812D" />
              </linearGradient>
              <linearGradient id="premium-burgundy" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#43080F" />
                <stop offset="50%" stopColor="#250205" />
                <stop offset="100%" stopColor="#120001" />
              </linearGradient>
              <linearGradient id="burgundy-bright" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6E1622" />
                <stop offset="50%" stopColor="#43080F" />
                <stop offset="100%" stopColor="#1E0104" />
              </linearGradient>
              <linearGradient id="blue-wave-deep" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0B1B3D" />
                <stop offset="100%" stopColor="#081026" />
              </linearGradient>
              <linearGradient id="blue-wave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E40AF" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#60A5FA" />
              </linearGradient>
              <linearGradient id="blue-wave-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
              <linearGradient id="corner-blue-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#001240" />
                <stop offset="100%" stopColor="#002780" />
              </linearGradient>
              <linearGradient id="corner-blue-base" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#001860" />
                <stop offset="100%" stopColor="#0033B0" />
              </linearGradient>
              <linearGradient id="corner-blue-medium" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#004BFF" />
                <stop offset="100%" stopColor="#00A3FF" />
              </linearGradient>
              <linearGradient id="corner-blue-light" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0091FF" />
                <stop offset="100%" stopColor="#00E1FF" />
              </linearGradient>
              <linearGradient id="corner-blue-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="100%" stopColor="#00A0FF" />
              </linearGradient>
              <pattern id="premium-gold-dots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="0.95" fill="#E8C875" opacity="0.32" />
              </pattern>
            </defs>
          </svg>

          {/* Certificate Content Flow */}
          <div
            className={`absolute inset-0 w-full h-full z-10 ${layoutEditing ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onPointerMove={handleLayoutPointerMove}
            onPointerUp={handleLayoutPointerUp}
            onPointerCancel={handleLayoutPointerUp}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedElementValue(null);
                dragState.current = null;
              }
            }}
          >
            
            {/* Flexible issuer header: show LihaTech alone or alongside a partner institute. */}
            <div
              className={`select-none absolute top-10 left-0 right-0 mx-auto text-center ${layoutEditing ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${getElementClass('issuer')}`}
              style={getLayoutBoxStyle('issuer', '40px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'issuer')}
            >
              {isDefaultLogo ? (
                <div
                  className="flex flex-col items-center mt-2"
                  style={{ transform: `scale(${getElementScale('issuer')})`, transformOrigin: 'top center' }}
                >
                  <div className="flex items-center space-x-4 mb-1">
                    <div className="h-16 w-16 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs">
                        <defs>
                          <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="1" />
                            <stop offset="100%" stopColor="#1E3A8A" stopOpacity="1" />
                          </linearGradient>
                        </defs>
                        <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" fill="url(#hexGrad)" />
                        
                        {/* Bold white L */}
                        <path d="M 32,30 H 42.5 V 59 H 58 V 68 H 32 Z" fill="#FFFFFF" />
                        
                        {/* Graduation Cap */}
                        <path d="M 47.5,30 L 65,18 L 88,29 L 68,39 Z" fill="#FFFFFF" />
                        <path d="M 54,34 Q 67,42 78,34 Q 74,44 67,44 Q 58,44 54,34 Z" fill="#FFFFFF" />
                        <path d="M 77,32 Q 81,36 81.5,42" stroke="#FFFFFF" strokeWidth="1" fill="none" />
                        <circle cx="81.5" cy="44" r="2" fill="#FFFFFF" />
                        
                        {/* Network T */}
                        <line x1="51.5" y1="48" x2="83.5" y2="48" stroke="#FFFFFF" strokeWidth="3" />
                        <line x1="67.5" y1="48" x2="67.5" y2="68" stroke="#FFFFFF" strokeWidth="3" />
                        <circle cx="51.5" cy="48" r="4" fill="#FFFFFF" />
                        <circle cx="83.5" cy="48" r="4" fill="#FFFFFF" />
                        <circle cx="67.5" cy="68" r="4" fill="#FFFFFF" />
                        
                        {/* Bottom Swoosh */}
                        <path d="M 33,74 C 45,86 72,83 82,64 C 80,72 65,86 46,84 C 38,83 33,77 33,74 Z" fill="#FFFFFF" opacity="0.95" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left font-sans">
                      <span className="text-4xl font-black tracking-tight text-[#0A2540] leading-none">LihaTech</span>
                      <span className="text-[12px] font-extrabold text-slate-500 tracking-wide mt-1.5">Plan . Practice . Patience</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center mt-2"
                  style={{ transform: `scale(${getElementScale('issuer')})`, transformOrigin: 'top center' }}
                >
                  <img 
                    src={settings.logoUrl} 
                    alt="Company Logo" 
                    className="h-16 w-auto object-contain mb-1.5"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1.5">
                    {settings.tagline}
                  </span>
                </div>
              )}
              {renderResizeHandle('issuer')}
            </div>

            {/* Partner institute logo/name: kept independent so it can be moved and resized alone. */}
            {hasPartner && (
              <div
                className={`absolute left-0 right-0 mx-auto text-center ${layoutEditing ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${getElementClass('partner')}`}
                style={getLayoutBoxStyle('partner', '40px')}
                onPointerDown={(event) => handleLayoutPointerDown(event, 'partner')}
              >
                <div
                  className="flex items-center justify-center gap-5 border-l border-slate-300 pl-5"
                  style={{ transform: `scale(${getElementScale('partner')})`, transformOrigin: 'top center' }}
                >
                  <div className="flex flex-col items-center max-w-[240px]">
                    {certificate.partnerLogoUrl ? (
                      <img
                        src={certificate.partnerLogoUrl}
                        alt={`${certificate.partnerName || 'Partner'} logo`}
                        className="w-auto max-w-[200px] object-contain"
                        style={{ height: `${48 * getElementScale('partner')}px` }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span
                        className="text-xl font-black text-[#0A2540] leading-tight"
                        style={{ fontSize: `${20 * getElementScale('partner')}px` }}
                      >
                        {certificate.partnerName}
                      </span>
                    )}
                    {certificate.partnerTagline && (
                      <span
                        className="text-[10px] font-bold text-slate-500 tracking-wide mt-1 uppercase"
                        style={{ fontSize: `${10 * getElementScale('partner')}px` }}
                      >
                        {certificate.partnerTagline}
                      </span>
                    )}
                  </div>
                </div>
                {renderResizeHandle('partner')}
              </div>
            )}

            {/* Certificate Title */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('title')}`}
              style={getLayoutBoxStyle('title', '150px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'title')}
            >
              <h1
                className={`text-6xl font-serif tracking-[0.22em] font-black ${styles.headingColor} uppercase leading-[1.15]`}
                style={{ ...getElementTextStyle('title'), fontSize: `${60 * getElementScale('title')}px` }}
              >
                CERTIFICATE
              </h1>
              <div className="flex items-center justify-center mt-3">
                {/* Left tapered divider with a themed diamond */}
                <div className="flex items-center">
                  <div className="h-[1.2px] w-28" style={{ background: `linear-gradient(to right, transparent, ${styles.badgeGold})` }} />
                  <span className="text-[10px] mx-2" style={{ color: styles.badgeGold }}>◆</span>
                </div>
                
                <span
                  className={`text-sm uppercase tracking-[0.45em] font-black ${styles.subTitleColor} px-1`}
                  style={{ ...getElementTextStyle('title'), fontSize: `${14 * getElementScale('title')}px` }}
                >
                  {getCertificateSubtitle(certificate.certificateType)}
                </span>

                {/* Right tapered divider with a themed diamond */}
                <div className="flex items-center">
                  <span className="text-[10px] mx-2" style={{ color: styles.badgeGold }}>◆</span>
                  <div className="h-[1.2px] w-28" style={{ background: `linear-gradient(to left, transparent, ${styles.badgeGold})` }} />
                </div>
              </div>
              {renderResizeHandle('title')}
            </div>

            {/* Candidate text statement */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('presentation')}`}
              style={getLayoutBoxStyle('presentation', '255px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'presentation')}
            >
              <p
                className="text-[13px] text-slate-700 font-black tracking-[0.25em] uppercase"
                style={{ ...getElementTextStyle('presentation'), fontSize: `${13 * getElementScale('presentation')}px` }}
              >
                {presentation || certificate.presentationText || DEFAULT_PRESENTATION_TEXT}
              </p>
              {renderResizeHandle('presentation')}
            </div>

            {/* Candidate Name with beautiful simple bold typography */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center flex flex-col items-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('candidate')}`}
              style={{ ...getLayoutBoxStyle('candidate', '284px'), ...getElementTextStyle('candidate') }}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'candidate')}
            >
              <h2 className={`tracking-wide ${styles.nameColor} leading-[1.2] font-sans font-black pb-2 mb-5`}
                  style={{ ...getElementTextStyle('candidate'), fontSize: `${parseFloat(getCandidateFontSize(certificate.candidateName)) * getElementScale('candidate')}px` }}>
                {certificate.candidateName}
              </h2>
              {/* Underline */}
              <div
                className="h-[2px]"
                style={{
                  width: `${520 * getElementScale('candidate')}px`,
                  background: `linear-gradient(to right, transparent, ${styles.badgeGold}, transparent)`
                }}
              />
              {renderResizeHandle('candidate')}
            </div>

            {/* Completion Line */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('completion')}`}
              style={getLayoutBoxStyle('completion', '368px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'completion')}
            >
              <p
                className="text-[16px] text-slate-700 font-bold italic tracking-wide px-4"
                style={{ ...getElementTextStyle('completion'), fontSize: `${16 * getElementScale('completion')}px` }}
              >
                {statement || certificate.completionText || getDefaultCompletionText(certificate.certificateType)}
              </p>
              {renderResizeHandle('completion')}
            </div>

            {/* Program Name */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center flex justify-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('program')}`}
              style={getLayoutBoxStyle('program', '400px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'program')}
            >
              <p className={`font-black text-black tracking-wider uppercase text-center ${showActions ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
                 onClick={() => {
                   if (showActions) {
                     setShowStatementEditor(true);
                   }
                 }}
                 title={showActions ? "Click to edit program title or adjust font size" : undefined}
                 style={{ 
                   ...getElementTextStyle('program'),
                   fontSize: `${parseFloat(getProgramFontSize(programTitle || certificate.programName)) * getElementScale('program')}px`,
                   lineHeight: '1.18',
                   maxWidth: '740px',
                   maxHeight: '72px',
                   margin: '0 auto',
                   whiteSpace: 'normal',
                   wordBreak: 'normal',
                   overflowWrap: 'break-word',
                   textWrap: 'balance',
                   overflow: 'hidden'
                 }}>
                {programTitle || certificate.programName}
              </p>
              {renderResizeHandle('program')}
            </div>

            {/* Date Line */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('date')}`}
              style={getLayoutBoxStyle('date', '478px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'date')}
            >
              <p
                className="text-[16px] font-extrabold text-slate-900 tracking-wide"
                style={{ ...getElementTextStyle('date'), fontSize: `${16 * getElementScale('date')}px` }}
              >
                {dateLine || getFormattedDateLine(certificate)}
              </p>
              {renderResizeHandle('date')}
            </div>

            {/* Organized By Line */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('organizer')}`}
              style={getLayoutBoxStyle('organizer', '506px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'organizer')}
            >
              <p
                className="text-[16px] text-slate-700 font-bold tracking-wide"
                style={{ ...getElementTextStyle('organizer'), fontSize: `${16 * getElementScale('organizer')}px` }}
              >
                organized by <span className="font-black text-slate-950">{settings.name}</span>{hasPartner ? <> in association with <span className="font-black text-slate-950">{certificate.partnerName}</span></> : null}.
              </p>
              {renderResizeHandle('organizer')}
            </div>

            {/* Description */}
            <div
              className={`absolute left-0 right-0 mx-auto text-center flex justify-center ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('description')}`}
              style={getLayoutBoxStyle('description', '536px')}
              onPointerDown={(event) => handleLayoutPointerDown(event, 'description')}
            >
              <p className="text-slate-700 font-bold text-center border-t border-slate-300 pt-2.5"
                 style={{
                   ...getElementTextStyle('description'),
                   fontSize: `${17 * getElementScale('description')}px`,
                   lineHeight: '1.5',
                   maxWidth: '540px',
                   margin: '0 auto',
                   whiteSpace: 'normal'
                 }}>
                {certificate.textTemplate || getDefaultCertificateDescription(certificate.certificateType, settings.defaultCertText)}
              </p>
              {renderResizeHandle('description')}
            </div>

            {/* Bottom section containing ID, Issue date, Stamp, Badge and Signatures */}
            <div className="absolute bottom-10 left-0 right-0 w-full flex justify-between items-end px-12 z-20">
              {/* Left Column: Premium Gold Badge. It is hidden in Minimal Teal and editable in Design Mode for other templates. */}
              {selectedTemplate !== 'academic' && selectedTemplate !== 'modern-blue' && <div
                className={`w-1/5 flex justify-start pl-2 select-none relative ${layoutEditing ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${getElementClass('badge')} ${layoutEditing ? 'rounded-xl' : ''}`}
                style={getFooterBoxStyle('badge')}
                onPointerDown={(event) => handleLayoutPointerDown(event, 'badge')}
              >
                <div
                  className="relative w-28 h-28 flex items-center justify-center"
                  style={{ transform: `rotate(-3deg) translateY(4px) scale(${getElementScale('badge')})`, transformOrigin: 'center' }}
                >
                  {/* Ribbon Tails with shiny gold metallic borders (themed) */}
                  <svg className="absolute bottom-[-24px] w-24 h-28 select-none pointer-events-none z-0" viewBox="0 0 100 120">
                    {/* Left Ribbon with gold border */}
                    <polygon points="15,0 42,0 35,110 10,120 15,0" fill="url(#premium-gold)" />
                    <polygon points="17,0 40,0 34,107 13,116 17,0" fill={selectedTemplate === 'emerald' ? '#0F766E' : '#43080F'} />
                    
                    {/* Right Ribbon with gold border */}
                    <polygon points="58,0 85,0 90,120 65,110 58,0" fill="url(#premium-gold)" />
                    <polygon points="60,0 83,0 87,116 66,107 60,0" fill={selectedTemplate === 'emerald' ? '#0D9488' : '#43080F'} opacity="0.95" />
                  </svg>
                  {/* Gold Badge SVG (Exact Laurel Wreath & stars layout from image) */}
                  <svg className="absolute w-28 h-28 text-amber-500 drop-shadow-md z-10" viewBox="0 0 100 100">
                    {/* Wavy/spoked gold metallic seal border */}
                    <path 
                      d="M50 2 L53 14 L64 8 L65 20 L76 17 L73 28 L83 29 L77 40 L85 44 L77 53 L83 61 L73 65 L76 76 L65 73 L64 85 L53 79 L50 91 L47 79 L36 85 L35 73 L24 76 L27 65 L17 61 L23 53 L15 44 L23 40 L17 29 L27 28 L24 17 L35 20 L36 8 L47 14 Z" 
                      fill="url(#premium-gold)" 
                    />
                    
                    {/* Inner themed background */}
                    <circle cx="50" cy="50" r="34" fill={selectedTemplate === 'emerald' ? '#115E59' : 'url(#premium-burgundy)'} />
                    
                    {/* Thin inner gold ring */}
                    <circle cx="50" cy="50" r="31" fill="none" stroke="url(#premium-gold)" strokeWidth="1.2" />
                    <circle cx="50" cy="50" r="29" fill="none" stroke="url(#premium-gold)" strokeWidth="0.6" opacity="0.8" />
                    
                    {/* Stylized Laurel Wreath */}
                    {/* Left Branch */}
                    <path d="M 31,50 C 31,63 42,70 50,70" fill="none" stroke="url(#premium-gold)" strokeWidth="1" strokeLinecap="round" />
                    {/* Leaves Left */}
                    <path d="M 31,50 Q 27,47 31,44 Q 35,47 31,50 Z" fill="url(#premium-gold)" />
                    <path d="M 31,56 Q 26,54 30,50 Q 34,52 31,56 Z" fill="url(#premium-gold)" />
                    <path d="M 33,62 Q 28,61 31,56 Q 35,57 33,62 Z" fill="url(#premium-gold)" />
                    <path d="M 37,67 Q 32,67 35,62 Q 39,62 37,67 Z" fill="url(#premium-gold)" />
                    <path d="M 43,70 Q 39,71 41,66 Q 45,65 43,70 Z" fill="url(#premium-gold)" />
                    
                    {/* Right Branch */}
                    <path d="M 69,50 C 69,63 58,70 50,70" fill="none" stroke="url(#premium-gold)" strokeWidth="1" strokeLinecap="round" />
                    {/* Leaves Right */}
                    <path d="M 69,50 Q 73,47 69,44 Q 65,47 69,50 Z" fill="url(#premium-gold)" />
                    <path d="M 69,56 Q 74,54 70,50 Q 66,52 69,56 Z" fill="url(#premium-gold)" />
                    <path d="M 67,62 Q 72,61 69,56 Q 65,57 67,62 Z" fill="url(#premium-gold)" />
                    <path d="M 63,67 Q 68,67 65,62 Q 61,62 63,67 Z" fill="url(#premium-gold)" />
                    <path d="M 57,70 Q 61,71 59,66 Q 55,65 57,70 Z" fill="url(#premium-gold)" />
                    
                    {/* Stars at the top */}
                    {/* Center large star */}
                    <polygon points="50,21 52,25 57,25 53,28 55,32 50,30 45,32 47,28 43,25 48,25" fill="url(#premium-gold)" />
                    {/* Left star */}
                    <polygon points="41,24 42.5,27 45.5,27 43,29 44,32 41,30.5 38,32 39,29 36.5,27 39.5,27" fill="url(#premium-gold)" transform="rotate(-12 41 24)" />
                    {/* Right star */}
                    <polygon points="59,24 60.5,27 63.5,27 61,29 62,32 59,30.5 56,32 57,29 54.5,27 57.5,27" fill="url(#premium-gold)" transform="rotate(12 59 24)" />
                  </svg>
                  <div className="relative text-center flex flex-col items-center justify-center z-20 p-1">
                    <span className="text-[7.5px] font-black tracking-wider text-[#F3D78E] uppercase leading-none block">CERTIFICATE</span>
                    <span className="text-[5.5px] font-bold text-slate-300 tracking-normal uppercase leading-none block my-0.5">OF</span>
                    <span className="text-[7.5px] font-black tracking-wider text-[#F3D78E] uppercase leading-none block">COMPLETION</span>
                  </div>
                </div>
                {renderResizeHandle('badge')}
              </div>}

              {/* Center-Left Column: ID block */}
              <div
                className={`w-1/5 flex flex-col text-left border-r border-slate-400 pr-6 mb-5 h-16 justify-center relative ${layoutEditing ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${getElementClass('certificateId')} ${layoutEditing ? 'rounded-xl' : ''}`}
                style={getFooterBoxStyle('certificateId')}
                onPointerDown={(event) => handleLayoutPointerDown(event, 'certificateId')}
              >
                <span className="text-[14px] font-black uppercase tracking-widest text-slate-700 block leading-tight" style={{ fontSize: `${14 * getElementScale('certificateId')}px` }}>CERTIFICATE ID</span>
                <span className="font-mono font-black text-black text-base mt-2" style={{ fontSize: `${16 * getElementScale('certificateId')}px` }}>{certificate.certificateId}</span>
                {renderResizeHandle('certificateId')}
              </div>

              {/* Center Column: Stamp */}
              <div
                className={`relative w-1/5 flex justify-center h-40 items-center mb-1 ${layoutEditing ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${getElementClass('stamp')} ${layoutEditing ? 'rounded-xl' : ''}`}
                style={getFooterBoxStyle('stamp')}
                onPointerDown={(event) => handleLayoutPointerDown(event, 'stamp')}
              >
                <div
                  className="relative flex items-center justify-center h-44 w-44 opacity-95 select-none transform rotate-[-3deg] translate-y-4"
                  style={{
                    width: `${176 * getElementScale('stamp')}px`,
                    height: `${176 * getElementScale('stamp')}px`
                  }}
                >
                  {settings.stampUrl && !settings.stampUrl.includes('data:image/svg+xml') ? (
                    <img 
                      src={settings.stampUrl} 
                      alt="Stamp" 
                      className="w-auto object-contain drop-shadow-md"
                      style={{ height: `${160 * getElementScale('stamp')}px` }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 160 160"
                      className={`${selectedTemplate === 'emerald' ? 'text-teal-700' : selectedTemplate === 'academic' ? 'text-slate-700' : 'text-[#1E3A8A]'}`}
                      style={{
                        width: `${176 * getElementScale('stamp')}px`,
                        height: `${176 * getElementScale('stamp')}px`
                      }}
                      fill="none"
                      stroke="currentColor"
                    >
                      <circle cx="80" cy="80" r="74" strokeWidth="2.5" />
                      <circle cx="80" cy="80" r="66" strokeWidth="0.75" />
                      
                      <path id="stamp-text-top" d="M 18,80 A 62,62 0 0,1 142,80" />
                      <path id="stamp-text-bottom" d="M 142,80 A 62,62 0 0,1 18,80" />
                      
                      <text className={`font-sans text-[10px] font-black tracking-widest ${selectedTemplate === 'emerald' ? 'fill-teal-700' : selectedTemplate === 'academic' ? 'fill-slate-700' : 'fill-[#1E3A8A]'}`}>
                        <textPath href="#stamp-text-top" startOffset="50%" textAnchor="middle">LIHATECH • KOLHAPUR</textPath>
                      </text>
                      <text className={`font-sans text-[8px] font-bold tracking-widest ${selectedTemplate === 'emerald' ? 'fill-teal-700' : selectedTemplate === 'academic' ? 'fill-slate-700' : 'fill-[#1E3A8A]'}`}>
                        <textPath href="#stamp-text-bottom" startOffset="50%" textAnchor="middle">PLAN . PRACTICE . PATIENCE</textPath>
                      </text>
                      
                      <circle cx="80" cy="80" r="42" strokeWidth="1" />
                      <g transform="translate(62, 62)" className={selectedTemplate === 'emerald' ? 'fill-teal-700 text-teal-700' : selectedTemplate === 'academic' ? 'fill-slate-700 text-slate-700' : 'fill-[#1E3A8A] text-[#1E3A8A]'}>
                        <path d="M4 18 L18 11 L32 18 L18 25 Z" />
                        <path d="M8 20 L8 24 C8 25 18 27 18 27 C18 27 28 25 28 24 L28 20" stroke="currentColor" strokeWidth="1" />
                        <text x="18" y="8" className={`font-sans text-[5px] font-black tracking-wider ${selectedTemplate === 'emerald' ? 'fill-teal-700' : selectedTemplate === 'academic' ? 'fill-slate-700' : 'fill-[#1E3A8A]'}`} textAnchor="middle">VERIFIED</text>
                      </g>
                    </svg>
                  )}
                </div>
                {renderResizeHandle('stamp')}
              </div>

              {/* Center-Right Column: Issue Date block */}
              <div
                className={`w-1/5 flex flex-col text-left border-l border-slate-400 pl-6 mb-5 h-16 justify-center relative ${layoutEditing ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${getElementClass('issueDate')} ${layoutEditing ? 'rounded-xl' : ''}`}
                style={getFooterBoxStyle('issueDate')}
                onPointerDown={(event) => handleLayoutPointerDown(event, 'issueDate')}
              >
                <span className="text-[14px] font-black uppercase tracking-widest text-slate-700 block leading-tight" style={{ fontSize: `${14 * getElementScale('issueDate')}px` }}>DATE OF ISSUE</span>
                <span className="font-black text-black text-base font-mono mt-2" style={{ fontSize: `${16 * getElementScale('issueDate')}px` }}>{certificate.issueDate}</span>
                {renderResizeHandle('issueDate')}
              </div>

              {/* Right Column: Director Signature */}
              <div
                className={`w-1/5 flex flex-col items-center text-center justify-end mb-5 relative -left-10 ${layoutEditing ? 'cursor-move' : ''} ${getElementClass('signature')} ${layoutEditing ? 'rounded-xl' : ''}`}
                style={getFooterBoxStyle('signature')}
                onPointerDown={(event) => handleLayoutPointerDown(event, 'signature')}
              >
                <div
                  className="flex flex-col items-center justify-end relative"
                  style={{ width: `${176 * getElementScale('signature')}px` }}
                >
                  {settings.signatureUrl && (
                    <div
                      className="w-full flex items-end justify-center mb-1 select-none pointer-events-none"
                      style={{ height: `${64 * getElementScale('signature')}px` }}
                    >
                      <img 
                        src={settings.signatureUrl} 
                        alt="Director Signature" 
                        className="w-auto object-contain"
                        style={{
                          height: `${64 * getElementScale('signature')}px`,
                          maxWidth: `${170 * getElementScale('signature')}px`
                        }}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="border-t border-slate-400 w-full pt-2 text-center">
                    <p
                      className="font-black text-black text-lg leading-tight tracking-wide whitespace-nowrap"
                      style={{ fontSize: `${18 * getElementScale('signature')}px` }}
                    >
                      Director LihaTech
                    </p>
                  </div>
                </div>
                {renderResizeHandle('signature')}
              </div>
            </div>

          </div>
        </div>
  );

  if (renderOnlySheet) {
    return renderSheet();
  }

  return (
    <div 
      className={`border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${
        showActions 
          ? 'fixed inset-6 z-50 bg-white dark:bg-slate-900' 
          : 'bg-slate-900/5 dark:bg-slate-900/40 max-w-5xl w-full mx-auto'
      }`}
    >
      {/* Sticky Top Controls */}
      {(showActions || enableLayoutEditing) && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-xl">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Certificate Studio Preview
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Candidate: {certificate.candidateName} | ID: {certificate.certificateId}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {(showActions || enableLayoutEditing) && (
              <button
                type="button"
                onClick={() => {
                  setLayoutEditingValue(!layoutEditing);
                  setSelectedElementValue(null);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  layoutEditing
                    ? 'bg-[#078EDB] text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                }`}
                title="Drag certificate blocks to adjust their positions"
              >
                <Sliders className="h-4 w-4" />
                <span>{layoutEditing ? 'Exit Design Mode' : 'Design Mode'}</span>
              </button>
            )}

            {showActions && <button
              type="button"
              onClick={() => setShowStatementEditor(!showStatementEditor)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                showStatementEditor
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Customize certificate statements, preamble, and schedule dates"
            >
              <Edit3 className="h-4 w-4" />
              <span>{showStatementEditor ? 'Close Text Editor' : 'Edit Certificate Texts'}</span>
            </button>}

            {showActions && <button
              onClick={handleDownloadPDF}
              disabled={exporting}
              className="flex items-center space-x-2 px-4 py-2 bg-[#6D1F2A] hover:bg-[#5E1B24] text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>{exporting ? 'Generating...' : 'Download PDF'}</span>
            </button>}
            
            {showActions && <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>}
            
            {showActions && onClose && (
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

      {layoutEditing && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#e8f3f8] dark:bg-slate-950 border-b border-[#c6dce6] dark:border-slate-800 text-xs text-[#062b4b] dark:text-slate-200">
          <span>Drag the highlighted blocks to align the certificate. Changes are saved with this certificate.</span>
          <button type="button" onClick={resetLayout} className="font-bold text-[#07547e] hover:underline cursor-pointer whitespace-nowrap">Reset layout</button>
        </div>
      )}

      {/* Expandable Text Customizer Drawer */}
      {showActions && showStatementEditor && (
        <div className="p-4 bg-amber-50/60 dark:bg-slate-900 border-b border-amber-500/20 dark:border-slate-800 animate-fade-in space-y-3.5">
          {/* Row 1: Presentation / Preamble Statement */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 pb-2.5 border-b border-amber-200/50 dark:border-slate-800/80">
            <div className="w-44 flex-shrink-0 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
                Certify Statement:
              </span>
              <button
                type="button"
                onClick={() => {
                  setPresentation(DEFAULT_PRESENTATION_TEXT);
                  if (onUpdateCertificate) {
                    onUpdateCertificate({ ...certificate, presentationText: DEFAULT_PRESENTATION_TEXT });
                  }
                }}
                className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
            <input
              type="text"
              value={presentation}
              onChange={(e) => {
                const val = e.target.value;
                setPresentation(val);
                if (onUpdateCertificate) {
                  onUpdateCertificate({ ...certificate, presentationText: val });
                }
              }}
              placeholder="e.g. THIS IS TO CERTIFY THAT, PROUDLY PRESENTED TO"
              className="flex-1 rounded-xl border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESENTATION_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPresentation(preset.text);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({ ...certificate, presentationText: preset.text });
                    }
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded-lg transition-all cursor-pointer font-medium ${
                    presentation === preset.text
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-amber-100/50 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Completion / Recognition Statement */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 pb-2.5 border-b border-amber-200/50 dark:border-slate-800/80">
            <div className="w-44 flex-shrink-0 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
                Completion Line:
              </span>
              <button
                type="button"
                onClick={() => {
                  const def = getDefaultCompletionText(certificate.certificateType);
                  setStatement(def);
                  if (onUpdateCertificate) {
                    onUpdateCertificate({ ...certificate, completionText: def });
                  }
                }}
                className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
            <input
              type="text"
              value={statement}
              onChange={(e) => {
                const val = e.target.value;
                setStatement(val);
                if (onUpdateCertificate) {
                  onUpdateCertificate({ ...certificate, completionText: val });
                }
              }}
              placeholder="e.g. has successfully completed the course"
              className="flex-1 rounded-xl border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {COMPLETION_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setStatement(preset.text);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({ ...certificate, completionText: preset.text });
                    }
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded-lg transition-all cursor-pointer font-medium ${
                    statement === preset.text
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-amber-100/50 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Program / Course / Event Title & Font Size Controls */}
          <div className="flex flex-col gap-2 pb-2.5 border-b border-amber-200/50 dark:border-slate-800/80">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
              <div className="w-44 flex-shrink-0 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-amber-950 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Program / Title:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const origTitle = certificate.programName || '';
                    const origSize = certificate.programFontSize || 0;
                    setProgramTitle(origTitle);
                    setProgramFontSize(origSize);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({
                        ...certificate,
                        programName: origTitle,
                        programFontSize: origSize
                      });
                    }
                  }}
                  className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                >
                  Reset
                </button>
              </div>
              <input
                type="text"
                value={programTitle}
                onChange={(e) => {
                  const val = e.target.value;
                  setProgramTitle(val);
                  if (onUpdateCertificate) {
                    onUpdateCertificate({
                      ...certificate,
                      programName: val,
                      programFontSize
                    });
                  }
                }}
                placeholder="e.g. Mock Interview & Technical Assessment at DYPCET, Kolhapur, in association with the CSE (Data Science) Department."
                className="flex-1 rounded-xl border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-gray-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Font Size Adjuster Controls */}
            <div className="flex flex-wrap items-center gap-2 pl-0 lg:pl-44 text-xs">
              <span className="text-[10px] uppercase font-extrabold text-amber-900/80 dark:text-amber-400/80 flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                Font Size:
              </span>

              {/* Stepper & Slider */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-amber-300/80 dark:border-slate-700 rounded-xl px-2 py-0.5 shadow-2xs">
                <button
                  type="button"
                  title="Decrease font size"
                  onClick={() => {
                    const current = programFontSize > 0 ? programFontSize : getAutoProgramFontSize(programTitle || certificate.programName);
                    const next = Math.max(12, current - 1);
                    setProgramFontSize(next);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({ ...certificate, programName: programTitle, programFontSize: next });
                    }
                  }}
                  className="p-1 text-gray-600 dark:text-gray-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="range"
                  min="12"
                  max="36"
                  value={programFontSize > 0 ? programFontSize : getAutoProgramFontSize(programTitle || certificate.programName)}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);
                    setProgramFontSize(next);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({ ...certificate, programName: programTitle, programFontSize: next });
                    }
                  }}
                  className="w-24 accent-amber-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg"
                />

                <button
                  type="button"
                  title="Increase font size"
                  onClick={() => {
                    const current = programFontSize > 0 ? programFontSize : getAutoProgramFontSize(programTitle || certificate.programName);
                    const next = Math.min(36, current + 1);
                    setProgramFontSize(next);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({ ...certificate, programName: programTitle, programFontSize: next });
                    }
                  }}
                  className="p-1 text-gray-600 dark:text-gray-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>

                <span className="font-mono font-bold text-[11px] text-amber-950 dark:text-amber-300 min-w-[50px] text-center pl-1.5 border-l border-gray-200 dark:border-slate-800">
                  {programFontSize > 0 ? `${programFontSize} px` : `Auto (${getAutoProgramFontSize(programTitle || certificate.programName)}px)`}
                </span>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-1">
                {PROGRAM_FONT_SIZE_PRESETS.map((preset) => {
                  const isSelected = preset.value === 0 ? programFontSize === 0 : programFontSize === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setProgramFontSize(preset.value);
                        if (onUpdateCertificate) {
                          onUpdateCertificate({
                            ...certificate,
                            programName: programTitle,
                            programFontSize: preset.value
                          });
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] rounded-lg transition-all cursor-pointer font-medium ${
                        isSelected
                          ? 'bg-amber-600 text-white font-bold shadow-xs ring-1 ring-amber-700'
                          : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-amber-100/50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 4: Event Date / Schedule Line */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            <div className="w-44 flex-shrink-0 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
                Event / Date Line:
              </span>
              <button
                type="button"
                onClick={() => {
                  const def = getFormattedDateLine({ eventDate: certificate.eventDate, startDate: certificate.startDate, endDate: certificate.endDate });
                  setDateLine(def);
                  if (onUpdateCertificate) {
                    onUpdateCertificate({ ...certificate, dateLineText: def });
                  }
                }}
                className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
            <input
              type="text"
              value={dateLine}
              onChange={(e) => {
                const val = e.target.value;
                setDateLine(val);
                if (onUpdateCertificate) {
                  onUpdateCertificate({ ...certificate, dateLineText: val });
                }
              }}
              placeholder="e.g. held in May 2026, held on 8 & 9 May 2026"
              className="flex-1 rounded-xl border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_LINE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDateLine(preset.text);
                    if (onUpdateCertificate) {
                      onUpdateCertificate({ ...certificate, dateLineText: preset.text });
                    }
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded-lg transition-all cursor-pointer font-medium ${
                    dateLine === preset.text
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-amber-100/50 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen Interactive Render View with custom centering on grey stage */}
      <div className="flex flex-1 min-h-0 min-w-0">
        <div 
          ref={containerRef}
          className="overflow-auto bg-slate-100 dark:bg-slate-950 p-3 flex justify-center items-start cursor-zoom-out transition-all duration-300 flex-1 min-w-0"
          style={showActions ? { flex: 1, minHeight: 0 } : { height: `${793.7 * scale + 32}px` }}
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) {
              onClose();
            }
          }}
        >
          <div 
            style={{ 
              width: `${1122.52 * scale}px`,
              height: `${793.7 * scale}px`,
              margin: 'auto',
            }}
            className="flex-shrink-0 transition-all duration-200"
          >
            <div 
              style={{ 
                width: '297mm',
                height: '210mm',
                boxSizing: 'border-box',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {renderSheet()}
            </div>
          </div>
        </div>

        {layoutEditing && showLayoutControls && (
          <CertificateLayoutControls
            certificateLayout={certificateLayout}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElementValue}
            onUpdateLayout={updateLayout}
          />
        )}
      </div>

      {/* OFF-SCREEN UNTRANSFORMED 1:1 NODE FOR PIXEL-PERFECT PDF GENERATION */}
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
        aria-hidden="true"
      >
        {renderSheet(offscreenCertRef)}
      </div>
    </div>
  );
}
