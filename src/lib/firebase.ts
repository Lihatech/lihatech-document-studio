import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { CompanySettings, Certificate, Client, Course, Invoice, Letter, Payslip, RecentActivity } from '../types';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;

const companyId = (env.VITE_FIREBASE_COMPANY_ID as string | undefined) || 'lihatech';
const allowedEmails = ((env.VITE_FIREBASE_ALLOWED_EMAILS as string | undefined) || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const allowedDomain = ((env.VITE_FIREBASE_ALLOWED_EMAIL_DOMAIN as string | undefined) || '')
  .trim()
  .toLowerCase()
  .replace(/^@/, '');

export interface CompanyData {
  settings: CompanySettings;
  clients: Client[];
  courses: Course[];
  invoices: Invoice[];
  certificates: Certificate[];
  letters: Letter[];
  payslips: Payslip[];
  activities: RecentActivity[];
}

export const isAllowedCompanyUser = (user: User) => {
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  if (allowedEmails.length > 0) return allowedEmails.includes(email);
  return Boolean(allowedDomain) && email.endsWith(`@${allowedDomain}`);
};

export const signInWithCompanyGoogle = async () => {
  if (!auth) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.local.');
  if (!allowedEmails.length && !allowedDomain) {
    throw new Error('Set VITE_FIREBASE_ALLOWED_EMAIL_DOMAIN or VITE_FIREBASE_ALLOWED_EMAILS before signing in.');
  }

  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  if (!isAllowedCompanyUser(credential.user)) {
    await signOut(auth);
    throw new Error('This Google account is not approved for LihaTech Document Studio.');
  }
  return credential.user;
};

export const signOutCompany = () => auth ? signOut(auth) : Promise.resolve();

export const subscribeToCompanyAuth = (callback: (user: User | null) => void) => {
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, callback);
};

const companyDoc = () => {
  if (!firestore) throw new Error('Firebase Firestore is not configured.');
  return doc(firestore, 'companies', companyId);
};

export const loadCompanyData = async (fallback: CompanyData): Promise<CompanyData> => {
  if (!firestore) return fallback;
  const snapshot = await getDoc(companyDoc());
  if (!snapshot.exists()) {
    await setDoc(companyDoc(), fallback);
    return fallback;
  }
  return { ...fallback, ...(snapshot.data() as Partial<CompanyData>) };
};

export const saveCompanyData = async (updates: Partial<CompanyData>) => {
  if (!firestore) return;
  await setDoc(companyDoc(), updates, { merge: true });
};
