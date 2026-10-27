import { supabase } from './supabase';
import { lmsFetch, lmsRequest } from './lmsApi';

export type Row = Record<string, any>;
export type LmsSession = { role: 'admin' | 'student'; id: string; name: string; email: string; status?: string };
export type StudentHome = { student: Row; server_time: string; enrollments: Row[]; materials: Row[]; slots: Row[]; bookings: Row[] };
export const lmsTables = ['students','batches','batch_students','learning_materials','batch_materials','mock_interview_slots','mock_interview_bookings','admin_profiles','staff_invitations','company_settings'] as const;
export type LmsTable = typeof lmsTables[number];

export async function rpc<T>(name: string, args = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if(/^lms_(?:request_|save_|approve_|review_|admin_update_|publish_|create_|import_|assign_|admin_save_)/.test(name))window.dispatchEvent(new Event('lihatech-activity'));
  return data;
}
export async function lmsApi<T>(path: string, method: 'GET' | 'POST' = 'POST', body?: unknown): Promise<T> {
  const result=await lmsRequest<T>(path,{
    method,
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  if(method==='POST')window.dispatchEvent(new Event('lihatech-activity'));
  return result;
}
export const isLmsAccessDenied = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '42501';
export async function listRows(table: LmsTable): Promise<Row[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const rows: Row[] = [];
  const ordering = table === 'batch_students' || table === 'batch_materials' ? 'batch_id' : 'id';
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select('*').order(ordering);
    if (table === 'batch_students') query = query.order('student_id');
    if (table === 'batch_materials') query = query.order('material_id');
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function saveRow(table: LmsTable, values: Row, keys?: Row) {
  if (!supabase) throw new Error('Supabase is not configured.');
  let query = keys ? supabase.from(table).update(values) : supabase.from(table).insert(values);
  for (const [key,value] of Object.entries(keys ?? {})) query = query.eq(key,value);
  const { data, error } = await query.select();
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('The record could not be saved. Refresh and check your access.');
  window.dispatchEvent(new Event('lihatech-activity'));
  return data[0] as Row;
}
export async function removeAssignment(table: LmsTable, keys: Row) {
  if (!supabase) throw new Error('Supabase is not configured.');
  let query = supabase.from(table).delete();
  for (const [key,value] of Object.entries(keys)) query = query.eq(key,value);
  const { error } = await query;
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event('lihatech-activity'));
}
export const displayDate = (value?: string) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : 'No expiry';
// A batch date includes the whole day in Kolhapur (UTC+05:30).
export const batchEndInstant = (date?: string) => date ? new Date(`${date}T18:30:00Z`) : null;
export const batchDateLabel = (date?: string) => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB',{dateStyle:'medium',timeZone:'Asia/Kolkata'}) : 'Not set';
export const localDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
export async function openMaterial(id: string): Promise<{blob?: Blob; url?: string;filename?:string}> {
  const material = await rpc<Row>('lms_open_material',{p_id:id});
  if (material.kind === 'link') return {url:material.url};
  const response = await lmsFetch(`/student/materials/${id}`);
  if (!response.ok) {
    const body = await response.json().catch(()=>null);
    throw new Error(body?.detail ?? 'Could not download the file. Check your access or contact admin.');
  }
  if (response.headers.get('content-type')?.includes('text/html')) throw new Error('The file service returned a web page instead of the uploaded file. Contact admin.');
  const blob = await response.blob();
  if (blob.type === 'application/pdf' && !(await blob.slice(0,1024).text()).includes('%PDF-')) throw new Error('The uploaded PDF is invalid. Ask admin to upload it again.');
  return {blob,filename:response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]};
}
