import { supabase, loadCompanySettings } from './supabase';
import { auth } from './firebase';
import type { Certificate, Client, CompanySettings, Course, Invoice, Letter, Payslip, RecentActivity } from '../types';

export interface EmployeeProfile {
  employeeId: string; employeeName: string; designation: string; department: string;
  pan: string; dateOfJoining: string; bankAccName: string; location: string;
  pfAccountNumber: string; uan: string; daysInMonth: number; effectiveWorkDays: number;
  lop: number; basicSalary: number; hra: number; allowances: number; pf: number; professionalTax: number;
}
export interface StudioData {
  settings: CompanySettings;
  invoices: Invoice[]; certificates: Certificate[]; letters: Letter[]; payslips: Payslip[];
  clients: Client[]; courses: Course[]; employees: EmployeeProfile[]; activities: RecentActivity[];
}
export const recordKinds = {
  invoices: 'invoice', certificates: 'certificate', letters: 'letter', payslips: 'payslip',
  clients: 'client', courses: 'course', employees: 'employee', activities: 'activity',
} as const;
type Collection = keyof typeof recordKinds;
export type StudioRecord = { kind: string; record_id: string; data: Record<string, unknown>; version: number; archived: boolean };
type Change = { kind: string; record_id: string; data: unknown; expected_version: number; archived: boolean };
const versions = new Map<string, number>();
const reservedInvoiceNumbers = new Set<string>();
export const getReservedInvoiceNumbers = () => [...reservedInvoiceNumbers];
const key = (kind: string, id: string) => `${kind}:${id}`;
const idFor = (collection: Collection, value: Record<string, unknown>) => String(collection === 'employees' ? value.employeeId : value.id);

export function buildStudioChanges(previous: StudioData, updates: Partial<StudioData>, revision = versions): Change[] {
  const changes: Change[] = [];
  for (const collection of Object.keys(recordKinds) as Collection[]) {
    if (!updates[collection]) continue;
    const kind = recordKinds[collection];
    const oldRows = new Map(previous[collection].map(row => [idFor(collection, row as unknown as Record<string, unknown>), row] as const));
    const newRows = new Map(updates[collection]!.map(row => [idFor(collection, row as unknown as Record<string, unknown>), row] as const));
    if (newRows.size !== updates[collection]!.length) throw new Error('Duplicate record IDs. Check the records before saving.');
    for (const [id, row] of newRows) {
      if (!id || id === 'undefined') throw new Error('A record is missing its ID.');
      if (JSON.stringify(oldRows.get(id)) !== JSON.stringify(row)) {
        changes.push({ kind, record_id: id, data: row, expected_version: revision.get(key(kind, id)) ?? 0, archived: false });
      }
    }
    for (const [id, row] of oldRows) {
      if (!newRows.has(id)) changes.push({ kind, record_id: id, data: row, expected_version: revision.get(key(kind, id)) ?? 0, archived: true });
    }
  }
  return changes;
}

export async function loadStudioData(defaults: StudioData): Promise<StudioData> {
  if (!supabase) throw new Error('Supabase is not configured.');
  versions.clear();
  reservedInvoiceNumbers.clear();
  const result = { ...defaults };
  const rows: StudioRecord[] = [];
  // Supabase caps responses; page through the registry instead of silently losing older documents.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('document_studio_records')
      .select('kind,record_id,data,version,archived').order('kind').order('record_id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data as StudioRecord[]);
    if (data.length < 500) break;
  }
  rows.filter(row => row.kind === 'invoice').forEach(row => {
    if (row.data.invoiceNumber) reservedInvoiceNumbers.add(String(row.data.invoiceNumber));
  });
  for (const collection of Object.keys(recordKinds) as Collection[]) {
    const matching = rows.filter(row => row.kind === recordKinds[collection]);
    matching.forEach(row => versions.set(key(row.kind, row.record_id), row.version));
    (result[collection] as unknown[]) = matching.filter(row => !row.archived).map(row => row.data);
  }
  result.activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return result;
}

export function rememberStudioRecord(record: StudioRecord) {
  versions.set(key(record.kind,record.record_id),record.version);
}

export async function saveStudioChanges(previous: StudioData, updates: Partial<StudioData>): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const changes = buildStudioChanges(previous, updates);
  if (!changes.length) return;
  const { data, error } = await supabase.rpc('save_document_studio_records', { p_changes: changes });
  if (error) {
    if (error.code === '40001' || error.code === '23505') throw new Error('These records changed on another device or a document number is already in use. Reload the records before saving again.');
    throw error;
  }
  changes.filter(change => change.kind === 'invoice').forEach(change => {
    const number = (change.data as Invoice).invoiceNumber;
    if (number) reservedInvoiceNumbers.add(number);
  });
  (data as { kind: string; record_id: string; version: number }[]).forEach(row => versions.set(key(row.kind, row.record_id), row.version));
}

export async function addCertificateOption(kind: 'category' | 'partner', name: string): Promise<CompanySettings> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('add_certificate_option', { p_kind: kind, p_name: name.trim() });
  if (error) throw error;
  return await loadCompanySettings() as CompanySettings || data as CompanySettings;
}

export function isSharedRecord(collection: Collection, id: string) {
  return versions.has(key(recordKinds[collection], id));
}

export async function loadInvoiceDraft(): Promise<Partial<Invoice> | null> {
  if (!supabase || !auth?.currentUser) throw new Error('Sign in to load your invoice draft.');
  const { data, error } = await supabase.from('document_studio_drafts').select('data')
    .eq('firebase_uid', auth.currentUser.uid).eq('kind', 'invoice').maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

export async function saveInvoiceDraft(draft: Partial<Invoice> | null): Promise<void> {
  if (!supabase || !auth?.currentUser) throw new Error('Sign in to save your invoice draft.');
  const query = supabase.from('document_studio_drafts');
  const { error } = draft
    ? await query.upsert({ firebase_uid: auth.currentUser.uid, kind: 'invoice', data: draft })
    : await query.delete().eq('firebase_uid', auth.currentUser.uid).eq('kind', 'invoice');
  if (error) throw error;
}

export function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'The save failed. Please try again.';
}
