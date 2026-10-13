import { useState } from 'react';
import { errorMessage } from '../lib/documentStudio';

interface Props {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  onAdd: (name: string) => Promise<string>;
  className?: string;
}
export default function SavedOptionSelect({ label, value, options, onChange, onAdd, className }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true); setError('');
    try { onChange(await onAdd(name.trim())); setAdding(false); setName(''); }
    catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  return <div className="space-y-2">
    <select aria-label={label} value={value} className={className} onChange={event => {
      if (event.target.value === '__add_option__') { setAdding(true); setError(''); }
      else onChange(event.target.value);
    }}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value="__add_option__">+ Add new option…</option>
    </select>
    {adding && <div className="space-y-2">
      <label className="block text-xs font-medium">New {label.toLowerCase()}
        <input autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } if (event.key === 'Escape') setAdding(false); }}
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-950 dark:text-white" />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={saving || !name.trim()} onClick={save} className="min-h-11 rounded-lg bg-sky-700 px-3 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save option'}</button>
        <button type="button" disabled={saving} onClick={() => setAdding(false)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs">Cancel</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>}
  </div>;
}
