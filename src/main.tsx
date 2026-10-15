import {StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">Loading your portal…</div>}><App /></Suspense>
  </StrictMode>,
);
