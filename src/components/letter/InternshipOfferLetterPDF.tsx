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
    paddingBottom: 75, // Increased paddingBottom to accommodate the absolute footer
    paddingLeft: 45,
    paddingRight: 45,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
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
  },
  watermark: {
    width: 320,
    height: 320,
    opacity: 0.12,
    objectFit: 'contain',
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
    width: '50%',
  },
  logo: {
    height: 60,
    width: 200,
    objectFit: 'contain',
  },
  logoFallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#312e81',
  },
  headerRight: {
    width: '50%',
    textAlign: 'right',
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
    // flex: 1 removed to avoid layout distortion
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
  termItem: {
    marginBottom: 7,
    textAlign: 'justify',
    fontSize: 8.8,
  },
  termTitle: {
    fontWeight: 'bold',
    color: '#000000',
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
    width: 90,
    objectFit: 'contain',
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
    position: 'absolute',
    bottom: 30,
    left: 45,
    right: 45,
    borderTopWidth: 0.8,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#475569',
    fontWeight: 'bold',
  },
  internshipBullets: {
    marginTop: 6,
    marginBottom: 8,
    paddingLeft: 12,
  },
  internshipBulletTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  internshipBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  internshipBulletSign: {
    width: 10,
    fontSize: 10,
  },
  internshipBulletText: {
    fontSize: 9.5,
  },
  stampContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 70,
    width: 70,
    marginBottom: 4,
  },
  stampImage: {
    height: 65,
    width: 65,
    opacity: 0.85,
    objectFit: 'contain',
  },
  stampFallback: {
    height: 60,
    width: 60,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
  stampLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defaultComputerGeneratedText: {
    position: 'absolute',
    bottom: 45,
    left: 45,
    right: 45,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#94a3b8',
    borderTopWidth: 0.8,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  }
});

interface InternshipOfferLetterPDFProps {
  letter: Letter;
  settings: CompanySettings;
}

export default function InternshipOfferLetterPDF({ letter, settings }: InternshipOfferLetterPDFProps) {
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
      <Text>{settings.name} - Internship Offer Letter</Text>
    </View>
  );

  const candidateAddressLines = letter.collegeName && letter.collegeName.trim()
    ? letter.collegeName.split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <Document>
      {/* PAGE 1 */}
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

          {/* Recipient address block */}
          <View style={styles.candidateAddressSection}>
            <Text style={{ fontSize: 9.5, fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', marginBottom: 2 }}>To,</Text>
            {letter.addressTo === 'candidate' ? (
              <View>
                <Text style={styles.candidateGreetingText}>{letter.candidateName},</Text>
                {candidateAddressLines.length > 0 ? (
                  candidateAddressLines.map((line, idx) => (
                    <Text key={idx} style={styles.candidateAddressLine}>{line}</Text>
                  ))
                ) : (
                  <>
                    <Text style={styles.candidateAddressPlaceholder}>[Address Line 1]</Text>
                    <Text style={styles.candidateAddressPlaceholder}>[Address Line 2]</Text>
                  </>
                )}
                {letter.location?.trim() ? (
                  <Text style={styles.candidateAddressLine}>{letter.location}</Text>
                ) : null}
              </View>
            ) : (
              <View>
                <Text style={styles.candidateGreetingText}>The Director/Principal,</Text>
                {candidateAddressLines.length > 0 ? (
                  candidateAddressLines.map((line, idx) => (
                    <Text key={idx} style={[styles.candidateAddressLine, idx === 0 && { fontWeight: 'bold' }]}>{line}</Text>
                  ))
                ) : (
                  <Text style={[styles.candidateAddressLine, { fontWeight: 'bold' }]}>{letter.collegeName || ''}</Text>
                )}
                {letter.location?.trim() ? (
                  <Text style={styles.candidateAddressLine}>{letter.location}</Text>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.subjectContainer}>
            <Text style={styles.subjectTitle}>Internship Offer Letter</Text>
          </View>

          <View>
            {letter.addressTo === 'candidate' ? (
              <Text style={[styles.paragraph, styles.boldParagraph]}>Dear {letter.candidateName},</Text>
            ) : (
              <Text style={[styles.paragraph, styles.boldParagraph]}>Respected Sir/Madam,</Text>
            )}

            {letter.addressTo === 'candidate' ? (
              <Text style={styles.paragraph}>
                We are pleased to extend an offer for position <Text style={{ fontWeight: 'bold' }}>{letter.designation || ''}</Text> to you{letter.collegeName ? ` from ${letter.collegeName}` : ''}. This internship is an excellent opportunity for you to gain hands-on experience in these rapidly growing fields, enhancing your academic learning with practical industry exposure.
              </Text>
            ) : (
              <Text style={styles.paragraph}>
                We are pleased to extend an offer for position <Text style={{ fontWeight: 'bold' }}>{letter.designation || ''}</Text> to <Text style={{ fontWeight: 'bold' }}>{letter.candidateName}</Text> from your esteemed institution. This internship is an excellent opportunity for him/her to gain hands-on experience in these rapidly growing fields, enhancing their academic learning with practical industry exposure.
              </Text>
            )}

            {/* Internship Details */}
            <View style={styles.internshipBullets}>
              <Text style={styles.internshipBulletTitle}>Internship Details:</Text>
              <View style={styles.internshipBulletRow}>
                <Text style={styles.internshipBulletSign}>• </Text>
                <Text style={styles.internshipBulletText}>Position: <Text style={{ fontWeight: 'bold' }}>{letter.designation || ''}</Text></Text>
              </View>
              <View style={styles.internshipBulletRow}>
                <Text style={styles.internshipBulletSign}>• </Text>
                <Text style={styles.internshipBulletText}>Start Date: <Text style={{ fontWeight: 'bold' }}>{formatDate(letter.startDate)}</Text></Text>
              </View>
              <View style={styles.internshipBulletRow}>
                <Text style={styles.internshipBulletSign}>• </Text>
                <Text style={styles.internshipBulletText}>Duration: <Text style={{ fontWeight: 'bold' }}>{letter.duration || ''}</Text></Text>
              </View>
              <View style={styles.internshipBulletRow}>
                <Text style={styles.internshipBulletSign}>• </Text>
                <Text style={styles.internshipBulletText}>Location: <Text style={{ fontWeight: 'bold' }}>{letter.location || ''}</Text></Text>
              </View>
            </View>

            <Text style={styles.paragraph}>
              We believe this internship will provide a valuable learning experience, bridging the gap between theoretical knowledge and practical application.
            </Text>
            
            <Text style={styles.paragraph}>
              {letter.addressTo === 'candidate' 
                ? "We look forward to a rewarding and successful association with you." 
                : "Thank you for your attention and support."}
            </Text>
          </View>

          {/* Bottom Stamp and Signature Block matching HTML preview exactly */}
          <View wrap={false} style={{ borderTopWidth: 0.8, borderTopColor: '#f1f5f9', paddingTop: 10, marginTop: 15, flexDirection: 'row', justifyContent: 'flex-start' }}>
            <View style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <View style={{ position: 'relative', height: 95, width: 275, flexDirection: 'row', alignItems: 'center' }}>
                {settings.signatureUrl && (
                  <Image src={settings.signatureUrl} style={{ height: 90, width: 185, position: 'absolute', left: 0, top: 2, objectFit: 'contain', zIndex: 10 }} />
                )}
                {settings.stampUrl && (
                  <Image src={settings.stampUrl} style={{ height: 115, width: 115, position: 'absolute', left: 115, top: -8, objectFit: 'contain', opacity: 0.85, zIndex: 0 }} />
                )}
              </View>
              
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: '#0f172a' }}>Director {settings.name}</Text>
                <Text style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>Business Development | Client Relations</Text>
              </View>
            </View>
          </View>
        </View>
        
        <Footer pageNumber={1} totalPages={2} />
      </Page>

      {/* PAGE 2 */}
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderSubPage />
          
          <View style={styles.subjectContainer}>
            <Text style={styles.subjectTitle}>Terms and Conditions</Text>
          </View>

          <View style={{ marginTop: 10 }}>
            {letter.noStipend ? (
              <>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>Probation Period: </Text>
                  The initial probation period will be <Text style={{fontWeight: 'bold'}}>{letter.probation || ''}</Text>.
                </Text>
                <Text style={styles.termItem}>
                  This internship is with <Text style={{fontWeight: 'bold'}}>No-Stipend</Text>.
                </Text>
                <Text style={styles.termItem}>
                  Once the intern completes their degree, the company <Text style={{fontWeight: 'bold'}}>reserves the right to convert the internship into an on-roll position</Text> with <Text style={{fontWeight: 'bold'}}>{settings.name}</Text>, subject to performance and organizational requirements.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>Rights Reserved: </Text>
                  All rights related to the candidate’s <Text style={{fontWeight: 'bold'}}>candidature and internship</Text> are strictly reserved with the company.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>Leave Policy: </Text>
                  The candidate shall <Text style={{fontWeight: 'bold'}}>not take leave without prior written approval</Text> from the company.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>Notice Period: </Text>
                  In case the candidate wishes to <Text style={{fontWeight: 'bold'}}>discontinue, switch jobs, or leave the internship</Text>, they must serve a <Text style={{fontWeight: 'bold'}}>Notice Period (NP) of {letter.noticePeriod || ''}</Text> as per company policy.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>1. Probation Period: </Text>
                  The initial probation period will be <Text style={{fontWeight: 'bold'}}>{letter.probation || ''}</Text>.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>2. Confirmation: </Text>
                  Based on a performance assessment, you will be moved to an <Text style={{fontWeight: 'bold'}}>on-roll position</Text> upon successful completion of the probation period. [Provided that you must complete your degree].
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>3. Stipend: </Text>
                  During the probation period, if the candidate’s performance is found to be good and commendable, they will be eligible for a stipend of <Text style={{fontWeight: 'bold'}}>{letter.stipend || '₹12,500 per month'}</Text>.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>4. Conversion: </Text>
                  Once the intern completes their degree, the company reserves the right to convert the internship into an <Text style={{fontWeight: 'bold'}}>on-roll position with {settings.name}</Text>, subject to performance and organizational requirements.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>5. Rights Reserved: </Text>
                  All rights related to the candidate’s candidature and internship are strictly reserved with the company.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>6. Leave Policy: </Text>
                  The candidate shall <Text style={{fontWeight: 'bold'}}>not take leave without prior written approval</Text> from the company.
                </Text>
                <Text style={styles.termItem}>
                  <Text style={styles.termTitle}>7. Notice Period: </Text>
                  In case the candidate wishes to discontinue, switch jobs, or leave the internship, they must serve a <Text style={{fontWeight: 'bold'}}>Notice Period (NP) of {letter.noticePeriod || ''}</Text> as per company policy.
                </Text>
              </>
            )}

            {/* Acknowledgement */}
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: '#000000', marginBottom: 4 }}>Acknowledgement</Text>
              <Text style={{ fontSize: 8.5, textAlign: 'justify', color: '#1e293b', lineHeight: 1.3 }}>
                I, the employee/intern, acknowledge and understand the terms and conditions contained in this agreement, and I was given a copy of the intended agreement and given a reasonable opportunity to seek independent advice before I entered into it. I was not induced to enter into this agreement by any oppressive means, undue influence or duress by the Company.
              </Text>
            </View>
          </View>

          {/* Acknowledgement Signatures Block (Formatted beautifully like Web Preview) */}
          <View style={{ borderTopWidth: 0.8, borderTopColor: '#f1f5f9', paddingTop: 10, marginTop: 15, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '45%', flexDirection: 'column' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#cbd5e1', paddingBottom: 2, minHeight: 16 }}>
                <Text style={{ fontSize: 9, color: '#64748b', width: 55 }}>Name:</Text>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>{letter.candidateName}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#cbd5e1', paddingBottom: 2, minHeight: 16, marginTop: 10 }}>
                <Text style={{ fontSize: 9, color: '#64748b', width: 55 }}>Signature:</Text>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}></Text>
              </View>
            </View>

            <View style={{ width: '45%', flexDirection: 'column' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#cbd5e1', paddingBottom: 2, minHeight: 16 }}>
                <Text style={{ fontSize: 9, color: '#64748b', width: 40 }}>Date:</Text>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>{formatDate(letter.issueDate)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#cbd5e1', paddingBottom: 2, minHeight: 16, marginTop: 10 }}>
                <Text style={{ fontSize: 9, color: '#64748b', width: 40 }}>Place:</Text>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>{letter.location || ''}</Text>
              </View>
            </View>
          </View>
        </View>
        
        <Text style={styles.defaultComputerGeneratedText}>
          This is a computer-generated document on official letterhead of {settings.name}. All contents are confidential and property of {settings.name} Solutions Private Limited.
        </Text>
        <Footer pageNumber={2} totalPages={2} />
      </Page>
    </Document>
  );
}