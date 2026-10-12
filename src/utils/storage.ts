import { CompanySettings, Client, Course, Invoice, Certificate, RecentActivity, Letter, Payslip } from '../types';
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

const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  name: 'LihaTech',
  tagline: 'Plan . Practice . Patience',
  address: 'S. No. 42, Cyber City Area, Near University Circle, Kolhapur, Maharashtra, India - 416004',
  email: 'info@lihatech.com',
  phone: '+91 98765 43210',
  website: 'www.lihatech.com',
  gstNumber: '27AAACL8890C1Z4',
  panNumber: 'AAACL8890C',
  bankName: 'HDFC Bank Ltd',
  accountHolder: 'LihaTech Solutions Private Limited',
  accountNumber: '50200067891234',
  ifscCode: 'HDFC0001245',
  upiId: 'lihatech@hdfcbank',
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
  certTemplate: 'royal',
  certificatePartners: [],
  defaultCertText: 'The participant has demonstrated dedication, active participation and successfully completed all the hands-on sessions.'
};

const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Shravani Solutions',
    companyName: 'Shravani IT Solutions',
    email: 'contact@shravanisolutions.com',
    phone: '+91 94220 12345',
    address: 'Phase 2, IT Park, Pune, Maharashtra, India - 411057',
    gstNumber: '27AABCS5564K2Z9',
    notes: 'Premium client for website and chatbot development services.'
  },
  {
    id: 'c2',
    name: 'TechVeda Systems',
    companyName: 'TechVeda EdTech Pvt Ltd',
    email: 'billing@techveda.org',
    phone: '+91 91234 56789',
    address: 'Shahupuri 3rd Lane, Kolhapur, Maharashtra, India - 416001',
    gstNumber: '27AAGCT9012A1ZX',
    notes: 'Education partner, bulk certification course client.'
  }
];

const INITIAL_COURSES: Course[] = [
  {
    id: 'p1',
    name: 'Industrial Training Program on Machine Learning',
    type: 'Industrial Training',
    duration: '4 Weeks',
    mode: 'Hybrid',
    description: 'Practical training on ML algorithms, model pipelines, evaluation, and cloud deployment.',
    defaultText: 'This is to certify that [Candidate Name] has successfully completed the Industrial Training Program on Machine Learning held from [Start Date] to [End Date], organized by LihaTech.'
  },
  {
    id: 'p2',
    name: 'Artificial Intelligence & Generative AI Internship',
    type: 'Internship Completion',
    duration: '6 Weeks',
    mode: 'Online',
    description: 'Hands-on project work developing LLM-based solutions, vector databases, and prompt-engineered workflows.',
    defaultText: 'This is to certify that [Candidate Name] has successfully completed the internship program on Artificial Intelligence & Generative AI Internship at LihaTech from [Start Date] to [End Date]. During this period, the candidate demonstrated sincerity, technical understanding, active participation, and project-based learning skills.'
  },
  {
    id: 'p3',
    name: 'Full Stack Web & AI Application Development',
    type: 'Course Completion',
    duration: '3 Months',
    mode: 'Offline',
    description: 'A comprehensive curriculum covering React, Express, MongoDB, and integrated AI capabilities.',
    defaultText: 'This is to certify that [Candidate Name] has successfully completed the course on Full Stack Web & AI Application Development organized by LihaTech. The participant has demonstrated dedication, active participation, and successfully completed all required sessions, assignments, and practical work.'
  },
  {
    id: 'p4',
    name: 'Full Stack & AI Innovation Program - Outstanding Performer',
    type: 'Outstanding Performer',
    duration: '8 Weeks',
    mode: 'Hybrid',
    description: 'Special recognition award presented to candidates demonstrating exceptional problem solving, project execution, and dedication.',
    defaultText: 'This is to certify that [Candidate Name] has been recognized as an Outstanding Performer for exceptional dedication and performance in the Full Stack & AI Innovation Program organized by LihaTech.'
  },
  {
    id: 'p5',
    name: 'Mock Interview & Technical Assessment at DYPCET, Kolhapur, in association with the CSE (Data Science) Department.',
    type: 'Appreciation Certificate',
    duration: '2 Days',
    mode: 'Offline',
    description: 'Mock interview and technical readiness assessment conducted at DYPCET, Kolhapur in association with the CSE (Data Science) Department.',
    defaultText: 'This is to certify that [Candidate Name] has actively participated in the Mock Interview & Technical Assessment at DYPCET, Kolhapur, in association with the CSE (Data Science) Department.'
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'i1',
    invoiceNumber: 'LT-INV-2026-001',
    clientName: 'Shravani Solutions',
    clientCompanyName: 'Shravani IT Solutions',
    clientAddress: 'Phase 2, IT Park, Pune, Maharashtra, India - 411057',
    clientEmail: 'contact@shravanisolutions.com',
    clientPhone: '+91 94220 12345',
    clientGst: '27AABCS5564K2Z9',
    projectName: 'E-Commerce Website & Chatbot Integration',
    invoiceDate: '2026-06-15',
    dueDate: '2026-06-30',
    status: 'Paid',
    paymentTerms: 'Paid',
    currency: 'INR',
    gstPercent: 18,
    items: [
      {
        id: 'ii1',
        serviceName: 'Website Development',
        description: 'Full corporate website — frontend & backend development, responsive design, SEO optimization, and performance tuning.',
        qty: 1,
        rate: 25000,
        amount: 25000
      },
      {
        id: 'ii2',
        serviceName: 'AI Chatbot Development',
        description: 'Custom AI chatbot for customer support, lead generation, and dynamic user query handling.',
        qty: 1,
        rate: 15000,
        amount: 15000
      }
    ],
    subtotal: 40000,
    discount: 5000,
    taxableAmount: 35000,
    gstAmount: 6300,
    totalAmount: 41300,
    amountPaid: 41300,
    balanceAmount: 0,
    amountInWords: 'Rupees Forty One Thousand Three Hundred Only',
    notes: 'Payment received via bank transfer on June 18, 2026.',
    paymentMethod: 'UPI / Bank Transfer',
    createdAt: '2026-06-15T10:00:00Z'
  },
  {
    id: 'i2',
    invoiceNumber: 'LT-INV-2026-002',
    clientName: 'TechVeda Systems',
    clientCompanyName: 'TechVeda EdTech Pvt Ltd',
    clientAddress: 'Shahupuri 3rd Lane, Kolhapur, Maharashtra, India - 416001',
    clientEmail: 'billing@techveda.org',
    clientPhone: '+91 91234 56789',
    clientGst: '27AAGCT9012A1ZX',
    projectName: 'GenAI Applications Workshop FDP',
    invoiceDate: '2026-06-25',
    dueDate: '2026-07-10',
    status: 'Unpaid',
    paymentTerms: '15 Days',
    currency: 'INR',
    gstPercent: 18,
    items: [
      {
        id: 'ii3',
        serviceName: 'Certification Course Delivery',
        description: 'FDP and training setup for 150 faculty members with hand-on sandboxes and materials.',
        qty: 1,
        rate: 50000,
        amount: 50000
      }
    ],
    subtotal: 50000,
    discount: 0,
    taxableAmount: 50000,
    gstAmount: 9000,
    totalAmount: 59000,
    amountPaid: 0,
    balanceAmount: 59000,
    amountInWords: 'Rupees Fifty Nine Thousand Only',
    notes: 'Please release payment within terms of invoice.',
    paymentMethod: 'Bank Transfer',
    createdAt: '2026-06-25T14:30:00Z'
  }
];

const INITIAL_CERTIFICATES: Certificate[] = [
  {
    id: 'cert1',
    certificateId: 'LT-CERT-2026-8K7D',
    candidateName: 'Shahid Himmat Shaikh',
    candidateEmail: 'shahidshaikh3332@gmail.com',
    candidatePhone: '+91 98888 77777',
    collegeName: 'D.Y. Patil College of Engineering',
    department: 'Computer Science & Engineering',
    enrollmentId: 'DYP-2023-4412',
    certificateType: 'Industrial Training',
    programName: 'Industrial Training Program on Machine Learning',
    startDate: '2026-05-01',
    endDate: '2026-05-28',
    eventDate: '8 & 9 May 2026',
    duration: '4 Weeks',
    mode: 'Hybrid',
    location: 'Kolhapur',
    issueDate: '2026-06-01',
    textTemplate: 'This is to certify that Shahid Himmat Shaikh has successfully completed the Industrial Training Program on Machine Learning held from 2026-05-01 to 2026-05-28, organized by LihaTech. The participant has demonstrated dedication, active participation, and successfully completed all the hands-on sessions.',
    designTemplate: 'royal',
    createdAt: '2026-06-01T12:00:00Z'
  },
  {
    id: 'cert2',
    certificateId: 'LT-CERT-2026-X8Y1',
    candidateName: 'Shahid Himmat Shaikh',
    candidateEmail: 'shahidshaikh3332@gmail.com',
    candidatePhone: '+91 97777 66666',
    collegeName: 'KIT College of Engineering',
    department: 'Artificial Intelligence & Machine Learning',
    enrollmentId: 'KIT-AIML-110',
    certificateType: 'Internship Completion',
    programName: 'Artificial Intelligence & Generative AI Internship',
    startDate: '2026-05-15',
    endDate: '2026-06-25',
    eventDate: '',
    duration: '6 Weeks',
    mode: 'Online',
    location: 'Kolhapur / Remote',
    issueDate: '2026-06-26',
    textTemplate: 'This is to certify that Shahid Himmat Shaikh has successfully completed the internship program on Artificial Intelligence & Generative AI Internship at LihaTech from 2026-05-15 to 2026-06-25. During this period, the candidate demonstrated sincerity, technical understanding, active participation, and project-based learning skills.',
    designTemplate: 'emerald',
    createdAt: '2026-06-26T15:00:00Z'
  },
  {
    id: 'cert3',
    certificateId: 'LT-CERT-2026-OP01',
    candidateName: 'Shahid Himmat Shaikh',
    candidateEmail: 'shahidshaikh3332@gmail.com',
    candidatePhone: '+91 97777 66666',
    collegeName: 'KIT College of Engineering',
    department: 'Artificial Intelligence & Machine Learning',
    enrollmentId: 'KIT-AIML-110',
    certificateType: 'Outstanding Performer',
    programName: 'Full Stack & AI Innovation Program',
    startDate: '2026-05-01',
    endDate: '2026-06-30',
    eventDate: 'May - June 2026',
    duration: '8 Weeks',
    mode: 'Hybrid',
    location: 'Kolhapur',
    issueDate: '2026-06-30',
    completionText: 'for outstanding performance and exceptional dedication to',
    textTemplate: 'In recognition of exceptional performance, exemplary leadership, and remarkable commitment to excellence throughout the program.',
    designTemplate: 'royal',
    createdAt: '2026-06-30T17:00:00Z'
  },
  {
    id: 'cert4',
    certificateId: 'LT-CERT-2026-DYP01',
    candidateName: 'Shahid Himmat Shaikh',
    candidateEmail: 'shahidshaikh3332@gmail.com',
    candidatePhone: '+91 98888 77777',
    collegeName: 'DYPCET, Kolhapur',
    department: 'CSE (Data Science)',
    enrollmentId: 'DYP-DS-2026-08',
    certificateType: 'Appreciation Certificate',
    presentationText: 'THIS IS TO CERTIFY THAT',
    completionText: 'has actively participated and successfully completed',
    programName: 'Mock Interview & Technical Assessment at DYPCET, Kolhapur, in association with the CSE (Data Science) Department.',
    programFontSize: 17,
    startDate: '',
    endDate: '',
    eventDate: 'May 2026',
    dateLineText: 'held in May 2026',
    duration: '2 Days',
    mode: 'Offline',
    location: 'DYPCET Kolhapur',
    issueDate: '2026-05-30',
    textTemplate: 'The participant has demonstrated dedication, active participation, and successfully completed the technical evaluation with commendable skill and enthusiasm.',
    designTemplate: 'royal',
    createdAt: '2026-05-30T10:00:00Z'
  }
];

const INITIAL_LETTERS: Letter[] = [
  {
    id: 'letter1',
    candidateName: 'Shahid Himmat Shaikh',
    designation: 'Associate Software Engineer',
    department: 'Engineering',
    startDate: '2026-07-15',
    companyName: 'LihaTech Solutions Private Limited',
    issueDate: '2026-07-06',
    authorizedSignatory: 'Director|Business Operations',
    letterType: 'Job Offer',
    stipend: '₹4,50,000 / annum',
    employmentType: 'Full-time',
    location: 'Kolhapur Office',
    createdAt: '2026-07-06T10:00:00Z'
  },
  {
    id: 'letter2',
    candidateName: 'Shahid Himmat Shaikh',
    designation: 'AI Engineering Intern',
    department: 'AI & Research',
    startDate: '2026-07-10',
    endDate: '2026-10-10',
    companyName: 'LihaTech Solutions Private Limited',
    issueDate: '2026-07-05',
    authorizedSignatory: 'Director|Business Operations',
    letterType: 'Internship Offer',
    stipend: '₹15,000 / month',
    mode: 'Hybrid',
    reportingInstructions: 'Please report to the tech lead at 10:00 AM on July 10th at our Cyber City office or online via the Discord server.',
    collegeName: 'Bharati Vidyapeeth’s College of Engineering, Kolhapur',
    duration: '6 months',
    createdAt: '2026-07-05T12:00:00Z'
  },
  {
    id: 'letter3',
    candidateName: 'Shahid Himmat Shaikh',
    designation: 'UI/UX Designer',
    department: 'Product Design',
    startDate: '2025-06-01',
    endDate: '2026-06-30',
    companyName: 'LihaTech Solutions Private Limited',
    issueDate: '2026-07-01',
    authorizedSignatory: 'Director|Business Operations',
    letterType: 'Experience Certificate',
    conductStatement: 'During his tenure, we found him to be extremely diligent, highly creative, and cooperative. His performance was exemplary.',
    createdAt: '2026-07-01T09:00:00Z'
  }
];

const INITIAL_PAYSLIPS: Payslip[] = [
  {
    id: 'payslip1',
    employeeName: 'Shoaib Raza Qaisar Ali',
    employeeId: 'HPC-16190',
    designation: 'GENAI Engineer',
    department: 'Engineering',
    monthAndYear: 'February 2026',
    basicSalary: 60000,
    hra: 24000,
    allowances: 10000,
    bonus: 0,
    deductions: 0,
    pf: 0,
    professionalTax: 200,
    grossSalary: 94000,
    totalDeductions: 200,
    netSalary: 93800,
    paymentDate: '2026-02-28',
    createdAt: '2026-02-28T18:00:00Z',
    pan: 'BANPA9714P',
    dateOfJoining: '2/11/2022',
    bankAccName: '31868452086/SBI',
    location: 'Gurgaon',
    pfAccountNumber: 'NA',
    daysInMonth: 28,
    uan: 'NA',
    effectiveWorkDays: 28,
    lop: 0
  }
];

const INITIAL_ACTIVITIES: RecentActivity[] = [
  {
    id: 'act1',
    type: 'invoice_created',
    description: 'Invoice LT-INV-2026-001 created for Shravani Solutions',
    timestamp: '2026-06-15T10:00:00Z'
  },
  {
    id: 'act2',
    type: 'certificate_created',
    description: 'Certificate LT-CERT-2026-8K7D generated for Shahid Himmat Shaikh',
    timestamp: '2026-06-01T12:00:00Z'
  }
];

export const getStoredData = () => {
  if (typeof window === 'undefined') return {
    settings: INITIAL_COMPANY_SETTINGS,
    clients: INITIAL_CLIENTS,
    courses: INITIAL_COURSES,
    invoices: INITIAL_INVOICES,
    certificates: INITIAL_CERTIFICATES,
    activities: INITIAL_ACTIVITIES
  };

  const getOrSet = <T>(key: string, defaultValue: T): T => {
    const item = localStorage.getItem(key);
    if (item) {
      try {
        return JSON.parse(item) as T;
      } catch (e) {
        console.error(`Error parsing localStorage key: ${key}`, e);
      }
    }
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  };

  const settings = getOrSet<CompanySettings>('lihatech_settings', INITIAL_COMPANY_SETTINGS);
  
  // Auto-migrate to the new default logo if using the old default logo or if it refers to the old deleted logo
  if (!settings.logoUrl ||
    settings.logoUrl === DEFAULT_LOGO_SVG || (!settings.logoUrl.startsWith('data:image/') && (
    settings.logoUrl.includes('DEFAULT_LOGO_SVG') ||
    settings.logoUrl.includes('gear/tech') || 
    settings.logoUrl.includes('1E40AF') || 
    settings.logoUrl.includes('Tech diamond/shield icon') ||
    settings.logoUrl.includes('/assets/horizontal_logo')))
  ) {
    settings.logoUrl = uploadedLogo || DEFAULT_LOGO_SVG;
    localStorage.setItem('lihatech_settings', JSON.stringify(settings));
  }

  // Auto-migrate signature and stamp if they are still using old default inline SVG mockups and the user has uploaded actual files
  let settingsChanged = false;
  if (settings.signatureUrl === DEFAULT_SIGNATURE_SVG || !settings.signatureUrl || (!settings.signatureUrl.startsWith('data:image/') && (settings.signatureUrl.includes('sign.png') || settings.signatureUrl.includes('sign%20WO%20BG.png') || settings.signatureUrl.includes('sign WO BG.png')))) {
    settings.signatureUrl = uploadedSign || DEFAULT_SIGNATURE_SVG;
    settingsChanged = true;
  }
  if (settings.stampUrl === DEFAULT_STAMP_SVG || !settings.stampUrl || (!settings.stampUrl.startsWith('data:image/') && settings.stampUrl.includes('stamp.png'))) {
    settings.stampUrl = uploadedStamp || DEFAULT_STAMP_SVG;
    settingsChanged = true;
  }
  if (settingsChanged) {
    localStorage.setItem('lihatech_settings', JSON.stringify(settings));
  }

  const rawCertificates = getOrSet<Certificate[]>('lihatech_certificates', INITIAL_CERTIFICATES);
  const rawLetters = getOrSet<Letter[]>('lihatech_letters', INITIAL_LETTERS);
  const rawPayslips = getOrSet<Payslip[]>('lihatech_payslips', INITIAL_PAYSLIPS);
  const rawActivities = getOrSet<RecentActivity[]>('lt_activities', INITIAL_ACTIVITIES);

  let certificatesChanged = false;
  const certificates = rawCertificates.map(cert => {
    let changed = false;
    let name = cert.candidateName;
    let txt = cert.textTemplate;
    
    const oldNames = ['Salif Humayun Sayyad', 'Aditi Rahul Patil', 'Salif Sayyad', 'Aditi Patil'];
    for (const old of oldNames) {
      if (name.includes(old) || old.includes(name)) {
        name = 'Shahid Himmat Shaikh';
        changed = true;
      }
      if (txt.includes(old)) {
        txt = txt.replaceAll(old, 'Shahid Himmat Shaikh');
        changed = true;
      }
    }
    
    if (changed) {
      certificatesChanged = true;
      return { ...cert, candidateName: name, textTemplate: txt };
    }
    return cert;
  });

  if (!certificates.some(c => c.certificateType.toLowerCase().includes('outstanding') || c.certificateType.toLowerCase().includes('performer'))) {
    const opCert = INITIAL_CERTIFICATES.find(c => c.id === 'cert3');
    if (opCert) {
      certificates.push(opCert);
      certificatesChanged = true;
    }
  }

  if (!certificates.some(c => c.programName.includes('DYPCET'))) {
    const dypCert = INITIAL_CERTIFICATES.find(c => c.id === 'cert4');
    if (dypCert) {
      certificates.push(dypCert);
      certificatesChanged = true;
    }
  }

  if (certificatesChanged) {
    localStorage.setItem('lihatech_certificates', JSON.stringify(certificates));
  }

  let lettersChanged = false;
  const letters = rawLetters.map(letter => {
    let changed = false;
    let name = letter.candidateName;
    let stmt = letter.conductStatement;
    
    const oldNames = ['Aditya Milind Kulkarni', 'Mayur Gorakh Khade', 'Pratiksha Dinkar Patil'];
    for (const old of oldNames) {
      if (name === old) {
        name = 'Shahid Himmat Shaikh';
        changed = true;
      }
    }
    if (stmt && stmt.includes('her tenure')) {
      stmt = stmt.replaceAll('her tenure', 'his tenure').replaceAll('found her', 'found him').replaceAll('Her performance', 'His performance').replaceAll('Her conduct', 'His conduct');
      changed = true;
    }
    
    if (changed) {
      lettersChanged = true;
      return { ...letter, candidateName: name, conductStatement: stmt };
    }
    return letter;
  });
  if (lettersChanged) {
    localStorage.setItem('lihatech_letters', JSON.stringify(letters));
  }

  let payslipsChanged = false;
  const payslips = rawPayslips.map(payslip => {
    let changed = false;
    let name = payslip.employeeName;
    if (name === 'Rahul Suresh Deshmukh' || name === 'Rahul Deshmukh') {
      name = 'Shahid Himmat Shaikh';
      changed = true;
    }
    if (changed) {
      payslipsChanged = true;
      return { ...payslip, employeeName: name };
    }
    return payslip;
  });
  if (payslipsChanged) {
    localStorage.setItem('lihatech_payslips', JSON.stringify(payslips));
  }

  let activitiesChanged = false;
  const activities = rawActivities.map(act => {
    let desc = act.description;
    let changed = false;
    const oldNames = ['Salif Humayun Sayyad', 'Aditi Rahul Patil', 'Aditya Milind Kulkarni', 'Mayur Gorakh Khade', 'Pratiksha Dinkar Patil', 'Rahul Suresh Deshmukh'];
    for (const old of oldNames) {
      if (desc.includes(old)) {
        desc = desc.replaceAll(old, 'Shahid Himmat Shaikh');
        changed = true;
      }
    }
    if (changed) {
      activitiesChanged = true;
      return { ...act, description: desc };
    }
    return act;
  });
  if (activitiesChanged) {
    localStorage.setItem('lt_activities', JSON.stringify(activities));
  }

  const storedCourses = getOrSet<Course[]>('lt_courses', INITIAL_COURSES);
  if (!storedCourses.some(c => c.type.toLowerCase().includes('outstanding') || c.name.toLowerCase().includes('outstanding'))) {
    const opCourse = INITIAL_COURSES.find(c => c.id === 'p4');
    if (opCourse) {
      storedCourses.push(opCourse);
      localStorage.setItem('lt_courses', JSON.stringify(storedCourses));
    }
  }

  if (!storedCourses.some(c => c.name.includes('DYPCET'))) {
    const dypCourse = INITIAL_COURSES.find(c => c.id === 'p5');
    if (dypCourse) {
      storedCourses.push(dypCourse);
      localStorage.setItem('lt_courses', JSON.stringify(storedCourses));
    }
  }

  return {
    settings,
    clients: getOrSet<Client[]>('lt_clients', INITIAL_CLIENTS),
    courses: storedCourses,
    invoices: getOrSet<Invoice[]>('lihatech_invoices', INITIAL_INVOICES),
    certificates,
    letters,
    payslips,
    activities
  };
};

export const saveStoredData = (data: {
  settings?: CompanySettings;
  clients?: Client[];
  courses?: Course[];
  invoices?: Invoice[];
  certificates?: Certificate[];
  letters?: Letter[];
  payslips?: Payslip[];
  activities?: RecentActivity[];
}) => {
  if (typeof window === 'undefined') return;

  if (data.settings) localStorage.setItem('lihatech_settings', JSON.stringify(data.settings));
  if (data.clients) localStorage.setItem('lt_clients', JSON.stringify(data.clients));
  if (data.courses) localStorage.setItem('lt_courses', JSON.stringify(data.courses));
  if (data.invoices) {
    localStorage.setItem('lihatech_invoices', JSON.stringify(data.invoices));
    // Also update sequence count
    localStorage.setItem('lihatech_invoice_sequence', String(data.invoices.length));
  }
  if (data.certificates) localStorage.setItem('lihatech_certificates', JSON.stringify(data.certificates));
  if (data.letters) localStorage.setItem('lihatech_letters', JSON.stringify(data.letters));
  if (data.payslips) localStorage.setItem('lihatech_payslips', JSON.stringify(data.payslips));
  if (data.activities) localStorage.setItem('lt_activities', JSON.stringify(data.activities));
};

export const addRecentActivity = (type: RecentActivity['type'], description: string) => {
  const current = getStoredData();
  const newActivity: RecentActivity = {
    id: 'act_' + Date.now(),
    type,
    description,
    timestamp: new Date().toISOString()
  };
  const updated = [newActivity, ...current.activities].slice(0, 50); // Keep last 50
  saveStoredData({ activities: updated });
};
