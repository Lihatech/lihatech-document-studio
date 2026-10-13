import type { CompanySettings, RecentActivity } from '../types';
import type { StudioData } from '../lib/documentStudio';
import uploadedSign from '../../sign WO BG-1.png';
import uploadedStamp from '../../stamp WO BG.png';
import uploadedLogo from '../../horizontal_logo-removebg-preview.png';

// Embedded default high-quality SVG data for Logo, Stamp, and Signature
const DEFAULT_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 100" width="420" height="100">
  <defs>
    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%230EA5E9" />
      <stop offset="100%" stop-color="%231E3A8A" />
    </linearGradient>
  </defs>
  <g transform="translate(10, 0)">
    <!-- Point-topped Hexagon -->
    <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" fill="url(%23logo-grad)" />
    
    <!-- White Bold L -->
    <path d="M 32,30 H 42.5 V 59 H 58 V 68 H 32 Z" fill="%23FFFFFF" />
    
    <!-- Graduation Cap -->
    <path d="M 47.5,30 L 65,18 L 88,29 L 68,39 Z" fill="%23FFFFFF" />
    <path d="M 54,34 Q 67,42 78,34 Q 74,44 67,44 Q 58,44 54,34 Z" fill="%23FFFFFF" />
    <path d="M 77,32 Q 81,36 81.5,42" stroke="%23FFFFFF" stroke-width="1" fill="none" />
    <circle cx="81.5" cy="44" r="2" fill="%23FFFFFF" />
    
    <!-- Network T -->
    <line x1="51.5" y1="48" x2="83.5" y2="48" stroke="%23FFFFFF" stroke-width="3" />
    <line x1="67.5" y1="48" x2="67.5" y2="68" stroke="%23FFFFFF" stroke-width="3" />
    <circle cx="51.5" cy="48" r="4" fill="%23FFFFFF" />
    <circle cx="83.5" cy="48" r="4" fill="%23FFFFFF" />
    <circle cx="67.5" cy="68" r="4" fill="%23FFFFFF" />
    
    <!-- Bottom Swoosh -->
    <path d="M 33,74 C 45,86 72,83 82,64 C 80,72 65,86 46,84 C 38,83 33,77 33,74 Z" fill="%23FFFFFF" opacity="0.95" />
    
    <!-- Brand Name text -->
    <text x="115" y="52" font-family="'Inter', sans-serif" font-size="36" font-weight="900" fill="%230F172A" letter-spacing="-0.5">LihaTech</text>
    <text x="115" y="76" font-family="'Inter', sans-serif" font-size="11" font-weight="800" fill="%23475569" letter-spacing="4.5">Plan . Practice . Patience</text>
  </g>
</svg>`;

const DEFAULT_SIGNATURE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">
  <path d="M15 55 C 35 45, 60 15, 75 25 C 90 35, 70 70, 95 45 C 120 20, 140 30, 165 25 C 175 22, 190 35, 180 50 C 150 70, 140 45, 175 42" 
        fill="none" stroke="%231E3A8A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  <line x1="10" y1="65" x2="190" y2="55" stroke="%231E3A8A" stroke-width="1.5" stroke-dasharray="4 2" />
</svg>`;

const DEFAULT_STAMP_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <circle cx="80" cy="80" r="74" fill="none" stroke="%231E3A8A" stroke-width="3" stroke-dasharray="1400" />
  <circle cx="80" cy="80" r="66" fill="none" stroke="%231E3A8A" stroke-width="1" />
  
  <path id="stamp-text-path-top" d="M 18,80 A 62,62 0 0,1 142,80" fill="none" />
  <path id="stamp-text-path-bottom" d="M 142,80 A 62,62 0 0,1 18,80" fill="none" />
  
  <text font-family="'Inter', sans-serif" font-size="11" font-weight="700" fill="%231E3A8A" letter-spacing="1">
    <textPath href="%23stamp-text-path-top" startOffset="50%" text-anchor="middle">LIHATECH • AI AGENCY</textPath>
  </text>
  
  <text font-family="'Inter', sans-serif" font-size="9" font-weight="600" fill="%231E3A8A" letter-spacing="1">
    <textPath href="%23stamp-text-path-bottom" startOffset="50%" text-anchor="middle">KOLHAPUR • MAHARASHTRA</textPath>
  </text>
  
  <!-- Stamp Inner Design -->
  <circle cx="80" cy="80" r="42" fill="none" stroke="%231E3A8A" stroke-width="1.5" />
  <g transform="translate(58, 58)">
    <rect x="0" y="5" width="44" height="34" rx="8" fill="%231E3A8A" opacity="0.15" />
    <path d="M8 22 L22 15 L36 22 L22 29 Z" fill="%231E3A8A" />
    <path d="M12 24.5 L12 29 C12 30 22 32 22 32 C22 32 32 30 32 29 L32 24.5" fill="%231E3A8A" />
    <text x="22" y="11" font-family="'Inter', sans-serif" font-size="6" font-weight="800" fill="%231E3A8A" text-anchor="middle" letter-spacing="0.5">APPROVED</text>
  </g>
</svg>`;

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: 'LihaTech',
  tagline: 'Plan . Practice . Patience',
  address: '',
  email: 'info@lihatech.com',
  phone: '',
  website: 'www.lihatech.com',
  gstNumber: '',
  panNumber: '',
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  ifscCode: '',
  upiId: '',
  qrCodeUrl: '', // QR code can be dynamic or drawn
  logoUrl: uploadedLogo || DEFAULT_LOGO_SVG,
  directorName: 'Director LihaTech',
  directorDesignation: 'Director LihaTech',
  signatureUrl: uploadedSign || DEFAULT_SIGNATURE_SVG,
  stampUrl: uploadedStamp || DEFAULT_STAMP_SVG,
  defaultGstPercent: 18,
  defaultTerms: [
    'Payment once made is non-refundable unless agreed in writing.',
    'Project delivery timeline depends on timely content, feedback, and approvals from the client.',
    'Additional changes beyond the agreed scope may be charged separately.',
    'Hosting, domain, API, cloud, and third-party charges are billed separately unless included in the proposal.',
    'This invoice is system generated and valid without physical signature.'
  ],
  invoiceServicePresets: [
  {
    name: 'Website Development',
    desc: 'Full corporate website — frontend & backend development, responsive design, SEO optimization, and performance tuning.'
  },
  {
    name: 'AI Chatbot Development',
    desc: 'Custom AI chatbot for customer support, lead generation, business automation, or internal workflow support.'
  },
  {
    name: 'GenAI Application Development',
    desc: 'LLM-based application using APIs, RAG, vector database, prompt engineering, and custom workflow automation.'
  },
  {
    name: 'Machine Learning Model Development',
    desc: 'Data preprocessing, model training, evaluation, deployment, and performance reporting.'
  },
  {
    name: 'Data Analytics Dashboard',
    desc: 'Data cleaning, analysis, visualization, and dashboard creation using web technologies or custom frameworks.'
  },
  {
    name: 'Automation Solution',
    desc: 'Business process automation using Python, APIs, workflow automation, and custom dashboards.'
  },
  {
    name: 'Internship Training Program',
    desc: 'Student training program including interactive training sessions, assignments, live project work, mentoring, and evaluation.'
  },
  {
    name: 'Certification Course Delivery',
    desc: 'Structured course delivery with practical labs, assignments, assessments, and certificate generation.'
  }
],
  certTemplate: 'royal',
  certificatePartners: [],
  certificateCategories: [],
  defaultCertText: 'The participant has demonstrated dedication, active participation and successfully completed all the hands-on sessions.'
};

export function normalizeSettings(saved: Partial<CompanySettings> = {}): CompanySettings {
  const settings = { ...DEFAULT_COMPANY_SETTINGS, ...saved };
  // Refresh only shipped asset URLs after a new build; preserve uploaded image data and external URLs.
  for (const [field, marker] of [['logoUrl', 'horizontal_logo'], ['signatureUrl', 'sign%20WO%20BG'], ['stampUrl', 'stamp%20WO%20BG']] as const) {
    const value = settings[field];
    if (!value || (value.startsWith('/assets/') && value.includes(marker))) settings[field] = DEFAULT_COMPANY_SETTINGS[field];
  }
  return settings;
}

export function getDefaultStudioData(): StudioData {
  return { settings: normalizeSettings(), clients: [], courses: [], invoices: [], certificates: [],
    letters: [], payslips: [], employees: [], activities: [] };
}

const storageKeys = {
  settings: 'lihatech_settings', clients: 'lt_clients', courses: 'lt_courses', invoices: 'lihatech_invoices',
  certificates: 'lihatech_certificates', letters: 'lihatech_letters', payslips: 'lihatech_payslips',
  employees: 'lt_custom_employee_profiles', activities: 'lt_activities',
} as const;

// Read existing browser records without seeding samples or mutating customer names.
// These records are only used by the explicit import flow, never as shared production data.
export function getStoredData(): StudioData {
  const defaults = getDefaultStudioData();
  if (typeof window === 'undefined') return defaults;
  for (const field of Object.keys(storageKeys) as (keyof StudioData)[]) {
    try {
      const value = localStorage.getItem(storageKeys[field]);
      if (value) {
        const parsed = JSON.parse(value);
        if (field === 'settings') defaults.settings = normalizeSettings(parsed);
        else if (Array.isArray(parsed)) (defaults[field] as unknown[]) = parsed;
      }
    } catch (error) { console.warn(`Could not read browser records: ${field}`, error); }
  }
  return defaults;
}

export function saveStoredData(data: Partial<StudioData>): void {
  if (typeof window === 'undefined') return;
  for (const field of Object.keys(storageKeys) as (keyof StudioData)[]) {
    if (data[field] !== undefined) localStorage.setItem(storageKeys[field], JSON.stringify(data[field]));
  }
}

export function createActivity(type: RecentActivity['type'], description: string): RecentActivity {
  return { id: crypto.randomUUID(), type, description, timestamp: new Date().toISOString() };
}
