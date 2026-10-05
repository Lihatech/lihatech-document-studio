import React from 'react';
import { Letter, CompanySettings } from '../../types';
import JobOfferLetterPDF from './JobOfferLetterPDF';
import InternshipOfferLetterPDF from './InternshipOfferLetterPDF';
import ExperienceLetterPDF from './ExperienceLetterPDF';
import RelievingLetterPDF from './RelievingLetterPDF';

interface OfferLetterPDFProps {
  letter: Letter;
  settings: CompanySettings;
}

export default function OfferLetterPDF({ letter, settings }: OfferLetterPDFProps) {
  if (letter.letterType === 'Job Offer') {
    return <JobOfferLetterPDF letter={letter} settings={settings} />;
  }
  if (letter.letterType === 'Internship Offer') {
    return <InternshipOfferLetterPDF letter={letter} settings={settings} />;
  }
  if (letter.letterType === 'Relieving Letter') {
    return <RelievingLetterPDF letter={letter} settings={settings} />;
  }
  // Default: Experience Letter
  return <ExperienceLetterPDF letter={letter} settings={settings} />;
}
