export interface CompanySettings {
  name: string;
  tagline: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  qrCodeUrl: string; // Base64 or placeholder SVG
  logoUrl: string; // Base64 or placeholder SVG
  directorName: string;
  directorDesignation: string;
  signatureUrl: string; // Base64 or placeholder SVG
  stampUrl: string; // Base64 or placeholder SVG
  defaultGstPercent: number;
  defaultTerms: string[];
  certTemplate: 'royal' | 'emerald' | 'academic' | 'modern-blue';
  defaultCertText?: string;
  certificatePartners?: CertificatePartnerProfile[];
  userPassword?: string;
  userUsername?: string;
}

export interface CertificatePartnerProfile {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  website?: string;
}

export type CertificateLayoutElement = 'issuer' | 'partner' | 'title' | 'presentation' | 'candidate' | 'completion' | 'program' | 'date' | 'organizer' | 'description' | 'badge' | 'certificateId' | 'stamp' | 'issueDate' | 'signature';

export interface CertificateLayoutElementStyle {
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface CertificateLayout {
  offsets: Partial<Record<CertificateLayoutElement, { x: number; y: number }>>;
  sizes?: Partial<Record<CertificateLayoutElement, { width: number; height: number }>>;
  styles?: Partial<Record<CertificateLayoutElement, CertificateLayoutElementStyle>>;
}

export interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  gstNumber?: string;
  notes?: string;
}

export interface Course {
  id: string;
  name: string;
  type: string; // e.g. Course Completion, Internship Completion, Workshop, etc.
  duration: string;
  mode: 'Online' | 'Offline' | 'Hybrid';
  description: string;
  defaultText: string;
}

export interface InvoiceItem {
  id: string;
  serviceName: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // LT-INV-YYYY-001
  clientName: string;
  clientCompanyName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  clientGst?: string;
  projectName: string;
  invoiceDate: string;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Partially Paid';
  paymentTerms: string;
  currency: 'INR' | 'USD' | 'EUR';
  gstPercent: number;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceAmount: number;
  amountInWords: string;
  notes: string;
  paymentMethod: string;
  invoiceType?: 'service' | 'course';
  createdAt: string;
  bulkGroupId?: string;
}

export interface Certificate {
  id: string;
  certificateId: string; // LT-CERT-YYYY-XXXX
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  collegeName?: string;
  department?: string;
  enrollmentId?: string;
  certificateType: string;
  programName: string;
  programFontSize?: number;
  startDate?: string;
  endDate?: string;
  eventDate?: string;
  duration?: string;
  mode: string;
  location: string;
  issueDate: string;
  textTemplate: string;
  designTemplate: 'royal' | 'emerald' | 'academic' | 'modern-blue';
  createdAt: string;
  bulkGroupId?: string;
  completionText?: string;
  presentationText?: string;
  dateLineText?: string;
  partnerProfileId?: string;
  partnerName?: string;
  partnerTagline?: string;
  partnerLogoUrl?: string;
  certificateLayout?: CertificateLayout;
}

export interface RecentActivity {
  id: string;
  type: 'invoice_created' | 'certificate_created' | 'bulk_generated' | 'client_added' | 'course_added' | 'invoice_updated' | 'certificate_updated' | 'letter_created' | 'letter_updated' | 'payslip_created' | 'payslip_updated';
  description: string;
  timestamp: string;
}

export type LetterType = 'Internship Offer' | 'Job Offer' | 'Experience Certificate' | 'Relieving Letter';

export interface Letter {
  id: string;
  referenceNo?: string;
  candidateName: string;
  designation: string;
  department: string;
  startDate: string;
  endDate?: string;
  stipend?: string; // Stipend/Salary depending on context
  companyName: string;
  issueDate: string;
  authorizedSignatory: string;
  letterType: LetterType;
  mode?: string; // Internship mode: Online, Offline, Hybrid
  reportingInstructions?: string; // Internship reporting details
  employmentType?: string; // Job Offer: Full-time, etc.
  location?: string; // Job Offer: Bangalore, Remote, etc.
  conductStatement?: string; // Experience Certificate conduct
  collegeName?: string; // e.g. College name for interns
  duration?: string; // e.g. "6 months" or "3 months"
  addressTo?: 'college' | 'candidate'; // Add property to customize recipient
  dob?: string;
  parentName?: string;
  aadhaar?: string;
  uanEsic?: string;
  skillCategory?: string;
  reportingTo?: string;
  probation?: string;
  workingDays?: string;
  workingHours?: string;
  noticePeriod?: string;
  customSalaryEnabled?: boolean;
  customBasicMonthly?: number;
  customHraMonthly?: number;
  customSpecialMonthly?: number;
  customOtherMonthly?: number;
  customEmployerPFMonthly?: number;
  customEmployerESICMonthly?: number;
  customOtherBenefitsMonthly?: number;
  noStipend?: boolean;
  createdAt: string;
}

export interface Payslip {
  id: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  monthAndYear: string; // e.g. "July 2026"
  basicSalary: number;
  hra: number;
  allowances: number;
  bonus: number;
  deductions: number; // other deductions
  pf: number;
  professionalTax: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  paymentDate: string;
  createdAt: string;
  pan?: string;
  dateOfJoining?: string;
  bankAccName?: string;
  location?: string;
  pfAccountNumber?: string;
  daysInMonth?: number;
  uan?: string;
  effectiveWorkDays?: number;
  lop?: number;
}
