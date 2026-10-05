import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { firebaseConfigured, signInWithCompanyGoogle } from '../lib/firebase';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCompanyLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithCompanyGoogle();
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Company sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Retrieve changed password if saved in settings, otherwise use default "admin123"
    const savedPassword = localStorage.getItem('lt_admin_password') || 'admin123';
    const targetEmail = 'admin@lihatech.com';

    setTimeout(() => {
      if (email.trim().toLowerCase() === targetEmail && password === savedPassword) {
        localStorage.setItem('lt_is_logged_in', 'true');
        onLoginSuccess();
      } else {
        setError('Invalid administrator email or password. Please try again.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div id="login-shell" className="min-h-screen flex bg-slate-50 dark:bg-slate-950 font-sans">
      
      {/* Left Column: Brand Column */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#041F37] via-[#062B4B] to-[#07547E] overflow-hidden items-center justify-center p-12">
        {/* Animated ambient lights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00B9E8]/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-[#45D8F5]/15 rounded-full blur-3xl animate-pulse delay-700" />
        
        {/* Grid patterns */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,%230f172a_1px,transparent_1px),linear-gradient(to_bottom,%230f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,%23000_70%,transparent_100%)] opacity-40" />

        <div className="relative max-w-lg text-center flex flex-col items-center">
          {/* Logo Cap Visual */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-xl shadow-amber-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 text-white">
              <path d="M2 10 L12 5 L22 10 L12 15 Z" />
              <path d="M6 12 L6 18 C6 20 12 21 12 21 C12 21 18 20 18 18 L18 12" />
              <path d="M12 15 L12 22" />
            </svg>
          </div>
          
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
            LihaTech
          </h1>
          <p className="text-xs tracking-[0.45em] text-amber-500 font-bold uppercase mb-8">
            Plan . Practice . Patience
          </p>

          <blockquote className="border-l-4 border-amber-500/40 pl-4 py-1 text-left mb-8">
            <p className="text-sm font-medium text-slate-300 italic leading-relaxed">
              "We provide custom software solutions, website engineering, workflow automations, GenAI integration pipelines, and practical internship/course pathways for modern technical talent."
            </p>
          </blockquote>

          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 w-full text-left">
            <div className="flex items-center space-x-3 mb-3">
              <ShieldCheck className="h-5 w-5 text-teal-400" />
              <h4 className="text-sm font-bold text-white">Document Studio Suite</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated system for issuing certified invoice records, GST audits, internship transcripts, completion credentials, and bulk-generated event certificates for universities.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-20 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="w-full max-w-md">
          {/* Logo on mobile only */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#078EDB] to-[#07547E] flex items-center justify-center shadow-lg mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
                <path d="M2 10 L12 5 L22 10 L12 15 Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">LihaTech</h2>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold tracking-widest uppercase">
              Plan . Practice . Patience
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Administrative Portal
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sign in to manage company billing, client registries, and generate academic completion certificates.
            </p>
          </div>

          {error && (
            <div className="p-4 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-950/40 text-xs text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
              {error}
            </div>
          )}

          {firebaseConfigured ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleCompanyLogin}
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-800 dark:text-white font-semibold text-sm shadow-sm hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-55 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    <span>Signing in securely...</span>
                  </>
                ) : (
                  <span>Continue with LihaTech Google Account</span>
                )}
              </button>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Only approved company Google accounts can access this studio.
              </p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="email"
                  id="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@lihatech.com"
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950 py-3.5 pl-10 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-amber-500 outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950 py-3.5 pl-10 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-amber-500 outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Quick Helper Credentials Info Box */}
            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xxs text-amber-700 dark:text-amber-400 font-medium space-y-1">
              <p className="font-bold">🔑 Demo Access Credentials:</p>
              <p>Email: <span className="font-mono">admin@lihatech.com</span></p>
              <p>Password: <span className="font-mono">admin123</span></p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#078EDB] to-[#07547E] hover:from-[#07547E] hover:to-[#062B4B] text-white font-semibold text-sm shadow-md cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#00B9E8] focus:ring-offset-2 disabled:opacity-55 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Access Document Studio</span>
              )}
            </button>
            
          </form>
          )}

          {/* Copyright block */}
          <p className="text-center text-xxs text-gray-400 dark:text-gray-500 mt-12">
            &copy; {new Date().getFullYear()} LihaTech Solutions. All rights reserved.<br />
            Security Shield Authorized • Kolhapur Office
          </p>
        </div>
      </div>

    </div>
  );
}
