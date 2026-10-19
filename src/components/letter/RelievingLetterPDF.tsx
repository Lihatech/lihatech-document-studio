import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { Letter, CompanySettings } from '../../types';
import companyWatermark from '../../../only_logo-removebg-preview.png';

// Register a font that supports clean corporate look.
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
    fontSize: 10,
    lineHeight: 1.5,
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
  bodyContainer: {
    flex: 1,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
    fontSize: 10,
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

interface RelievingLetterPDFProps {
  letter: Letter;
  settings: CompanySettings;
}

export default function RelievingLetterPDF({ letter, settings }: RelievingLetterPDFProps) {
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

  const formatAddress = (addressStr: string) => {
    if (!addressStr) return [];
    const parts = addressStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length <= 2) return parts;
    const mid = Math.ceil(parts.length / 2);
    const line1 = parts.slice(0, mid).join(', ');
    const line2 = parts.slice(mid).join(', ');
    return [line1, line2];
  };

  // Watermark Component rendered safely
  const Watermark = () => (
    <View style={styles.watermarkContainer} pointerEvents="none">
      {companyWatermark ? (
        <Image src={companyWatermark} style={styles.watermark} />
      ) : null}
    </View>
  );

  // Standard Header Component
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.bodyContainer}>
          <HeaderPage1 />
          
          {/* Date aligned right */}
          <View style={{ alignItems: 'flex-end', marginBottom: 15 }}>
            <Text style={{ fontSize: 10.5, fontWeight: 'bold' }}>Date: {formatDate(letter.issueDate)}</Text>
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

          {/* Subject / Title */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', textDecoration: 'underline', letterSpacing: 0.5 }}>
              Sub: Relieving Letter
            </Text>
          </View>

          {/* Dear CandidateName, */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Dear {letter.candidateName},</Text>
          </View>

          {/* Letter Body paragraphs matching sample */}
          <View style={{ fontSize: 10, lineHeight: 1.6, color: '#000000' }}>
            <Text style={styles.paragraph}>
              This has reference to your resignation letter. This is to inform you that your resignation has been accepted and you are relieved from the services of <Text style={{ fontWeight: 'bold' }}>{settings.name || 'LANCE SOFT ENGINEERING PRIVATE LIMITED'}</Text> on the close of working hours on <Text style={{ fontWeight: 'bold' }}>{letter.endDate ? formatDate(letter.endDate) : formatDate(letter.issueDate)}</Text>.
            </Text>
            
            <Text style={styles.paragraph}>
              You are requested to deposit the company Id and any other company property entrusted to you during your employment with us.
            </Text>
            
            <Text style={styles.paragraph}>
              We wish you all success in your future endeavors.
            </Text>
          </View>

          {/* Signoff block */}
          <View style={{ marginTop: 25 }}>
            <Text style={{ fontSize: 10 }}>Yours Sincerely,</Text>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' }}>For {settings.name || 'LANCE SOFT ENGINEERING PRIVATE LIMITED'},</Text>
            
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
              <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{letter.authorizedSignatory}</Text>
              <Text style={{ fontSize: 8.5, color: '#475569', fontWeight: 'bold' }}>{settings.directorDesignation || 'HR Manager – Human Resources'}</Text>
            </View>
          </View>
        </View>

        {/* Footer Page numbers and signature label */}
        <View style={styles.footerContainer}>
          <Text>Page 1 of 1</Text>
          <Text>{settings.name} - Relieving Letter</Text>
        </View>
      </Page>
    </Document>
  );
}
