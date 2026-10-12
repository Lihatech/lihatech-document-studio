import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';

const env = import.meta.env;
const allowedEmails = (env.VITE_FIREBASE_ALLOWED_EMAILS as string | undefined || '')
  .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
const allowedDomain = (env.VITE_FIREBASE_ALLOWED_EMAIL_DOMAIN as string | undefined || 'lihatech.com')
  .trim().toLowerCase();

export const isAllowedCompanyUser = (user: Pick<User, 'email'>) => {
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  if (allowedEmails.length) return allowedEmails.includes(email);
  return Boolean(allowedDomain) && email.endsWith(`@${allowedDomain}`);
};

export const COMPANY_ACCESS_WARNING = 'This Google account is not approved for LihaTech Document Studio. Please sign in with an approved LihaTech account.';

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;

export const signInWithCompanyGoogle = async () => {
  if (!auth) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.local.');
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  if (!isAllowedCompanyUser(user)) {
    await signOut(auth);
    throw new Error(COMPANY_ACCESS_WARNING);
  }
  return user;
};

export const signOutCompany = () => auth ? signOut(auth) : Promise.resolve();

export const subscribeToCompanyAuth = (callback: (user: User | null) => void) => {
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, callback);
};
