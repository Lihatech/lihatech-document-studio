import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';

const env = import.meta.env;

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
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
};

export const signOutCompany = () => auth ? signOut(auth) : Promise.resolve();

export const subscribeToCompanyAuth = (callback: (user: User | null) => void) => {
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, callback);
};
