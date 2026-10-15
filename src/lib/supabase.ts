import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from './firebase';
import type { CompanySettings } from '../types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabasePublishableKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(import.meta.env.DEV ? `${window.location.origin}/supabase` : supabaseUrl!, supabasePublishableKey!, {
      accessToken: async () => {
        const user = auth?.currentUser;
        return user ? user.getIdToken() : null;
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function ensureSupabaseAdmin(firebaseUid: string) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data: profile, error } = await supabase
    .from('admin_profiles')
    .select('id, role, is_active')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) throw error;
  if (!profile?.is_active) {
    throw new Error(`Admin access is not provisioned for Firebase UID ${firebaseUid}.`);
  }

  return profile;
}

let companySettingsUpdatedAt: string | null = null;
export async function loadCompanySettings(): Promise<Partial<CompanySettings> | null> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('company_settings')
    .select('settings,updated_at').eq('id', true).maybeSingle();
  if (error) throw error;
  companySettingsUpdatedAt = data?.updated_at ?? null;
  return data?.settings ?? null;
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured. Shared settings could not be saved.');
  // Keep compressed image data with the settings so PDFs need no expiring asset URLs.
  const { data, error } = await supabase.rpc('save_studio_company_settings', {
    p_settings: settings, p_expected_updated_at: companySettingsUpdatedAt,
  });
  if (error) {
    if (error.code === '40001') throw new Error('Settings changed on another device. Reload Settings before saving again.');
    throw error;
  }
  companySettingsUpdatedAt = data.updated_at;
}
