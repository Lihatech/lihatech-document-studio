import {StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppDialogs } from './lib/dialogs';
import './index.css';
import { lazy } from 'react';
const CertificateApplication=lazy(()=>import('./pages/CertificateApplication'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDialogs />
    <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">Loading…</div>}>{window.location.pathname.replace(/\/$/,'')==='/certificate-request'?<CertificateApplication/>:<App />}</Suspense>
  </StrictMode>,
);
