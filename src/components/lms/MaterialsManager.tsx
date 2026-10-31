import { useRef, useState, type FormEvent } from 'react';
import { FileUp, Link2, Upload } from 'lucide-react';
import Modal from '../Modal';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/dialogs';
import { batchDateLabel, displayDate, localDate, removeAssignment, rpc, saveRow, type Row } from '../../lib/lms';
import { assignableBatch } from '../../lib/batches';

type Data=Record<string,Row[]>;
const message=(error:unknown)=>error instanceof Error?error.message:'Could not save. Please try again.';
export default function MaterialsManager({data,reload}:{data:Data;reload:()=>Promise<void>}){
  const [query,setQuery]=useState(''),[batch,setBatch]=useState('all'),[selected,setSelected]=useState<string[]>([]);
  const [editing,setEditing]=useState<Row|null|undefined>(undefined),[sharing,setSharing]=useState<string[]|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [deleting,setDeleting]=useState(false),[cleanupPath,setCleanupPath]=useState<string|null>(null);
  async function cleanupFile(path:string){
    if(!supabase)throw new Error('Supabase is not configured.');
    const result=await supabase.storage.from('lms-materials').remove([path]);
    if(result.error)throw result.error;
    setCleanupPath(null);
  }
  async function deleteDocument(row:Row){
    if(deleting||!await confirmAction(`Delete “${row.title}”? This removes the document, its uploaded file and access for every batch. This cannot be undone.`,'Delete document'))return;
    setDeleting(true);setError('');setNotice('');
    try{
      const path=await rpc<string|null>('lms_admin_delete_material',{p_material:row.id});
      setSelected(ids=>ids.filter(id=>id!==row.id));
      setNotice('Document deleted.');
      if(path){setCleanupPath(path);try{await cleanupFile(path);}catch{setError('Document deleted, but the uploaded file could not be removed. Retry file cleanup below.');}}
      await reload();
    }catch(e){setError(message(e));}finally{setDeleting(false);}
  }
  const rows=(data.learning_materials??[]).filter(row=>`${row.title} ${row.module_name}`.toLowerCase().includes(query.toLowerCase())&&(batch==='all'||(data.batch_materials??[]).some(link=>link.material_id===row.id&&link.batch_id===batch)));
  async function done(){setError('');setEditing(undefined);setSharing(null);setSelected([]);setNotice('Document and batch access saved.');await reload();}
  async function unpublish(link:Row){if(!await confirmAction('Remove this document from this batch? Other batches will keep their access.','Remove access'))return;setError('');try{await removeAssignment('batch_materials',{batch_id:link.batch_id,material_id:link.material_id});await reload();}catch(e){setError(message(e));}}
  return <>
    <div className="lms-toolbar"><label>Search documents<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title or section"/></label><label>Batch access<select aria-label="Batch access" value={batch} onChange={e=>{setBatch(e.target.value);setSelected([]);}}><option value="all">All uploaded documents</option>{data.batches?.map(b=><option key={b.id} value={b.id}>{b.name} · {b.code}</option>)}</select></label><button className="studio-secondary" onClick={()=>void reload()}>Refresh</button><button className="studio-primary" onClick={()=>setEditing(null)}><Upload size={17}/> Upload document</button></div>
    {error&&<p role="alert" className="lms-error">{error}</p>}{notice&&<p role="status" className="lms-status">{notice}</p>}
    {cleanupPath&&<button type="button" className="studio-secondary" disabled={deleting} onClick={async()=>{setDeleting(true);try{await cleanupFile(cleanupPath);setError('');setNotice('Document and uploaded file deleted.');}catch(e){setError(message(e));}finally{setDeleting(false);}}}>Retry file cleanup</button>}
    <div className="lms-actions lms-selection-bar"><label><input type="checkbox" checked={rows.length>0&&rows.every(row=>selected.includes(row.id))} onChange={e=>setSelected(e.target.checked?rows.map(row=>row.id):[])}/> Select all {rows.length} documents</label><button className="studio-primary" disabled={!selected.length} onClick={()=>setSharing(selected)}>Publish selected ({selected.length})</button><p>Select documents from batch A, then publish them to batch B in one step.</p></div>
    <div className="lms-material-grid">{rows.map(row=>{const links=(data.batch_materials??[]).filter(link=>link.material_id===row.id);return <article className="lms-material-card" key={row.id}>
      <div className="lms-material-top"><label className="lms-select-resource"><input aria-label={`Select ${row.title}`} type="checkbox" checked={selected.includes(row.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,row.id]:ids.filter(id=>id!==row.id))}/>{row.kind==='file'?<FileUp size={20}/>:<Link2 size={20}/>}</label><span className="lms-pill">{row.status==='hidden'?'Hidden':links.length?'Published':'Not shared'}</span></div><h2>{row.title}</h2><p>{row.description||'No description'}</p><small>{row.module_name||'General'} · {row.kind==='file'?'Private file':'Web link'}</small>
      <div className="lms-resource-access"><strong>Batch access</strong>{links.length?links.map(link=><div key={link.batch_id}><span>{data.batches?.find(b=>b.id===link.batch_id)?.name||'Batch'}<small>{displayDate(link.available_from)} → {link.expires_at?displayDate(link.expires_at):'Batch end'}</small></span><button className="lms-text-button" onClick={()=>void unpublish(link)}>Unpublish</button></div>):<p>No batches yet</p>}</div>
      <div className="lms-row-actions"><button className="studio-primary" disabled={deleting} onClick={()=>setSharing([row.id])}>Publish to batches</button><button className="studio-secondary" disabled={deleting} onClick={()=>setEditing(row)}>Edit document</button><button type="button" className="lms-danger-button" disabled={deleting||!!cleanupPath} onClick={()=>void deleteDocument(row)}>Delete document</button></div>
    </article>;})}</div>{!rows.length&&<p className="lms-panel">No documents found. Upload a file or add a link to begin.</p>}
    {editing!==undefined&&<MaterialEditor material={editing} data={data} onClose={()=>{setEditing(undefined);void reload();}} onDone={done}/>}
    {sharing&&<PublishMaterialsDialog data={data} materialIds={sharing} onClose={()=>setSharing(null)} onDone={done}/>}
  </>;
}

function MaterialEditor({material,data,onClose,onDone}:{material:Row|null;data:Data;onClose:()=>void;onDone:()=>Promise<void>}){
  const [source,setSource]=useState(material?.kind||'file'),[title,setTitle]=useState(material?.title||''),[description,setDescription]=useState(material?.description||''),[section,setSection]=useState(material?.module_name||''),[url,setUrl]=useState(material?.url||'');
  const [file,setFile]=useState<File|null>(null),[batches,setBatches]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const saved=useRef<string|undefined>(material?.id);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
    const values:Row={title:title.trim(),description:description.trim(),module_name:section.trim()};
    if(!values.title)throw new Error('Enter a document title.');
    if(!saved.current&&source==='file'){
      if(!file)throw new Error('Choose a file.');if(file.size>4*1024*1024)throw new Error('Choose a file up to 4 MB, or use a link for a larger document.');
      const path=`${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const upload=await supabase!.storage.from('lms-materials').upload(path,file);if(upload.error)throw new Error(upload.error.message);
      try{saved.current=(await saveRow('learning_materials',{...values,kind:'file',storage_path:path,status:'draft'})).id;}
      catch(e){await supabase!.storage.from('lms-materials').remove([path]);throw e;}
    }else{
      if(source==='link'){if(!/^https:\/\//i.test(url.trim()))throw new Error('Enter an HTTPS link.');values.url=url.trim();}
      saved.current=(await saveRow('learning_materials',{...values,...(!saved.current?{kind:source,status:'draft'}:{})},saved.current?{id:saved.current}:undefined)).id;
    }
    if(batches.length)await rpc('lms_publish_resources',{p_materials:[{id:saved.current}],p_batches:batches,p_available_from:new Date().toISOString(),p_expires_at:null});
    await onDone();
  }catch(e){setError(message(e));}finally{setBusy(false);}}
  return <Modal title={material?'Edit document':'Upload document'} busy={busy} onClose={onClose}><form className="lms-form" onSubmit={submit}>
    {!material&&<div className="lms-source-toggle"><button type="button" disabled={!!saved.current} aria-pressed={source==='file'} onClick={()=>setSource('file')}><FileUp size={18}/> Upload file</button><button type="button" disabled={!!saved.current} aria-pressed={source==='link'} onClick={()=>setSource('link')}><Link2 size={18}/> Add link</button></div>}
    <label>Document title<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    {source==='file'&&!material&&<label>File · up to 4 MB<input required={!saved.current} disabled={!!saved.current} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.png,.jpg,.jpeg" onChange={e=>{const f=e.target.files?.[0]??null;setFile(f);if(f&&!title)setTitle(f.name);}}/></label>}
    {source==='link'&&<label>Google Drive or HTTPS link<input required type="url" value={url} onChange={e=>setUrl(e.target.value)}/><small>For a restricted Drive link, also grant access to students in Google Drive.</small></label>}
    <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Section (optional)<input value={section} onChange={e=>setSection(e.target.value)}/></label>
    {!material&&<BatchChoices batches={(data.batches??[]).filter(assignableBatch)} selected={batches} onChange={setBatches}/>}
    {!material&&<p>Choose batches to publish immediately, or leave them empty to upload privately.</p>}
    {error&&<p className="lms-error" role="alert">{error}{saved.current&&' The document is saved privately; you can retry publishing it.'}</p>}
    <div className="lms-actions"><button disabled={busy} className="studio-primary">{busy?'Saving…':material?'Save document':'Save document & access'}</button><button type="button" disabled={busy} className="studio-secondary" onClick={onClose}>Cancel</button></div>
  </form></Modal>;
}

export function BatchChoices({batches,selected,onChange}:{batches:Row[];selected:string[];onChange:(ids:string[])=>void}){
  return <fieldset className="lms-choice-list"><legend>Give batch access</legend>{batches.map(batch=><label key={batch.id}><input type="checkbox" checked={selected.includes(batch.id)} onChange={event=>onChange(event.target.checked?[...selected,batch.id]:selected.filter(id=>id!==batch.id))}/><span><strong>{batch.name} · {batch.code}</strong><small>{batchDateLabel(batch.start_date)} – {batchDateLabel(batch.end_date)}</small></span></label>)}{!batches.length&&<p>Create an upcoming or active batch to publish documents.</p>}</fieldset>;
}

export function PublishMaterialsDialog({data,materialIds=[],batchIds=[],onClose,onDone}:{data:Data;materialIds?:string[];batchIds?:string[];onClose:()=>void;onDone:()=>Promise<void>}){
  const [materials,setMaterials]=useState(materialIds),[batches,setBatches]=useState(batchIds),[release,setRelease]=useState(localDate(new Date().toISOString())),[expiry,setExpiry]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{if(!materials.length||!batches.length)throw new Error('Choose at least one document and one batch.');await rpc('lms_publish_resources',{p_materials:materials.map(id=>({id})),p_batches:batches,p_available_from:new Date(release).toISOString(),p_expires_at:expiry?new Date(expiry).toISOString():null});await onDone();}catch(e){setError(message(e));}finally{setBusy(false);}}
  return <Modal title="Publish documents to batches" busy={busy} wide onClose={onClose}><form className="lms-form" onSubmit={submit}><fieldset className="lms-choice-list"><legend>Documents</legend>{data.learning_materials?.map(row=><label key={row.id}><input type="checkbox" checked={materials.includes(row.id)} onChange={e=>setMaterials(ids=>e.target.checked?[...ids,row.id]:ids.filter(id=>id!==row.id))}/><span>{row.title}</span></label>)}</fieldset><BatchChoices batches={(data.batches??[]).filter(assignableBatch)} selected={batches} onChange={setBatches}/><div className="lms-field-grid"><label>Available from<input required type="datetime-local" value={release} onChange={e=>setRelease(e.target.value)}/></label><label>Expiry (optional)<input type="datetime-local" value={expiry} min={release} onChange={e=>setExpiry(e.target.value)}/></label></div><p>Existing access for other batches is kept. Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Publishing again updates the release window for the selected batches.</p>{error&&<p role="alert" className="lms-error">{error}</p>}<div className="lms-actions"><button disabled={busy} className="studio-primary">{busy?'Publishing…':`Publish ${materials.length} ${materials.length===1?'document':'documents'} to ${batches.length} ${batches.length===1?'batch':'batches'}`}</button><button type="button" className="studio-secondary" disabled={busy} onClick={onClose}>Cancel</button></div></form></Modal>;
}
