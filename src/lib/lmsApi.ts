import { auth } from './firebase';

const configuredBaseUrl = import.meta.env.VITE_LMS_API_BASE_URL?.replace(/\/$/, '');

export const LMS_API_BASE_URL = configuredBaseUrl || '';

export async function lmsFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again to continue.');
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  let response:Response;
  try { response=await fetch(`${LMS_API_BASE_URL || '/api'}${path}`, {...init,headers}); }
  catch { throw new Error(navigator.onLine?'The learning service is temporarily unavailable. Please retry or contact admin.':'No network connection. Reconnect and try again.'); }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(body?.detail || body?.message || `LMS API request failed: ${response.status}`);
  }

  return response;
}
export async function lmsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return (await lmsFetch(path,init)).json() as Promise<T>;
}
