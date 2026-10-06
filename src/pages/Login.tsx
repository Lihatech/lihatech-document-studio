import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { firebaseConfigured, signInWithCompanyGoogle } from '../lib/firebase';

const LOGIN_ATTEMPTS_KEY = 'lt_company_login_attempts';
const MAX_LOGIN_ATTEMPTS = 2;

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Number.parseInt(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '0', 10) || 0;
  });

  const isBlocked = failedAttempts >= MAX_LOGIN_ATTEMPTS;

  const handleCompanyLogin = async () => {
    if (isBlocked) return;

    setError('');
    setIsLoading(true);

    try {
      await signInWithCompanyGoogle();
      localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
      onLoginSuccess();
    } catch (err) {
      if (err instanceof Error && err.name === 'CompanyAccountNotAllowedError') {
        const nextAttempts = Math.min(failedAttempts + 1, MAX_LOGIN_ATTEMPTS);
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, String(nextAttempts));
        setFailedAttempts(nextAttempts);
        setError(
          nextAttempts >= MAX_LOGIN_ATTEMPTS
            ? ''
            : `This account is not approved. Only the authenticated LihaTech company email can sign in. ${MAX_LOGIN_ATTEMPTS - nextAttempts} attempt remaining.`,
        );
      } else {
        setError(err instanceof Error ? err.message : 'Company sign-in failed. Please try again.');
      }
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
            <img
              src="/lihatech-logo-official.png"
              alt="LihaTech"
              className="mx-auto h-20 w-20 object-contain"
            />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#062b4b]">
              LihaTech
            </h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#078edb]">
              Document Studio
            </p>
          </div>

          <section className="rounded-2xl border border-[#d7e8ee] bg-white p-7 shadow-[0_24px_70px_rgba(6,43,75,0.14),0_4px_18px_rgba(7,142,219,0.08)] sm:p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-[#062b4b]">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use your approved LihaTech Google account to continue.
              </p>
            </div>

            {error && (
              <div
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
                role="alert"
              >
                {error}
              </div>
            )}

            {firebaseConfigured ? (
              <>
                <button
                  type="button"
                  onClick={handleCompanyLogin}
                  disabled={isLoading || isBlocked}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#078edb] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#07547e] focus:outline-none focus:ring-2 focus:ring-[#078edb] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    'Continue with Google'
                  )}
                </button>
                <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                  Only the authorized company email can access this studio.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700" role="alert">
                Firebase authentication is not configured for this deployment.
              </div>
            )}
          </section>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} LihaTech Solutions
          </p>
        </div>
      </div>

      {isBlocked && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#062b4b]/70 p-5 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="blocked-login-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 id="blocked-login-title" className="text-lg font-extrabold text-[#062b4b]">
              Sign-in blocked
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Only the authenticated LihaTech company email can access Document Studio.
            </p>
            <p className="mt-4 text-xs font-semibold leading-5 text-rose-600">
              Two unsuccessful attempts were detected in this browser. Please use the approved account or contact LihaTech support.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
