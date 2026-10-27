import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { auth, firebaseConfigured, signInWithCompanyGoogle } from '../lib/firebase';
import { supabaseConfigured } from '../lib/supabase';

interface LoginProps { authError?: string; }

export default function Login({ authError = '' }: LoginProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const authConfigured = supabaseConfigured && firebaseConfigured;

  const handleCompanyLogin = async () => {
    setError('');
    if (auth?.currentUser) { window.location.reload(); return; }
    setIsLoading(true);

    try {
      await signInWithCompanyGoogle();
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-5 py-10 font-sans text-[#062b4b] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#078edb]/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-[#45d8f5]/12 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm items-center justify-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <img src="/lihatech-logo-official.png" alt="LihaTech" className="mx-auto h-20 w-20 object-contain" />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#062b4b]">LihaTech</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#078edb]">Learning portal</p>
          </div>

          <section className="rounded-2xl border border-[#d7e8ee] bg-white p-7 shadow-[0_24px_70px_rgba(6,43,75,0.14),0_4px_18px_rgba(7,142,219,0.08)] sm:p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-[#062b4b]">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Students: use the Google account with the email registered by your admin.
              </p>
            </div>

            {(authError || error) && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700" role="alert">{authError || error}</div>}

            {authConfigured ? (
              <>
                <button type="button" onClick={handleCompanyLogin} disabled={isLoading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#078edb] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#07547e] focus:outline-none focus:ring-2 focus:ring-[#078edb] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Signing in...</> : auth?.currentUser ? 'Retry access check' : 'Continue with Google'}
                </button>
                <p className="mt-4 text-center text-xs leading-5 text-slate-500">Your registered email determines student access. Contact admin if it is not recognized.</p>
              </>
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700" role="alert">Configure Firebase Auth and Supabase in `.env.local` to enable sign-in.</div>
            )}
          </section>

          <nav aria-label="Public information" className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-[#07547e]">
            <a href="/about.html" className="inline-flex min-h-11 items-center rounded-lg px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07547e]">About</a>
            <a href="/privacy.html" className="inline-flex min-h-11 items-center rounded-lg px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07547e]">Privacy Policy</a>
            <a href="/terms.html" className="inline-flex min-h-11 items-center rounded-lg px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07547e]">Terms of Use</a>
          </nav>
          <p className="mt-3 text-center text-xs text-slate-500">© {new Date().getFullYear()} LihaTech Solutions</p>
        </div>
      </div>
    </main>
  );
}
