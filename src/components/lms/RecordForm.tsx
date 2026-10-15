import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { localDate, type Row } from '../../lib/lms';

export type Field = { key: string; label: string; type?: 'email'|'number'|'datetime-local'|'date'|'textarea'|'url'; required?: boolean; options?: {value:string;label:string}[] };
export default function RecordForm({title, fields, initial = {}, note, onSave, onCancel}: {title:string; fields:Field[]; initial?:Row; note?:(values:Row)=>React.ReactNode; onSave:(values:Row)=>Promise<void>;onCancel:()=>void}) {
  const [values,setValues] = useState<Row>(()=>Object.fromEntries(fields.map(f=>[f.key,f.type==='datetime-local' ? localDate(initial[f.key]) : initial[f.key] ?? (f.options?.[0]?.value ?? '')])));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { formRef.current?.scrollIntoView({block:'start'}); formRef.current?.querySelector<HTMLElement>('input,select,textarea')?.focus({preventScroll:true}); }, []);
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const payload = Object.fromEntries(fields.map(f=>[f.key,values[f.key]==='' ? (f.options || ['date','datetime-local','number'].includes(f.type??'') ? null : '') : f.type==='datetime-local' ? new Date(values[f.key]).toISOString() : f.type==='number' ? Number(values[f.key]) : String(values[f.key]).trim()]));
      await onSave(payload);
    } catch(e) {setError(e instanceof Error ? e.message : 'Could not save.');} finally {setBusy(false);}
  }
  return <form ref={formRef} onSubmit={submit} className="lms-panel lms-form" aria-label={title}>
    <h2>{title}</h2>{fields.some(f=>f.type==='datetime-local') && <p>Times use your browser timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>}
    <div className="lms-field-grid">{fields.map(f=><label key={f.key}>{f.label}{f.required && ' *'}
      {f.options ? <select required={f.required} value={values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.value})}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : f.type==='textarea' ? <textarea value={values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>
      : <input required={f.required} type={f.type??'text'} min={f.type==='number'?0:undefined} value={values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}
    </label>)}</div>
    {note?.(values)}
    {error && <p role="alert" className="lms-error">{error}</p>}
    <div className="lms-actions"><button className="studio-primary" disabled={busy}>{busy?'Saving…':'Save'}</button><button type="button" className="studio-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
