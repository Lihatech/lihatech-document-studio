export interface CompletionPreset {
  label: string;
  type: string;
  text: string;
}

export interface CertificateTypePreset {
  value: string;
  label: string;
  defaultText: string;
}

export const CERTIFICATE_TYPE_PRESETS: CertificateTypePreset[] = [
  { value: 'Course Completion', label: 'Course Completion', defaultText: 'has successfully completed the course' },
  { value: 'Internship Completion', label: 'Internship Completion', defaultText: 'has successfully completed the internship program' },
  { value: 'Outstanding Performer', label: 'Outstanding Performer', defaultText: 'for outstanding performance and exceptional dedication to' },
  { value: 'Certificate of Excellence', label: 'Certificate of Excellence', defaultText: 'in recognition of exceptional performance and academic excellence in' },
  { value: 'Workshop Participation', label: 'Workshop Participation', defaultText: 'has successfully participated in the' },
  { value: 'Industrial Training', label: 'Industrial Training', defaultText: 'has successfully completed the industrial training on' },
  { value: 'Project Completion', label: 'Project Completion', defaultText: 'has successfully completed the capstone project on' },
  { value: 'Faculty Development Program', label: 'Faculty Development Program', defaultText: 'has successfully completed the Faculty Development Program on' },
  { value: 'Training Completion', label: 'Training Completion', defaultText: 'has successfully completed the training program on' },
  { value: 'Appreciation Certificate', label: 'Appreciation Certificate', defaultText: 'in appreciation of outstanding contribution and dedication to' }
];

export function getCertificateCategoryOptions(saved: string[] = [], current = '') {
  const values = [...CERTIFICATE_TYPE_PRESETS.map(option => option.value), ...saved, current].filter(Boolean);
  const seen = new Set<string>();
  return values.filter(value => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized); return true;
  }).map(value => ({ value, label: value }));
}

export const COMPLETION_PRESETS: CompletionPreset[] = [
  {
    label: 'Outstanding Performer',
    type: 'Outstanding Performer',
    text: 'for outstanding performance and exceptional dedication to'
  },
  {
    label: 'Outstanding (Contribution)',
    type: 'Outstanding Performer',
    text: 'in recognition of outstanding performance and exceptional contribution in'
  },
  {
    label: 'Course',
    type: 'Course Completion',
    text: 'has successfully completed the course'
  },
  {
    label: 'Appreciation',
    type: 'Appreciation Certificate',
    text: 'in appreciation of outstanding contribution and dedication to'
  },
  {
    label: 'Appreciation (Service)',
    type: 'Appreciation Certificate',
    text: 'in recognition of exceptional dedication and valuable contribution to'
  },
  {
    label: 'Internship',
    type: 'Internship Completion',
    text: 'has successfully completed the internship program'
  },
  {
    label: 'Participation',
    type: 'Workshop Participation',
    text: 'has successfully participated in the'
  },
  {
    label: 'Training',
    type: 'Industrial Training',
    text: 'has successfully completed the industrial training on'
  },
  {
    label: 'Excellence',
    type: 'Certificate of Excellence',
    text: 'in recognition of exceptional performance and academic excellence in'
  },
  {
    label: 'FDP',
    type: 'Faculty Development Program',
    text: 'has successfully completed the Faculty Development Program on'
  },
  {
    label: 'Project',
    type: 'Project Completion',
    text: 'has successfully completed the capstone project on'
  }
];

export function getDefaultCompletionText(certificateType: string = ''): string {
  const type = (certificateType || '').toLowerCase().trim();
  if (type.includes('outstanding') || type.includes('performer')) {
    return 'for outstanding performance and exceptional dedication to';
  }
  if (type.includes('appreciation')) {
    return 'in appreciation of outstanding contribution and dedication to';
  }
  if (type.includes('internship')) {
    return 'has successfully completed the internship program';
  }
  if (type.includes('participation') || type.includes('workshop')) {
    return 'has successfully participated in the';
  }
  if (type.includes('training')) {
    return 'has successfully completed the industrial training on';
  }
  if (type.includes('faculty') || type.includes('fdp')) {
    return 'has successfully completed the Faculty Development Program on';
  }
  if (type.includes('project')) {
    return 'has successfully completed the capstone project on';
  }
  if (type.includes('excellence')) {
    return 'in recognition of exceptional performance and academic excellence in';
  }
  return 'has successfully completed the course';
}

export function getCertificateCompletionLine(cert: { completionText?: string; certificateType: string; programName?: string }): string {
  const text = cert.completionText?.trim() || getDefaultCompletionText(cert.certificateType);
  // Older free-form paragraphs repeat fields that have their own place on the certificate.
  if (text.length > 120 || /this is to certify|\[(?:candidate\s+name|start\s+date|end\s+date)\]/i.test(text)) {
    return getDefaultCompletionText(cert.certificateType);
  }
  return cert.certificateType.toLowerCase().includes('internship') && cert.programName?.toLowerCase().includes('internship')
    ? text.replace(/\s+on$/i, '') : text;
}

export function getCertificateSubtitle(certificateType: string = ''): string {
  const t = (certificateType || '').trim();
  const lower = t.toLowerCase();

  if (lower.startsWith('of ') || lower.startsWith('for ')) {
    return t.toUpperCase();
  }
  if (lower.includes('performer')) {
    return 'FOR OUTSTANDING PERFORMER';
  }
  if (lower.includes('outstanding')) {
    return 'OF OUTSTANDING PERFORMANCE';
  }
  if (lower.includes('course') || lower === 'completion') {
    return 'OF COMPLETION';
  }
  if (lower.includes('internship')) {
    return 'OF INTERNSHIP';
  }
  if (lower.includes('participation') || lower.includes('workshop')) {
    return 'OF PARTICIPATION';
  }
  if (lower.includes('industrial') || lower.includes('training')) {
    return 'OF INDUSTRIAL TRAINING';
  }
  if (lower.includes('appreciation')) {
    return 'OF APPRECIATION';
  }
  if (lower.includes('faculty') || lower.includes('fdp')) {
    return 'OF FACULTY DEVELOPMENT';
  }
  if (lower.includes('project')) {
    return 'OF PROJECT COMPLETION';
  }
  if (lower.includes('excellence')) {
    return 'OF EXCELLENCE';
  }
  return 'OF COMPLETION';
}

export function getDefaultCertificateDescription(certificateType: string = '', defaultSettingText?: string): string {
  const lower = (certificateType || '').toLowerCase().trim();
  if (lower.includes('internship')) {
    return 'During the internship, the candidate demonstrated dedication, practical skills and professional commitment.';
  }
  if (lower.includes('outstanding') || lower.includes('performer')) {
    return 'In recognition of exceptional performance, exemplary leadership, and remarkable commitment to excellence throughout the program.';
  }
  if (lower.includes('appreciation')) {
    return 'In recognition of valuable contribution, continuous dedication, and exceptional service rendered with high quality and commitment.';
  }
  return defaultSettingText || 'The participant has demonstrated dedication, active participation and successfully completed all the hands-on sessions.';
}

export const DEFAULT_PRESENTATION_TEXT = 'THIS IS TO CERTIFY THAT';

export const PRESENTATION_PRESETS: { label: string; text: string }[] = [
  { label: 'Certify That', text: 'THIS IS TO CERTIFY THAT' },
  { label: 'Proudly Presented', text: 'PROUDLY PRESENTED TO' },
  { label: 'Certificate Presented', text: 'THIS CERTIFICATE IS PRESENTED TO' },
  { label: 'Certificate Proudly Presented', text: 'THIS CERTIFICATE IS PROUDLY PRESENTED TO' },
  { label: 'Awarded To', text: 'AWARDED TO' },
  { label: 'In Recognition Of', text: 'IN RECOGNITION OF' },
  { label: 'Honoring', text: 'HONORING' }
];

export const LEGACY_DATE_LINE_TEXT = 'held in May 2026';

export function getFormattedDateLine(cert: { dateLineText?: string; eventDate?: string; startDate?: string; endDate?: string; certificateType?: string }): string {
  if (cert.dateLineText?.trim() && (cert.dateLineText.trim() !== LEGACY_DATE_LINE_TEXT || (!cert.startDate && !cert.endDate))) {
    return cert.dateLineText.trim();
  }
  if (cert.eventDate?.trim() && cert.eventDate.trim() !== LEGACY_DATE_LINE_TEXT) {
    const trimmed = cert.eventDate.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('held') || lower.startsWith('on ') || lower.startsWith('from ') || lower.startsWith('during ') || lower.startsWith('in ')) {
      return trimmed;
    }
    return `held on ${trimmed}`;
  }
  const format = (date: string) => {
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date);
    return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  };
  const internship = cert.certificateType?.toLowerCase().includes('internship');
  if (cert.startDate && cert.endDate) {
    if (cert.startDate === cert.endDate) return internship ? `Internship completed on ${format(cert.endDate)}` : `held on ${format(cert.startDate)}`;
    return internship ? `Internship period: ${format(cert.startDate)} to ${format(cert.endDate)}` : `held from ${format(cert.startDate)} to ${format(cert.endDate)}`;
  }
  if (cert.startDate || cert.endDate) return internship ? `Internship date: ${format(cert.startDate || cert.endDate!)}` : `held on ${format(cert.startDate || cert.endDate!)}`;
  return cert.dateLineText?.trim() || '';
}

export function getAutoProgramFontSize(name: string = ''): number {
  const len = name.trim().length;
  if (len <= 25) return 28;
  if (len <= 45) return 24;
  if (len <= 70) return 20;
  if (len <= 95) return 17;
  return 15;
}

export function getProgramFontSizeStyle(name: string = '', customSize?: number): string {
  if (customSize && customSize >= 10 && customSize <= 48) {
    return `${customSize}px`;
  }
  return `${getAutoProgramFontSize(name)}px`;
}

export const PROGRAM_FONT_SIZE_PRESETS = [
  { label: 'Auto', value: 0 },
  { label: '14px (XS)', value: 14 },
  { label: '16px (Small)', value: 16 },
  { label: '18px (Compact)', value: 18 },
  { label: '21px (Medium)', value: 21 },
  { label: '25px (Regular)', value: 25 },
  { label: '28px (Large)', value: 28 },
];


