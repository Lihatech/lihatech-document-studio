import { useEffect, useRef } from 'react';
import { Loader2, WifiOff } from 'lucide-react';

export default function ConnectionNotice({ offline, checking, onRetry }: {
  offline: boolean; checking: boolean; onRetry: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.showModal();
    return () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="connection-heading" aria-describedby="connection-description"
    onCancel={event => event.preventDefault()}
    className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center text-[#062b4b] shadow-2xl backdrop:bg-slate-100/95 sm:p-8">
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-[#07547e]">
      <WifiOff size={28} aria-hidden="true" />
    </div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#07547e]">LihaTech learning portal</p>
    <h1 id="connection-heading" className="text-xl font-bold">{offline ? 'No network connection' : checking ? 'Reconnecting…' : 'Unable to connect'}</h1>
    <p id="connection-description" className="mt-3 text-sm leading-6 text-slate-600" role="status">
      {offline ? 'You’re offline. Check your Wi-Fi or mobile data. We’ll reconnect automatically when your network returns.'
        : checking ? 'Checking your connection and restoring access. Please wait.'
        : 'We couldn’t reach LihaTech. Check your internet connection and try again.'}
    </p>
    <button type="button" onClick={onRetry} disabled={checking && !offline}
      className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#078edb] px-4 text-sm font-bold text-white transition hover:bg-[#07547e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-wait disabled:opacity-60">
      {checking && !offline && <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {checking && !offline ? 'Reconnecting…' : 'Try again'}
    </button>
  </dialog>;
}
