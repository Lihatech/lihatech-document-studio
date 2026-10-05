import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { Letter, CompanySettings } from '../../types';
import companyWatermark from '../../../only_logo-removebg-preview.png';

// Register a font that supports the Indian Rupee symbol (₹) and Indian text.
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVmUiA8.ttf' },
    { src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjalmUiA8.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9.5,
    lineHeight: 1.45,
    color: '#000000',
    paddingTop: 35,
    paddingBottom: 35,
    paddingLeft: 45,
    paddingRight: 45,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  watermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  watermark: {
    width: 320,
    height: 320,
    opacity: 0.12,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    height: 42,
    width: 'auto',
    maxWidth: 160,
  },
  logoFallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#312e81',
  },
  headerRight: {
    textAlign: 'right',
    maxWidth: 240,
  },
  companyNameHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
    color: '#000000',
  },
  headerText: {
    fontSize: 8.5,
    color: '#334155',
    marginBottom: 1,
  },
  simplifiedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.8,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
    marginBottom: 8,
  },
  simplifiedHeaderLeft: {
    fontSize: 8.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#000000',
  },
  simplifiedHeaderRight: {
    fontSize: 8,
    color: '#475569',
    fontWeight: 'bold',
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9.5,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  metaLabel: {
    color: '#334155',
    fontWeight: 'normal',
  },
  metaValue: {
    color: '#000000',
    fontWeight: 'bold',
  },
  candidateAddressSection: {
    marginBottom: 15,
  },
  candidateGreetingText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  candidateAddressLine: {
    fontSize: 9.5,
    color: '#000000',
    marginBottom: 1,
  },
  candidateAddressPlaceholder: {
    fontSize: 9.5,
    color: '#94a3b8',
  },
  subjectContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  subjectTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    borderBottomWidth: 1.5,
    borderBottomColor: '#94a3b8',
    paddingBottom: 1.5,
    letterSpacing: 0.5,
  },
  bodyContainer: {
    flex: 1,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: 'justify',
    fontSize: 9.5,
  },
  boldParagraph: {
    fontWeight: 'bold',
    color: '#000000',
  },
  highlightWelcome: {
    fontSize: 10.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginVertical: 4,
    color: '#000000',
  },
  termItem: {
    marginBottom: 7,
    textAlign: 'justify',
    fontSize: 8.8,
  },
  termTitle: {
    fontWeight: 'bold',
    color: '#000000',
  },
  annexureTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 5,
    letterSpacing: 0.5,
    color: '#000000',
  },
  employeeMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 2,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#94a3b8',
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
    borderBottomWidth: 0.5,
    borderBottomColor: '#94a3b8',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowTotal: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    fontWeight: 'bold',
    borderBottomWidth: 0.5,
    borderBottomColor: '#94a3b8',
  },
  tableCellParticulars: {
    width: '60%',
    padding: '3 6',
    fontSize: 8.5,
    borderRightWidth: 0.5,
    borderRightColor: '#94a3b8',
  },
  tableCellAmount: {
    width: '20%',
    padding: '3 6',
    fontSize: 8.5,
    textAlign: 'right',
    borderRightWidth: 0.5,
    borderRightColor: '#94a3b8',
  },
  tableCellAmountLast: {
    width: '20%',
    padding: '3 6',
    fontSize: 8.5,
    textAlign: 'right',
  },
  tableCaption: {
    fontSize: 7.8,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  acceptanceSection: {
    borderTopWidth: 0.8,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  acceptanceTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  acceptanceText: {
    fontSize: 8.8,
    textAlign: 'justify',
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 0.8,
    borderTopColor: '#cbd5e1',
  },
  candidateSignatureBlock: {
    width: '45%',
    fontSize: 9,
    fontWeight: 'bold',
  },
  signatureLineText: {
    marginBottom: 4,
  },
  signatureNormalText: {
    fontWeight: 'normal',
  },
  authorizedSignatureBlock: {
    width: '45%',
    alignItems: 'center',
    textAlign: 'center',
  },
  authorizedSignatoryLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  signatureImageContainer: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  signatureImage: {
    height: 36,
    width: 'auto',
  },
  authorizedSignatoryName: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginTop: 2,
  },
  authorizedSignatoryTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#334155',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  footerContainer: {
    borderTopWidth: 0.8,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#475569',
    fontWeight: 'bold',
  },
  annexureTitleSmall: {
    fontSize: 10.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
    borderBottomWidth: 0.8,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
    color: '#000000',
  },
  annexure2Intro: {
    fontSize: 8.8,
    fontWeight: 'bold',
    textAlign: 'justify',
    marginBottom: 8,
  },
  annexure2CategoryTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#000000',
    marginTop: 4,
    marginBottom: 3,
  },
  bulletList: {
    paddingLeft: 10,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  bulletSign: {
    width: 15,
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
  },
});

interface JobOfferLetterPDFProps {
  letter: Letter;
  settings: CompanySettings;
}

export default function JobOfferLetterPDF({ letter, settings }: JobOfferLetterPDFProps) {
  const referenceId = letter.referenceNo || `LT/HR/${new Date(letter.startDate || letter.issueDate || Date.now()).getFullYear()}/${letter.id.slice(-4).toUpperCase()}`;
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return dateStr;
  };

  const formatAddress = (addressStr: string) => {
    if (!addressStr) return [];
    const parts = addressStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length <= 2) return parts;
    const mid = Math.ceil(parts.length / 2);
    const line1 = parts.slice(0, mid).join(', ');
    const line2 = parts.slice(mid).join(', ');
    return [line1, line2];
  };

  const getCandidateLocation = () => {
    if (letter.collegeName && letter.collegeName.trim()) {
      const lines = letter.collegeName.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const commaParts = lastLine.split(',');
        if (commaParts.length > 0) {
          const candidateCity = commaParts[0].trim();
          if (candidateCity && !/^\d+$/.test(candidateCity)) {
            return candidateCity;
          }
        }
        return lastLine;
      }
    }
    return '';
  };

  const parseCTC = (ctcStr: string): number => {
    if (!ctcStr) return 450000;
    const cleaned = ctcStr.replace(/[^0-9]/g, '');
    const val = Number(cleaned);
    return val > 0 ? val : 450000;
  };

  const formatRupees = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  // Watermark Component rendered on every page safely
  const Watermark = () => (
    <View style={styles.watermarkContainer} pointerEvents="none">
      {companyWatermark ? (
        <Image src={companyWatermark} style={styles.watermark} />
      ) : null}
    </View>
  );

  // Standard Header Component for page 1
  const HeaderPage1 = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerLeft}>
        {settings.logoUrl ? (
          <Image src={settings.logoUrl} style={styles.logo} />
        ) : (
          <Text style={styles.logoFallbackText}>{settings.name}</Text>
        )}
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.companyNameHeader}>{settings.name}</Text>
        {formatAddress(settings.address).map((line, idx) => (
          <Text key={idx} style={styles.headerText}>{line}</Text>
        ))}
        <Text style={styles.headerText}>Email: {settings.email} | Web: {settings.website}</Text>
      </View>
    </View>
  );

  // Simplified Header Component for sub-pages (pages 2, 3, 4)
  const HeaderSubPage = () => (
    <View style={styles.simplifiedHeader}>
      <Text style={styles.simplifiedHeaderLeft}>{settings.name}</Text>
      <Text style={styles.simplifiedHeaderRight}>Ref: {referenceId}</Text>
    </View>
  );

  // Footer Component
  const Footer = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => (
    <View style={styles.footerContainer}>
      <Text>Page {pageNumber} of {totalPages}</Text>
      <Text>{settings.name} - Employment Offer Letter</Text>
    </View>
  );

  const annualCTC = parseCTC(letter.stipend || '₹4,50,000 / annum');
  const monthlyCTC = Math.round(annualCTC / 12);
  
  let employerPF = annualCTC >= 250000 ? 1800 : 0;
  let employerESIC = (monthlyCTC <= 21000) ? Math.round(monthlyCTC * 0.0325) : 0;
  let gratuityProvision = Math.round((monthlyCTC - employerPF) * 0.0481);
  let grossFixedEarnings = monthlyCTC - employerPF - employerESIC - gratuityProvision;
  
  let basicPay = Math.round(grossFixedEarnings * 0.50);
  let hra = Math.round(basicPay * 0.40);
  let specialAllowance = grossFixedEarnings - basicPay - hra;
  let otherAllowance = 0;

  if (letter.customSalaryEnabled) {
    hra = (letter.customHraMonthly !== undefined && !isNaN(Number(letter.customHraMonthly))) ? Number(letter.customHraMonthly) : 0;
    specialAllowance = (letter.customSpecialMonthly !== undefined && !isNaN(Number(letter.customSpecialMonthly))) ? Number(letter.customSpecialMonthly) : 0;
    otherAllowance = (letter.customOtherMonthly !== undefined && !isNaN(Number(letter.customOtherMonthly))) ? Number(letter.customOtherMonthly) : 0;
    employerPF = (letter.customEmployerPFMonthly !== undefined && !isNaN(Number(letter.customEmployerPFMonthly))) ? Number(letter.customEmployerPFMonthly) : 0;
    employerESIC = (letter.customEmployerESICMonthly !== undefined && !isNaN(Number(letter.customEmployerESICMonthly))) ? Number(letter.customEmployerESICMonthly) : 0;
    gratuityProvision = (letter.customOtherBenefitsMonthly !== undefined && !isNaN(Number(letter.customOtherBenefitsMonthly))) ? Number(letter.customOtherBenefitsMonthly) : 0;
    
    basicPay = Math.max(0, monthlyCTC - (hra + specialAllowance + otherAllowance + employerPF + employerESIC + gratuityProvision));
    grossFixedEarnings = basicPay + hra + specialAllowance + otherAllowance;
  }

  const calcMonthlyCTC = letter.customSalaryEnabled 
    ? (grossFixedEarnings + employerPF + employerESIC + gratuityProvision)
    : monthlyCTC;
  const calcAnnualCTC = letter.customSalaryEnabled
    ? (calcMonthlyCTC * 12)
    : annualCTC;

  const candidateAddressLines = letter.collegeName && letter.collegeName.trim()
    ? letter.collegeName.split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <Document>
      {/* PAGE 1: Core Offer Letter */}
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderPage1 />
          
          <View style={styles.metaSection}>
            <Text>
              <Text style={styles.metaLabel}>Ref No: </Text>
              <Text style={styles.metaValue}>{referenceId}</Text>
            </Text>
            <Text>
              <Text style={styles.metaLabel}>Date: </Text>
              <Text style={styles.metaValue}>{formatDate(letter.issueDate)}</Text>
            </Text>
          </View>

          <View style={styles.candidateAddressSection}>
            <Text style={styles.candidateGreetingText}>{letter.candidateName}</Text>
            {candidateAddressLines.length > 0 ? (
              candidateAddressLines.map((line, idx) => (
                <Text key={idx} style={styles.candidateAddressLine}>{line}</Text>
              ))
            ) : (
              <View>
                <Text style={styles.candidateAddressPlaceholder}>[Address Line 1]</Text>
                <Text style={styles.candidateAddressPlaceholder}>[Address Line 2]</Text>
                <Text style={styles.candidateAddressPlaceholder}>[City, State – PIN Code]</Text>
              </View>
            )}
          </View>

          <View style={styles.subjectContainer}>
            <Text style={styles.subjectTitle}>Offer of Employment</Text>
          </View>

          <View>
            <Text style={[styles.paragraph, styles.boldParagraph]}>Dear {letter.candidateName},</Text>
            
            <Text style={styles.highlightWelcome}>
              Welcome to {settings.name}.
            </Text>
            
            <Text style={styles.paragraph}>
              With reference to your application and subsequent discussions, we are pleased to offer you the position of <Text style={styles.boldParagraph}>“{letter.designation}”</Text> at {settings.name}, subject to the terms and conditions mentioned in this letter.
            </Text>
            
            <Text style={styles.paragraph}>
              We look forward to your joining on or before <Text style={styles.boldParagraph}>{formatDate(letter.startDate)}</Text>. Your employment will be effective from your date of joining.
            </Text>
            
            <Text style={styles.paragraph}>
              You will be based at our <Text style={styles.boldParagraph}>{letter.location || 'Kolhapur Office'}</Text>.
            </Text>

            <Text style={styles.paragraph}>
              Your annual Cost to Company will be <Text style={styles.boldParagraph}>{formatRupees(annualCTC)}</Text>, as detailed in <Text style={styles.boldParagraph}>Annexure I</Text>.
            </Text>

            <Text style={styles.paragraph}>
              Please sign and return a copy of this letter as confirmation of your acceptance.
            </Text>

            <Text style={[styles.paragraph, styles.boldParagraph]}>
              We are pleased to welcome you to {settings.name} and look forward to a successful and mutually rewarding association.
            </Text>
          </View>
        </View>
        <Footer pageNumber={1} totalPages={4} />
      </Page>

      {/* PAGE 2: Terms and Conditions 1-12 */}
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderSubPage />
          
          <View style={styles.subjectContainer}>
            <Text style={styles.subjectTitle}>Terms and Conditions of Employment</Text>
          </View>

          <View>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>1. Working Hours: </Text>
              Your normal working hours will be from <Text style={{fontWeight: 'bold'}}>{letter.workingHours || '9:00 AM to 6:00 PM'}</Text>, from <Text style={{fontWeight: 'bold'}}>{letter.workingDays || 'Monday to Saturday'}</Text>. Depending on project, training or client requirements, you may occasionally be required to work beyond normal working hours.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>2. Probation Period: </Text>
              You will be on probation for a period of <Text style={{fontWeight: 'bold'}}>{letter.probation || 'six months'}</Text> from your date of joining. Your confirmation will be based on satisfactory performance, conduct and attendance and will be communicated to you in writing. The probation period may be extended if additional performance evaluation is required.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>3. Salary and Benefits: </Text>
              Your annual Cost to Company will be <Text style={{fontWeight: 'bold'}}>{formatRupees(annualCTC)}</Text>. The detailed salary structure is provided in Annexure I. Your salary will be subject to statutory deductions, including Professional Tax, Provident Fund, ESIC and Income Tax, wherever applicable.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>4. Leave: </Text>
              You will be eligible for leave and holidays according to {settings.name}’s leave policy and applicable law. All planned leave must be approved in advance by your reporting manager.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>5. Duties and Responsibilities: </Text>
              You will perform the duties related to your position and any other reasonable responsibilities assigned by the Company. You are expected to perform your duties honestly, professionally and in the best interests of {settings.name} and its clients.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>6. Place of Work: </Text>
              Your initial place of work will be <Text style={{fontWeight: 'bold'}}>{letter.location || 'Kolhapur Office'}</Text>. Depending on business or project requirements, you may be assigned to another project, department, client location, remote working arrangement or office location.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>7. Confidentiality: </Text>
              You must maintain confidentiality regarding all non-public information relating to {settings.name}, its clients, students, employees and business partners. This includes source code, project documents, AI workflows, datasets, course material, client information, passwords, API keys, pricing and business plans. Confidential information must not be copied, shared, published or used for any unauthorised purpose during or after your employment.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>8. Intellectual Property: </Text>
              All software, source code, designs, documents, training material, presentations, AI agents, prompts, workflows, datasets and other work created by you during your employment for {settings.name} or its clients will belong to {settings.name} or the concerned client, as applicable.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>9. Outside Employment: </Text>
              You must not undertake any employment, freelancing, consultancy, training assignment or business activity that conflicts with your duties at {settings.name} without prior written approval.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>10. Company Property: </Text>
              All laptops, documents, identity cards, accounts, software access, credentials and other property provided by {settings.name} or its clients must be used only for official work. All Company and client property must be returned at the time of resignation, termination or whenever requested.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>11. Professional Conduct: </Text>
              You are expected to maintain professional behaviour and comply with the Company’s policies relating to attendance, workplace conduct, information security, prevention of harassment and client interaction.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>12. Background Verification: </Text>
              This offer is subject to verification of the information and documents provided by you. If any information or document is found to be materially false or misleading, the Company may withdraw this offer or take appropriate disciplinary action.
            </Text>
          </View>
        </View>
        <Footer pageNumber={2} totalPages={4} />
      </Page>

      {/* PAGE 3: Terms and Conditions 13-16 & Annexure I Table */}
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderSubPage />
          
          <View>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>13. Notice Period: </Text>
              During probation, either party may terminate the employment by giving <Text style={{fontWeight: 'bold'}}>15 days’ written notice</Text> or salary in lieu of notice. After confirmation, either party may terminate the employment by giving <Text style={{fontWeight: 'bold'}}>{letter.noticePeriod || '30 days'}’ written notice</Text> or salary in lieu of notice, subject to Company approval and applicable law. The Company may terminate employment in cases of serious misconduct, fraud, data theft, breach of confidentiality, harassment, document falsification or wilful damage to Company or client property.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>14. Resignation and Handover: </Text>
              At the time of resignation or termination, you must complete the required notice period, project handover, knowledge transfer, return of assets and clearance formalities. Final settlement and employment documents will be processed after completion of the exit formalities.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>15. Company Policies: </Text>
              You will be governed by {settings.name}’s rules, regulations and policies as amended from time to time. Any major change relating to your designation, fixed salary or employment type will be communicated to you in writing.
            </Text>
            <Text style={styles.termItem}>
              <Text style={styles.termTitle}>16. Governing Law: </Text>
              Your employment will be governed by the applicable laws of India. Subject to the jurisdiction of the appropriate labour authorities and tribunals, courts at <Text style={{fontWeight: 'bold'}}>Kolhapur, Maharashtra</Text> will have jurisdiction over matters arising from your employment.
            </Text>
          </View>

          {/* Annexure I */}
          <View style={{ marginTop: 8 }}>
            <Text style={styles.annexureTitle}>Annexure I — Compensation Details</Text>
            
            <View style={styles.employeeMetaGrid}>
              <Text>Employee Name: <Text style={{ fontWeight: 'bold' }}>{letter.candidateName}</Text></Text>
              <Text>Designation: <Text style={{ fontWeight: 'bold' }}>{letter.designation}</Text></Text>
            </View>

            {/* Table */}
            <View style={styles.table}>
              {/* Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCellParticulars, { fontWeight: 'bold' }]}>Particulars</Text>
                <Text style={[styles.tableCellAmount, { fontWeight: 'bold' }]}>Monthly</Text>
                <Text style={[styles.tableCellAmountLast, { fontWeight: 'bold', textAlign: 'right' }]}>Annual</Text>
              </View>
              {/* Basic */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>Basic Salary</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(basicPay)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(basicPay * 12)}</Text>
              </View>
              {/* HRA */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>House Rent Allowance</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(hra)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(hra * 12)}</Text>
              </View>
              {/* Special */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>Special Allowance</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(specialAllowance)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(specialAllowance * 12)}</Text>
              </View>
              {/* Other */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>Other Allowance</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(otherAllowance)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(otherAllowance * 12)}</Text>
              </View>
              {/* Gross */}
              <View style={styles.tableRowTotal}>
                <Text style={[styles.tableCellParticulars, { fontWeight: 'bold' }]}>Gross Salary</Text>
                <Text style={[styles.tableCellAmount, { fontWeight: 'bold' }]}>{formatRupees(grossFixedEarnings)}</Text>
                <Text style={[styles.tableCellAmountLast, { fontWeight: 'bold', textAlign: 'right' }]}>{formatRupees(grossFixedEarnings * 12)}</Text>
              </View>
              {/* Employer PF */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>Employer PF Contribution</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(employerPF)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(employerPF * 12)}</Text>
              </View>
              {/* Employer ESIC */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>Employer ESIC Contribution</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(employerESIC)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(employerESIC * 12)}</Text>
              </View>
              {/* Other Benefits */}
              <View style={styles.tableRow}>
                <Text style={styles.tableCellParticulars}>Other Benefits</Text>
                <Text style={styles.tableCellAmount}>{formatRupees(gratuityProvision)}</Text>
                <Text style={styles.tableCellAmountLast}>{formatRupees(gratuityProvision * 12)}</Text>
              </View>
              {/* CTC */}
              <View style={styles.tableRowTotal}>
                <Text style={[styles.tableCellParticulars, { fontWeight: 'bold' }]}>Total Cost to Company (CTC)</Text>
                <Text style={[styles.tableCellAmount, { fontWeight: 'bold' }]}>{formatRupees(calcMonthlyCTC)}</Text>
                <Text style={[styles.tableCellAmountLast, { fontWeight: 'bold', textAlign: 'right' }]}>{formatRupees(calcAnnualCTC)}</Text>
              </View>
            </View>
            
            <Text style={styles.tableCaption}>
              Salary will be subject to statutory deductions and other deductions permitted under applicable law.
            </Text>
          </View>

          {/* Acceptance */}
          <View style={styles.acceptanceSection}>
            <Text style={styles.acceptanceTitle}>Acceptance</Text>
            <Text style={styles.acceptanceText}>
              I, <Text style={{fontWeight: 'bold'}}>{letter.candidateName}</Text>, confirm that I have read, understood and accepted the terms and conditions stated in this Offer of Employment.
            </Text>
          </View>

          <View style={styles.signaturesRow}>
            <View style={styles.candidateSignatureBlock}>
              <Text style={styles.signatureLineText}>Candidate Signature: __________________</Text>
              <Text style={styles.signatureLineText}>Candidate Name: <Text style={styles.signatureNormalText}>{letter.candidateName}</Text></Text>
              <Text style={styles.signatureLineText}>Place: ___________________________</Text>
              <Text style={styles.signatureLineText}>Date: ____________________________</Text>
            </View>

            <View style={styles.authorizedSignatureBlock}>
              <Text style={styles.authorizedSignatoryLabel}>For {settings.name}</Text>
              
              <View style={styles.signatureImageContainer}>
                {settings.signatureUrl ? (
                  <Image src={settings.signatureUrl} style={styles.signatureImage} />
                ) : null}
              </View>

              {letter.authorizedSignatory === 'Yameen Hakim' || letter.authorizedSignatory === 'Director|Business Operations' ? (
                <Text style={styles.authorizedSignatoryName}>Director|Business Operations</Text>
              ) : (
                <>
                  <Text style={styles.authorizedSignatoryName}>{letter.authorizedSignatory}</Text>
                  <Text style={styles.authorizedSignatoryTitle}>Director|Business Operations</Text>
                </>
              )}
            </View>
          </View>
        </View>
        <Footer pageNumber={3} totalPages={4} />
      </Page>

      {/* PAGE 4: Annexure II Required Documents */}
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderSubPage />
          
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.annexureTitleSmall}>Annexure II — Required Documents</Text>
          </View>

          <Text style={styles.annexure2Intro}>
            Every employee as per the terms of Offer of Employment is requested to submit the following documents to our HR Personnel at the time of your reporting to duty at {settings.name} Office.
          </Text>

          <View>
            {/* Personal Data */}
            <Text style={styles.annexure2CategoryTitle}>1. Personal Data:</Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>a.</Text>
                <Text style={styles.bulletText}>Passport copy (along with all used pages)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>b.</Text>
                <Text style={styles.bulletText}>3 Photographs (Passport size)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>c.</Text>
                <Text style={styles.bulletText}>Aadhar card copy</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>d.</Text>
                <Text style={styles.bulletText}>PAN Card Copy</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>e.</Text>
                <Text style={styles.bulletText}>Proof of present and permanent address (photocopy)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>f.</Text>
                <Text style={styles.bulletText}>Mark Sheets and Certificate of Class X & Class XII</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>g.</Text>
                <Text style={styles.bulletText}>Graduation Certificate (all mark memos and certificates)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>h.</Text>
                <Text style={styles.bulletText}>Post-Graduation Certificate (all mark memos and certificates)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>i.</Text>
                <Text style={styles.bulletText}>Mark sheets and Certificates of Diploma(s)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>j.</Text>
                <Text style={styles.bulletText}>Mark sheets and Certificates of any training(s) attended</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>k.</Text>
                <Text style={styles.bulletText}>Any other additional diplomas/certificates (Mark-sheets)</Text>
              </View>
            </View>

            {/* Previous Employment Record */}
            <Text style={styles.annexure2CategoryTitle}>2. Previous Employment Record:</Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>a.</Text>
                <Text style={styles.bulletText}>Relieving Letter and Service / Experience Certificate from all previous employer(s)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>b.</Text>
                <Text style={styles.bulletText}>Copy of the resignation acceptance letter</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>c.</Text>
                <Text style={styles.bulletText}>Salary slips/ certificate from all employers (min last 3 months)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>d.</Text>
                <Text style={styles.bulletText}>Form 16/ TDS certificate from all ex-employers (as required)</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletSign}>e.</Text>
                <Text style={styles.bulletText}>Form 12B /Provisional Form 16 for the current financial year</Text>
              </View>
            </View>
          </View>

          {/* Same sign block as Page 3 */}
          <View style={[styles.signaturesRow, { marginTop: 15 }]}>
            <View style={styles.candidateSignatureBlock}>
              <Text style={styles.signatureLineText}>Candidate Signature: __________________</Text>
              <Text style={styles.signatureLineText}>Candidate Name: <Text style={styles.signatureNormalText}>{letter.candidateName}</Text></Text>
              <Text style={styles.signatureLineText}>Place: <Text style={styles.signatureNormalText}>{getCandidateLocation() || letter.location || '___________________________'}</Text></Text>
            </View>

            <View style={styles.authorizedSignatureBlock}>
              <Text style={styles.authorizedSignatoryLabel}>For {settings.name}</Text>
              
              <View style={styles.signatureImageContainer}>
                {settings.signatureUrl ? (
                  <Image src={settings.signatureUrl} style={styles.signatureImage} />
                ) : null}
              </View>

              {letter.authorizedSignatory === 'Yameen Hakim' || letter.authorizedSignatory === 'Director|Business Operations' ? (
                <Text style={styles.authorizedSignatoryName}>Director|Business Operations</Text>
              ) : (
                <>
                  <Text style={styles.authorizedSignatoryName}>{letter.authorizedSignatory}</Text>
                  <Text style={styles.authorizedSignatoryTitle}>Director|Business Operations</Text>
                </>
              )}
            </View>
          </View>
        </View>
        <Footer pageNumber={4} totalPages={4} />
      </Page>
    </Document>
  );
}
