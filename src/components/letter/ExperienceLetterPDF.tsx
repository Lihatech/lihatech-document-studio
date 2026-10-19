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
  defaultSignaturesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 15,
    paddingTop: 8,
    borderTopWidth: 0.8,
    borderTopColor: '#f1f5f9',
  },
  defaultSealBlock: {
    alignItems: 'center',
    width: '40%',
  },
  defaultSignatoryBlock: {
    width: '45%',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  defaultSignatoryLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  defaultSignatoryLine: {
    borderTopWidth: 0.8,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
    width: '100%',
    alignItems: 'flex-end',
  },
  defaultFloatingSignature: {
    position: 'absolute',
    right: 4,
    bottom: 22,
    height: 38,
    width: 'auto',
  },
  defaultComputerGeneratedText: {
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 0.8,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    marginTop: 15,
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
});

interface ExperienceLetterPDFProps {
  letter: Letter;
  settings: CompanySettings;
}

export default function ExperienceLetterPDF({ letter, settings }: ExperienceLetterPDFProps) {
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

  const getPrefixedName = (name: string) => {
    if (!name) return '';
    return name;
  };

  const getPronouns = (name: string) => {
    if (!name) {
      return {
        subject: 'he/she',
        object: 'him/her',
        possessive: 'his/her',
        possessiveAdjective: 'his/her'
      };
    }
    const lowercase = name.toLowerCase();
    if (lowercase.startsWith('ms.') || lowercase.startsWith('mrs.') || lowercase.startsWith('miss.')) {
      return {
        subject: 'she',
        object: 'her',
        possessive: 'her',
        possessiveAdjective: 'her'
      };
    }
    return {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      possessiveAdjective: 'his'
    };
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

  // Footer Component
  const Footer = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => (
    <View style={styles.footerContainer}>
      <Text>Page {pageNumber} of {totalPages}</Text>
      <Text>{settings.name} - {letter.letterType}</Text>
    </View>
  );

  const pronouns = getPronouns(letter.candidateName);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderPage1 />
          
          {/* Date aligned right */}
          <View style={{ alignItems: 'flex-end', marginBottom: 15 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Date: {formatDate(letter.issueDate)}</Text>
          </View>

          {/* Candidate detail block */}
          <View style={{ marginBottom: 20, lineHeight: 1.5 }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>{getPrefixedName(letter.candidateName)}</Text>
            <Text style={{ fontSize: 10, color: '#334155' }}>
              <Text>Emp ID: </Text>
              <Text style={{ color: '#000000', fontWeight: 'bold' }}>{referenceId}{letter.studentId ? '\nStudent ID: '+letter.studentId : ''}</Text>
            </Text>
            <Text style={{ fontSize: 10, color: '#334155' }}>
              <Text>Designation: </Text>
              <Text style={{ color: '#000000', fontWeight: 'bold' }}>{letter.designation}</Text>
            </Text>
          </View>

          {/* TO WHOMSOEVER IT MAY CONCERN */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', textDecoration: 'underline', letterSpacing: 0.5 }}>
              TO WHOMSOEVER IT MAY CONCERN
            </Text>
          </View>

          {/* Letter Body paragraphs exactly like the image */}
          <View style={{ fontSize: 10.5, lineHeight: 1.6, color: '#000000' }}>
            <Text style={[styles.paragraph, { marginBottom: 12 }]}>
              This is to certify that <Text style={{ fontWeight: 'bold' }}>{getPrefixedName(letter.candidateName)}</Text>, Emp ID: <Text style={{ fontWeight: 'bold' }}>{referenceId}</Text> has been associated with our organization as <Text style={{ fontWeight: 'bold' }}>{letter.designation}</Text> for the period from <Text style={{ fontWeight: 'bold' }}>{formatDate(letter.startDate)}</Text> to <Text style={{ fontWeight: 'bold' }}>{letter.endDate ? formatDate(letter.endDate) : 'present'}</Text>.
            </Text>
            
            <Text style={[styles.paragraph, { marginBottom: 12 }]}>
              We found <Text style={{ fontWeight: 'bold' }}>{getPrefixedName(letter.candidateName)}</Text> is effective in discharging responsibilities assigned to {pronouns.object}.
            </Text>
            
            <Text style={[styles.paragraph, { marginBottom: 12 }]}>
              During {pronouns.possessiveAdjective} tenure with us for the above period, we found {pronouns.object} efficient, {pronouns.possessiveAdjective} character and conduct were good.
            </Text>
            
            <Text style={[styles.paragraph, { marginBottom: 12 }]}>
              We wish {pronouns.object} success in {pronouns.possessiveAdjective} future assignments.
            </Text>
          </View>

          {/* Signoff block matching the image */}
          <View style={{ marginTop: 25 }}>
            <Text style={{ fontSize: 10 }}>Yours Sincerely,</Text>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 2, textTransform: 'uppercase' }}>For {settings.name || 'LANCE SOFT ENGINEERING PRIVATE LIMITED'},</Text>
            
            {/* Overlapping Stamp & Signature */}
            <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative', marginTop: 10, height: 70 }}>
              {settings.signatureUrl && (
                <Image src={settings.signatureUrl} style={{ height: 45, width: 'auto', zIndex: 10 }} />
              )}
              {settings.stampUrl && (
                <Image 
                  src={settings.stampUrl} 
                  style={{ 
                    height: 65, 
                    width: 65, 
                    position: 'absolute', 
                    left: 80, 
                    opacity: 0.85, 
                    zIndex: 0 
                  }} 
                />
              )}
            </View>

            <View style={{ marginTop: 8, lineHeight: 1.3 }}>
              <Text style={{ fontSize: 10.5, fontWeight: 'bold' }}>{letter.authorizedSignatory}</Text>
              <Text style={{ fontSize: 8.5, color: '#475569', fontWeight: 'bold' }}>{settings.directorDesignation || 'HR Manager – Human Resources'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.defaultComputerGeneratedText}>
          This is a computer-generated document on official letterhead of {settings.name}. All contents are confidential and property of {settings.name} Solutions Private Limited.
        </Text>
        <Footer pageNumber={1} totalPages={1} />
      </Page>
    </Document>
  );
}
