import type { Certificate, CompanySettings, Letter } from '../types';
import type { DocumentRequest } from './documentRequests';

export type RequestDocumentContent = { kind: DocumentRequest['kind']; document: Certificate | Letter; settings: Partial<CompanySettings>; draft: boolean };
