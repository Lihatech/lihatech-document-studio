import { auth } from './firebase';

const configuredBaseUrl = import.meta.env.VITE_LMS_API_BASE_URL?.replace(/\/$/, '');

export const LMS_API_BASE_URL = configuredBaseUrl || '';

/**
 * Small integration seam for the future FastAPI LMS service.
 * Keep document generation local until the LMS endpoints are ready.
 */
export async function lmsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!LMS_API_BASE_URL) {
    throw new Error('VITE_LMS_API_BASE_URL is not configured');
  }

  const token = await auth?.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${LMS_API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(body?.detail || body?.message || `LMS API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
