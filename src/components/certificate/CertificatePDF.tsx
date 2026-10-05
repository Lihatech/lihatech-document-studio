import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Polygon,
} from '@react-pdf/renderer';
import { Certificate, CompanySettings } from '../../types';
import { getDefaultCompletionText, getCertificateSubtitle, getDefaultCertificateDescription, DEFAULT_PRESENTATION_TEXT, getFormattedDateLine } from '../../utils/certificateUtils';
import uploadedBg from '../../../Certificate BG1.png';

interface CertificatePDFProps {
  certificate: Certificate;
  settings: CompanySettings;
  selectedTemplate: 'royal' | 'emerald' | 'academic' | 'modern-blue';
}

const getTemplateStyles = (template: 'royal' | 'emerald' | 'academic' | 'modern-blue') => {
  switch (template) {
    case 'modern-blue':
      return {
        headingColor: '#0D1F3D',
        nameColor: '#1E40AF',
        subTitleColor: '#1E40AF',
        accentColor: '#1D4ED8',
        textColor: '#0D1F3D',
      };
    case 'emerald':
      return {
        headingColor: '#115E59',
        nameColor: '#115E59',
        subTitleColor: '#0F766E',
        accentColor: '#14B8A6',
        textColor: '#0F172A',
      };
    case 'academic':
      return {
        headingColor: '#0F172A',
        nameColor: '#0F172A',
        subTitleColor: '#64748B',
        accentColor: '#64748B',
        textColor: '#1E293B',
      };
    case 'royal':
    default:
      return {
        headingColor: '#4C1019',
        nameColor: '#1E40AF',
        subTitleColor: '#D6B56D',
        accentColor: '#D6B56D',
        textColor: '#0F172A',
      };
  }
};

// Auto font-size logic for Candidate name in pt
const getCandidateFontSize = (name: string) => {
  const length = name.trim().length;
  if (length <= 25) return 34;
  if (length <= 35) return 29;
  return 24;
};

// Auto font-size logic for Program name in pt
const getProgramFontSize = (name: string, customSize?: number) => {
  if (customSize && customSize >= 10 && customSize <= 48) {
    return Math.round(customSize * 0.85);
  }
  const length = name.trim().length;
  if (length <= 25) return 21;
  if (length <= 45) return 18;
  if (length <= 70) return 16;
  if (length <= 95) return 13.5;
  return 12;
};

const pdfStyles = StyleSheet.create({
  page: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    position: 'absolute',
    top: 112.5, // 150px * 0.75
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 45, // 60px * 0.75
    letterSpacing: 6,
    textAlign: 'center',
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  subtitleText: {
    fontSize: 10.5, // 14px * 0.75
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 4.5,
    paddingHorizontal: 6,
  },
  taperLine: {
    height: 1,
    width: 84, // 112px * 0.75
  },
  diamond: {
    width: 6,
    height: 6,
    marginHorizontal: 6,
  },
  certifyText: {
    position: 'absolute',
    top: 191.25, // 255px * 0.75
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9.75, // 13px * 0.75
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.5,
    color: '#334155',
  },
  nameContainer: {
    position: 'absolute',
    top: 213, // 284px * 0.75
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  nameText: {
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 1,
    paddingBottom: 2,
    marginBottom: 5,
  },
  nameUnderline: {
    width: 390, // 520px * 0.75
    height: 1.5,
  },
  completionText: {
    position: 'absolute',
    top: 276, // 368px * 0.75
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12, // 16px * 0.75
    fontFamily: 'Helvetica-Oblique',
    color: '#334155',
  },
  programContainer: {
    position: 'absolute',
    top: 300, // 400px * 0.75
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 60,
  },
  programText: {
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 1,
    maxWidth: 540, // 720px * 0.75
  },
  dateText: {
    position: 'absolute',
    top: 358.5, // 478px * 0.75
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12, // 16px * 0.75
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  organizedText: {
    position: 'absolute',
    top: 379.5, // 506px * 0.75
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12, // 16px * 0.75
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  organizedName: {
    fontFamily: 'Helvetica-Bold',
    color: '#020617',
  },
  descriptionContainer: {
    position: 'absolute',
    top: 402, // 536px * 0.75
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 150,
  },
  descriptionText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12.75, // 17px * 0.75
    textAlign: 'center',
    color: '#334155',
    borderTopWidth: 0.75,
    borderTopColor: '#cbd5e1',
    borderTopStyle: 'solid',
    paddingTop: 7.5,
    maxWidth: 405, // 540px * 0.75
  },
  bottomSection: {
    position: 'absolute',
    bottom: 30, // 40px * 0.75
    left: 36,   // 48 * 0.75
    right: 36,  // 48 * 0.75
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  col1: {
    width: '20%',
  },
  col2: {
    width: '20%',
    borderRightWidth: 1,
    borderRightColor: '#94a3b8',
    borderRightStyle: 'solid',
    paddingRight: 18,
    marginBottom: 15,
    height: 48,
    justifyContent: 'center',
  },
  col3: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  col4: {
    width: '20%',
    borderLeftWidth: 1,
    borderLeftColor: '#94a3b8',
    borderLeftStyle: 'solid',
    paddingLeft: 18,
    marginBottom: 15,
    height: 48,
    justifyContent: 'center',
  },
  col5: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 15,
    marginLeft: -30,
  },
  bottomLabel: {
    fontSize: 10.5, // 14px * 0.75
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    color: '#334155',
  },
  bottomValue: {
    fontFamily: 'Courier-Bold', // Using Courier for monospace
    fontSize: 12, // 16px * 0.75
    color: '#000000',
    marginTop: 6,
  },
  stampImage: {
    width: 120,
    height: 120,
  },
  col5Inner: {
    width: 144, // 192px * 0.75
    alignItems: 'center',
  },
  signatureContainer: {
    height: 48,
    width: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  signatureImage: {
    height: 45,
    width: 110,
    objectFit: 'contain',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    borderTopStyle: 'solid',
    width: '100%',
    paddingTop: 6,
    alignItems: 'center',
  },
  directorName: {
    fontSize: 13.5, // 18px * 0.75
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
  },
  directorDesignation: {
    fontSize: 8.25, // 11px * 0.75
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default function CertificatePDF({
  certificate,
  settings,
  selectedTemplate,
}: CertificatePDFProps) {
  const template = getTemplateStyles(selectedTemplate);

  const subtitleText = getCertificateSubtitle(certificate.certificateType);

  const completionText = certificate.completionText || getDefaultCompletionText(certificate.certificateType);

  const presentationText = certificate.presentationText || DEFAULT_PRESENTATION_TEXT;

  const dateText = getFormattedDateLine(certificate);

  const descriptionText = certificate.textTemplate || getDefaultCertificateDescription(certificate.certificateType, settings.defaultCertText);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.container} wrap={false}>
          {/* Background Image */}
          <Image src={uploadedBg} style={pdfStyles.background} />

          {/* Title Section */}
          <View style={pdfStyles.titleContainer}>
            <Text style={[pdfStyles.title, { color: template.headingColor }]}>
              CERTIFICATE
            </Text>
            <View style={pdfStyles.subtitleContainer}>
              <View style={[pdfStyles.taperLine, { backgroundColor: template.accentColor }]} />
              <Svg width={6} height={6} viewBox="0 0 10 10" style={pdfStyles.diamond}>
                <Polygon points="5,0 10,5 5,10 0,5" fill={template.accentColor} />
              </Svg>
              <Text style={[pdfStyles.subtitleText, { color: template.subTitleColor }]}>
                {subtitleText}
              </Text>
              <Svg width={6} height={6} viewBox="0 0 10 10" style={pdfStyles.diamond}>
                <Polygon points="5,0 10,5 5,10 0,5" fill={template.accentColor} />
              </Svg>
              <View style={[pdfStyles.taperLine, { backgroundColor: template.accentColor }]} />
            </View>
          </View>

          {/* Certify Text */}
          <Text style={pdfStyles.certifyText}>{presentationText}</Text>

          {/* Candidate Name */}
          <View style={pdfStyles.nameContainer}>
            <Text style={[
              pdfStyles.nameText,
              { 
                color: template.nameColor,
                fontSize: getCandidateFontSize(certificate.candidateName)
              }
            ]}>
              {certificate.candidateName}
            </Text>
            <View style={[pdfStyles.nameUnderline, { backgroundColor: template.accentColor }]} />
          </View>

          {/* Completion Statement */}
          <Text style={pdfStyles.completionText}>{completionText}</Text>

          {/* Program Name */}
          <View style={pdfStyles.programContainer}>
            <Text style={[
              pdfStyles.programText,
              { 
                fontSize: getProgramFontSize(certificate.programName, certificate.programFontSize),
                color: '#000000'
              }
            ]}>
              {certificate.programName}
            </Text>
          </View>

          {/* Date Line */}
          <Text style={pdfStyles.dateText}>{dateText}</Text>

          {/* Organized By */}
          <Text style={pdfStyles.organizedText}>
            organized by <Text style={pdfStyles.organizedName}>{settings.name}</Text>.
          </Text>

          {/* Description */}
          <View style={pdfStyles.descriptionContainer}>
            <Text style={pdfStyles.descriptionText}>
              {descriptionText}
            </Text>
          </View>

          {/* Bottom Section */}
          <View style={pdfStyles.bottomSection}>
            {/* Col 1 - Spacing/Invisible Badge */}
            <View style={pdfStyles.col1} />

            {/* Col 2 - Certificate ID */}
            <View style={pdfStyles.col2}>
              <Text style={pdfStyles.bottomLabel}>CERTIFICATE ID</Text>
              <Text style={pdfStyles.bottomValue}>{certificate.certificateId}</Text>
            </View>

            {/* Col 3 - Stamp */}
            <View style={pdfStyles.col3}>
              {settings.stampUrl && !settings.stampUrl.includes('data:image/svg+xml') ? (
                <Image 
                  src={settings.stampUrl} 
                  style={pdfStyles.stampImage} 
                />
              ) : null}
            </View>

            {/* Col 4 - Date of Issue */}
            <View style={pdfStyles.col4}>
              <Text style={pdfStyles.bottomLabel}>DATE OF ISSUE</Text>
              <Text style={[pdfStyles.bottomValue, { fontFamily: 'Helvetica-Bold' }]}>{certificate.issueDate}</Text>
            </View>

            {/* Col 5 - Signature */}
            <View style={pdfStyles.col5}>
              <View style={pdfStyles.col5Inner}>
                <View style={pdfStyles.signatureContainer}>
                  {settings.signatureUrl && !settings.signatureUrl.includes('data:image/svg+xml') ? (
                    <Image 
                      src={settings.signatureUrl} 
                      style={pdfStyles.signatureImage} 
                    />
                  ) : null}
                </View>
                <View style={pdfStyles.signatureLine}>
                  <Text style={pdfStyles.directorName}>Director LihaTech</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
