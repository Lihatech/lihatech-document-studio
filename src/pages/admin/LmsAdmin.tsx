import React, { useEffect, useState } from 'react';
import { read, utils } from 'xlsx';
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, FileUp, Layers3, Link2, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { batchDateLabel, batchEndInstant, displayDate, listRows, lmsApi, lmsTables, rpc, saveRow, removeAssignment, type LmsTable, type Row } from '../../lib/lms';
import RecordForm, { type Field } from '../../components/lms/RecordForm';
import ListFilters from '../../components/lms/ListFilters';
import { assignableBatch, batchState } from '../../lib/batches';
import { CERTIFICATE_TYPE_PRESETS, getCertificateCategoryOptions } from '../../utils/certificateUtils';
import '../../styles/lms.css';

const options = (...values:string[]) => values.map(value=>({value,label:value.replaceAll('_',' ')}));
const field = (key:string,label:string,type?:Field['type'],required=false):Field=>({key,label,type,required});
const status = (...values:string[]):Field=>({key:'status',label:'Status',options:options(...values)});
const config:Record<string,{title:string;table:LmsTable;fields:Field[]}> = {
  students:{title:'Students',table:'students',fields:[field('email','Registered Google email','email',true),status('active','suspended','completed','archived'),field('internal_notes','Internal notes','textarea')]},
  batches:{title:'Batches',table:'batches',fields:[field('name','Batch name',undefined,true),field('code','Batch code',undefined,true),field('course_name','Course / programme name',undefined,true),field('start_date','Start date','date',true),field('end_date','End date','date',true),status('planned','active','paused','completed','cancelled'),{key:'certificate_type',label:'Certificate type',required:true,options:CERTIFICATE_TYPE_PRESETS.map(({value,label})=>({value,label}))},{key:'offer_type',label:'Offer letter type',options:[{value:'',label:'Not offered'},...options('Internship Offer','Job Offer')]},field('designation','Offer role / designation'),field('document_department','Offer department / domain'),field('notes','Internal notes','textarea')]},
  materials:{title:'Materials',table:'learning_materials',fields:[field('title','Title',undefined,true),field('description','Description','textarea'),field('module_name','Module / section'),field('url','Google Drive or HTTPS link','url',true)]},
  mocks:{title:'Mock interviews',table:'mock_interview_slots',fields:[]},
  team:{title:'Admins',table:'admin_profiles',fields:[]},
};
const workflow = [
  {path:'/batches',title:'Create a batch',detail:'Set the dates that control student access.',icon:Layers3},
  {path:'/students',title:'Add students',detail:'Register their email and assign a batch.',icon:Users},
  {path:'/materials',title:'Publish materials',detail:'Share a Drive link or a private file with a batch.',icon:BookOpen},
  {path:'/mock-interviews',title:'Review mock interviews',detail:'Approve requests and send Google Meet invitations.',icon:CalendarDays},
];

export default function LmsAdmin({module='overview',navigate,certificateCategories=[]}:{module?:string;navigate:(path:string)=>void;certificateCategories?:string[]}) {
  const [data,setData] = useState<Record<string,Row[]>>({});
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [query,setQuery] = useState(''), [selected,setSelected] = useState<Row|null>(null);
  const [statusFilter,setStatusFilter] = useState('all'), [batchFilter,setBatchFilter] = useState('all'), [kindFilter,setKindFilter] = useState('all'), [importBatch,setImportBatch] = useState('');
  const [composer,setComposer] = useState<{title:string;table:LmsTable;fields:Field[];initial?:Row;keys?:Row;extra?:Row;invite?:boolean;publish?:boolean;note?:(values:Row)=>React.ReactNode}|null>(null);
  const [busy,setBusy] = useState(false);
  const [calendar,setCalendar] = useState<{configured:boolean;interviewer_email:string}|null>(null);
  const c=config[module];
  async function reload() {
    setLoading(true);setError('');
    try {const entries=await Promise.all(lmsTables.map(async t=>[t,await listRows(t)]));setData(Object.fromEntries(entries));}
    catch(e){setError(e instanceof Error?e.message:'Could not load LMS.');} finally{setLoading(false);}
  }
  useEffect(()=>{void reload();},[]);
  useEffect(()=>{if(module==='mocks') void lmsApi<{configured:boolean;interviewer_email:string}>('/admin/mocks/calendar','GET').then(setCalendar).catch(()=>setCalendar(null));},[module]);
  useEffect(()=>{setComposer(null);setSelected(null);setQuery('');setNotice('');setStatusFilter('all');setBatchFilter('all');setKindFilter('all');},[module]);
  useEffect(()=>{if(selected) requestAnimationFrame(()=>document.querySelector('.lms-detail')?.scrollIntoView({block:'start',behavior:'smooth'}));},[selected]);
  const openBatches=(data.batches??[]).filter(assignableBatch);
  const select = (key:string,label:string,table:string,optional=false):Field=>({key,label,required:!optional,options:[{value:'',label:optional?'None':`Select ${label.toLowerCase()}`},...(table==='batches'?openBatches:data[table]??[]).map(r=>({value:r.id,label:table==='batches'?`${r.name} · ${r.code} · ${batchDateLabel(r.start_date)} – ${batchDateLabel(r.end_date)}`:r.full_name??r.name??r.title}))]});
  const batchEnd=(batchId?:string)=>data.batches?.find(batch=>batch.id===batchId)?.end_date as string|undefined;
  const accessEnd=(batchId?:string,earlyEnd?:string)=>{
    const end=batchEnd(batchId);
    if(!end) return earlyEnd ? displayDate(earlyEnd) : 'No batch end date set';
    return earlyEnd && new Date(earlyEnd).getTime()<batchEndInstant(end)!.getTime() ? displayDate(earlyEnd) : batchDateLabel(end);
  };
  const accessNote=(values:Row,batchId?:string)=><p className="lms-access-note"><CalendarDays size={18}/><span>Access follows the batch dates: <strong>{batchDateLabel(data.batches?.find(b=>b.id===(batchId??values.batch_id))?.start_date)} – {accessEnd(batchId??values.batch_id)}</strong> (IST). Assigning a different batch replaces the current assignment and preserves its history.</span></p>;
  function edit(row?:Row) {
    if(!c) return;
    if(module==='students'&&!row&&!openBatches.length){setError('Create an upcoming or active batch before adding students.');return;}
    setSelected(null);
    const fields=c.table==='students'&&!row
      ? [field('email','Registered Google email','email',true),select('batch_id','Assign to batch','batches')]
      : [...(c.table==='students'?[field('full_name','Full name',undefined,true),field('phone','Phone'),field('address','Address','textarea'),{key:'profile_type',label:'Student or professional',options:[{value:'',label:'Not shared'},...options('student','working')]},field('college_name','College'),field('department','Branch / field of study'),field('college_location','College location'),field('office_name','Company'),field('job_title','Position'),field('office_location','Company location')]:[]),...c.fields].map(f=>f.key==='certificate_type'?{...f,options:getCertificateCategoryOptions(certificateCategories,row?.certificate_type)}:f).filter(f=>!(c.table==='learning_materials' && row?.kind==='file' && f.key==='url'));
    setComposer({title:`${row?'Edit':'Add'} ${module==='students'?'student':module==='batches'?'batch':'material'}`,table:c.table,fields,initial:row??(module==='batches'?{start_date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),status:'planned',certificate_type:'Course Completion'}:{}),keys:row?{id:row.id}:undefined,extra:module==='materials'?{kind:row?.kind??'link'}:undefined,note:c.table==='students'&&!row?values=><p className="lms-access-note"><CalendarDays size={18}/><span>The student fills in their name and optional details at first sign-in. Access follows the selected batch dates and ends on <strong>{accessEnd(values.batch_id)}</strong>.</span></p>:c.table==='batches'?()=> <p className="lms-access-note"><CalendarDays size={18}/><span>Students get access automatically from the start date through the end date (IST). Pausing, completing or cancelling a batch removes access. Course and offer details prefill student document requests.</span></p>:undefined});
  }
  function publishMaterial(row?:Row) {
    if(!openBatches.length){setError('Create an upcoming or active batch before publishing material.');return;}
    setSelected(null);setError('');
    const fields=[field('title','Material title',undefined,true),...(row?.kind==='file'?[]:[field('url','Google Drive or HTTPS link','url',true)]),field('description','What students will learn','textarea'),field('module_name','Module / section'),select('batch_id','Publish to batch','batches'),field('available_from','Available from','datetime-local',true),field('expires_at','Remove after (optional)','datetime-local')];
    setComposer({title:row?'Publish material to a batch':'Add and publish a Drive link',table:'learning_materials',fields,publish:true,
      initial:{...row,available_from:new Date().toISOString(),expires_at:null},keys:row?{id:row.id}:undefined,
      note:values=><p className="lms-access-note"><CalendarDays size={18}/><span>Students in <strong>{name('batches',values.batch_id)}</strong> can open this from the release time until its optional expiry or the batch end ({batchDateLabel(batchEnd(values.batch_id))}), whichever comes first. {row?.kind==='file'?'This file stays private in LMS storage.':'For Drive links, also grant the students access in Google Drive.'}</span></p>});
  }
  async function save(values:Row) {
    if(!composer) return;
    const assignedBatch=data.batches?.find(b=>b.id===(values.batch_id??composer.extra?.batch_id??composer.initial?.batch_id));
    const startsAt=assignedBatch?.start_date?`${assignedBatch.start_date}T00:00:00+05:30`:values.starts_at;
    const expiresAt=values.expires_at??null;
    if(composer.table==='batches' && values.end_date<values.start_date) throw new Error('The batch end date must be on or after its start date.');
    if(composer.table==='batches'&&values.offer_type&&(!values.designation?.trim()||!values.document_department?.trim())) throw new Error('Enter the role and department when enabling offer letters for this batch.');
    if(composer.table==='batch_students'||(composer.table==='students'&&!composer.keys)) {
      const batchId=values.batch_id??composer.extra?.batch_id??composer.initial?.batch_id;
      const end=batchEnd(batchId);
      if(!end) throw new Error('Set the batch end date before assigning students.');
      const boundary=batchEndInstant(end)!.getTime();
      if(new Date(startsAt).getTime()>=boundary) throw new Error('Access must start before the batch ends.');
      if(expiresAt && (new Date(expiresAt).getTime()>boundary||new Date(expiresAt).getTime()<=new Date(startsAt).getTime())) throw new Error('The student cutoff must be after access starts and within the batch dates.');
    }
    if(composer.publish||composer.table==='batch_materials') {
      const batchId=values.batch_id??composer.extra?.batch_id??composer.initial?.batch_id;
      if(!batchEnd(batchId)) throw new Error('Set the batch end date before publishing material.');
      if(values.expires_at&&new Date(values.expires_at).getTime()<=new Date(values.available_from).getTime()) throw new Error('Material expiry must be after its release time.');
    }
    if(composer.publish) {
      const {batch_id,available_from,expires_at,...material}=values;
      const id=await rpc<string>('lms_publish_material',{p_material:{...material,...composer.keys},p_batch:batch_id,p_available_from:available_from,p_expires_at:expires_at});
      setSelected({id,title:material.title});
    }
    else if(composer.table==='batch_materials') {
      if(composer.keys) await saveRow('batch_materials',{available_from:values.available_from,expires_at:values.expires_at},composer.keys);
      else await rpc('lms_publish_material',{p_material:{id:values.material_id??composer.extra?.material_id??composer.initial?.material_id},
        p_batch:values.batch_id??composer.extra?.batch_id??composer.initial?.batch_id,
        p_available_from:values.available_from,p_expires_at:values.expires_at});
    }
    else if(composer.invite) await rpc('lms_invite_admin',{p_name:values.full_name,p_email:values.email});
    else if(composer.table==='students'&&!composer.keys) {
      await rpc('lms_create_student_in_batch',{p_email:values.email,p_batch:values.batch_id});
    }
    else if(composer.table==='batch_students'&&!composer.keys) await rpc('lms_assign_student_to_batch',{
      p_student:values.student_id??composer.extra?.student_id,p_batch:values.batch_id??composer.extra?.batch_id,p_status:values.status,
    });
    else await saveRow(composer.table,{...values,...composer.extra,...(composer.table==='batch_students'?{starts_at:startsAt,expires_at:null}:{})},composer.keys);
    setComposer(null);setNotice(composer.publish||composer.table==='batch_materials'&&!composer.keys?'Material published to the selected batch.':'Saved to the shared LMS.');await reload();
  }
  async function action(fn:()=>Promise<unknown>) {
    setBusy(true);setError('');
    try{await fn();setNotice('Updated successfully.');await reload();}catch(e){setError(e instanceof Error?e.message:'Could not update.');}finally{setBusy(false);}
  }
  async function deleteStudent(student:Row) {
    if(!window.confirm(`Permanently delete ${student.profile_completed_at?student.full_name:student.email}? This also deletes their batch access and interview bookings.`)) return;
    if(selected?.id===student.id) setSelected(null);
    await action(()=>removeAssignment('students',{id:student.id}));
  }
  function enrollment(row?:Row, studentId?:string, batchId?:string) {
    setComposer({title:row?'Update enrollment and access':'Assign student to batch',table:'batch_students',
      fields:[...(studentId||row?[]:[select('student_id','Student','students')]),...(batchId||row?[]:[select('batch_id','Batch','batches')]),status(...(row?['active','suspended','revoked']:['active','suspended']))],
      initial:row??{starts_at:new Date().toISOString()},keys:row?{batch_id:row.batch_id,student_id:row.student_id}:undefined,
      extra:{...(studentId?{student_id:studentId}:{}),...(batchId?{batch_id:batchId}:{}),left_at:null},note:values=>accessNote(values,row?.batch_id??batchId)});
  }
  function materialAssignment(row?:Row,batchId?:string,materialId?:string) {
    setComposer({title:'Publish material to a batch',table:'batch_materials',fields:[...(batchId||row?[]:[select('batch_id','Batch','batches')]),...(materialId||row?[]:[select('material_id','Material','learning_materials')]),field('available_from','Release time','datetime-local',true),field('expires_at','Expiry time','datetime-local')],
      initial:row??{available_from:new Date().toISOString()},keys:row?{batch_id:row.batch_id,material_id:row.material_id}:undefined,extra:{...(batchId?{batch_id:batchId}:{}),...(materialId?{material_id:materialId}:{})},
      note:values=><p className="lms-access-note"><CalendarDays size={18}/><span>Visible to active students in <strong>{name('batches',batchId??row?.batch_id??values.batch_id)}</strong> from the release time until the earlier of this expiry or the batch end.</span></p>});
  }
  async function importCsv(file:File) {
    await action(async()=>{
      const sheet=read(await file.arrayBuffer()).Sheets;
      const rows=utils.sheet_to_json<Row>(sheet[Object.keys(sheet)[0]],{defval:''});
      if(!rows.length || rows.some(r=>!r.email)) throw new Error('CSV requires an email column.');
      if(!importBatch) throw new Error('Choose a batch before importing students.');
      await rpc('lms_import_students_to_batch',{p_rows:rows.map(r=>({email:String(r.email)})),p_batch:importBatch});
    });
  }
  async function upload(file:File) {
    setBusy(true);setError('');
    try {
      if(file.size>4*1024*1024) throw new Error('Choose a file no larger than 4 MB. Use a Drive link for larger files.');
      const path=`${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const {error}=await supabase!.storage.from('lms-materials').upload(path,file);
      if(error) throw new Error(error.message);
      // A private unassigned upload is inaccessible to students until its record is published.
      let material:Row;
      try { material=await saveRow('learning_materials',{title:file.name,kind:'file',storage_path:path,status:'draft'}); }
      catch(e){await supabase!.storage.from('lms-materials').remove([path]);throw e;}
      setNotice('File uploaded privately. Choose its batch and release time to publish it.');await reload();publishMaterial(material);
    }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
  }
  const find=(table:string,id:string)=>(data[table]??[]).find(r=>r.id===id);
  const name=(table:string,id:string)=>{const r=find(table,id);return table==='students'&&!r?.profile_completed_at?r?.email??'Removed record':r?.full_name??r?.name??r?.title??'Removed record';};
  const rows=(data[c?.table??'students']??[]).filter(r=> {
    const booking=(data.mock_interview_bookings??[]).find(b=>b.slot_id===r.id);
    const rowStatus=module==='batches'?batchState(r):module==='mocks'?booking?.status:module==='team'?r.is_active?'active':'inactive':r.status;
    return (statusFilter==='all'||rowStatus===statusFilter)
      && (module!=='materials'||(kindFilter==='all'||r.kind===kindFilter)&&(batchFilter==='all'||(data.batch_materials??[]).some(link=>link.material_id===r.id&&link.batch_id===batchFilter)))
      && (module!=='mocks'||kindFilter==='all'||(kindFilter==='upcoming'?Date.parse(r.ends_at)>Date.now():Date.parse(r.ends_at)<=Date.now()));
  }).filter(r=>module==='mocks'
    ? (data.mock_interview_bookings??[]).some(booking=>booking.slot_id===r.id) && `${displayDate(r.starts_at)} ${(data.mock_interview_bookings??[]).filter(booking=>booking.slot_id===r.id).map(booking=>name('students',booking.student_id)).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    : JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  const pendingRequests=(data.mock_interview_bookings??[]).filter(r=>r.status==='requested'||r.status==='approving');
  const batchSummary=(batch:Row)=>{
    const links=(data.batch_students??[]).filter(link=>link.batch_id===batch.id);
    const now=Date.now();
    const active=links.filter(link=>batchState(batch)==='active').filter(link=>link.status==='active'&&!link.left_at&&new Date(link.starts_at).getTime()<=now&&(!link.expires_at||new Date(link.expires_at).getTime()>now)&&(!batch.end_date||now<batchEndInstant(batch.end_date)!.getTime())&&(data.students??[]).some(student=>student.id===link.student_id&&student.status==='active'));
    return `${links.length} student records · ${active.length} currently have access`;
  };
  const filteredStudents=(data.students??[]).filter(student=>{
    if(statusFilter!=='all'&&student.status!==statusFilter) return false;
    if(batchFilter!=='all'&&!(data.batch_students??[]).some(link=>link.student_id===student.id&&link.batch_id===batchFilter&&!link.left_at&&link.status!=='revoked')) return false;
    const batchNames=(data.batch_students??[]).filter(link=>link.student_id===student.id).map(link=>name('batches',link.batch_id)).join(' ');
    return `${JSON.stringify(student)} ${batchNames}`.toLowerCase().includes(query.toLowerCase());
  });
  const studentGroups=[...(data.batches??[]).map(batch=>({id:batch.id,title:`${batch.name}${batch.code?` · ${batch.code}`:''}`,entries:filteredStudents.flatMap(student=>{
    const membership=(data.batch_students??[]).find(link=>link.student_id===student.id&&link.batch_id===batch.id&&!link.left_at&&link.status!=='revoked');
    return membership?[{student,membership}]:[];
  })})).filter(group=>group.entries.length),
    {id:'unassigned',title:'Not assigned to a batch',entries:filteredStudents.filter(student=>!(data.batch_students??[]).some(link=>link.student_id===student.id&&!link.left_at&&link.status!=='revoked')).map(student=>({student,membership:null as Row|null}))}]
    .filter(group=>group.entries.length);
  const peoplePage=module==='students'||module==='batches';
  const materialPage=module==='materials';
  return <div className="lms-workspace">
    <header className="lms-page-head"><div>{c&&<button className="lms-back" onClick={()=>navigate('/')}><ArrowLeft size={16}/> Learning overview</button>}<p className="lms-eyebrow">LIHATECH LEARN / {c?c.title.toUpperCase():'ADMIN WORKSPACE'}</p><h1>{module==='students'?'Students & access':module==='batches'?'Batches & dates':materialPage?'Learning materials':module==='mocks'?'Mock interviews':module==='team'?'Admin access':'Learning operations'}</h1><p>{module==='students'?'Register students and manage access by batch.':module==='batches'?'Set the learning period and manage batch assignments.':materialPage?'Upload or link materials, then choose who can access them and when.':module==='mocks'?'Review requests, confirm interviews and manage Meet invitations.':module==='team'?'Manage the admins who can use this workspace.':'Set up a batch, add students, publish materials and review mock interviews.'}</p></div>{peoplePage&&<div className="lms-page-switch" aria-label="Student and batch pages"><button className={module==='students'?'is-current':''} onClick={()=>navigate('/students')}>Students</button><button className={module==='batches'?'is-current':''} onClick={()=>navigate('/batches')}>Batches</button></div>}</header>
    {error && <div role="alert" className="lms-error">{error} <button className="studio-secondary" onClick={reload}>Retry</button></div>}
    {notice && <p role="status" className="lms-status">{notice}</p>}
    {loading && <p role="status">Loading shared LMS records…</p>}
    {!loading && !c && <><section className="lms-overview-strip" aria-label="Workspace at a glance"><div><span>STUDENTS</span><strong>{data.students?.length??0}</strong><small>registered learners</small></div><div><span>BATCHES</span><strong>{data.batches?.filter(row=>row.status==='active').length??0}</strong><small>active batches</small></div><div><span>MATERIALS</span><strong>{data.learning_materials?.filter(row=>row.status==='published').length??0}</strong><small>published resources</small></div><button onClick={()=>navigate('/mock-interviews')}><span>MOCK INTERVIEWS</span><strong>{pendingRequests.length}</strong><small>requests to review <ChevronRight size={15}/></small></button></section><div className="lms-workflow-heading"><div><span className="lms-eyebrow">MANAGE LEARNING</span><h2>What would you like to do?</h2></div><p>Start with a batch, then give students access to materials and interviews.</p></div><section className="lms-workflow" aria-label="Learning management tasks">{workflow.map(({path,title,detail,icon:Icon},index)=><button className="lms-workflow-card" key={path} onClick={()=>navigate(path)}><span className="lms-workflow-step">{String(index+1).padStart(2,'0')}</span><span className="lms-group-icon"><Icon size={22}/></span><strong>{title}</strong><span>{detail}</span><ChevronRight className="lms-workflow-arrow" size={20}/></button>)}</section><p className="lms-workflow-footer">Need invoices or certificates? <button className="lms-text-button" onClick={()=>navigate('/documents')}>Open Document Studio <ChevronRight size={16}/></button></p></>}
    {c && <>
      <div className="lms-toolbar"><ListFilters query={query} onQuery={setQuery} placeholder={module==='students'?'Search name, email or batch':module==='mocks'?'Search student or date':module==='materials'?'Search title or section':'Search name or code'} filters={[
          {label:'Status',value:statusFilter,onChange:setStatusFilter,options:[{value:'all',label:'All statuses'},...options(...(module==='batches'?['planned','active','paused','completed','cancelled']:module==='students'?['active','suspended','completed','archived']:module==='materials'?['draft','published','hidden']:module==='mocks'?['requested','approving','booked','completed','no_show','cancelled','rejected']:['active','inactive']))]},
          ...(['students','materials'].includes(module)?[{label:'Batch',value:batchFilter,onChange:setBatchFilter,options:[{value:'all',label:'Any batch'},...openBatches.map(b=>({value:b.id,label:`${b.name} · ${b.code}`}))]}]:[]),
          ...(['materials','mocks'].includes(module)?[{label:module==='materials'?'Source':'When',value:kindFilter,onChange:setKindFilter,options:module==='materials'?[{value:'all',label:'All sources'},{value:'file',label:'Private files'},{value:'link',label:'Drive / web links'}]:[{value:'all',label:'All dates'},{value:'upcoming',label:'Upcoming'},{value:'past',label:'Past'}]}]:[])
        ]}/>
        <button className="studio-secondary" disabled={loading||busy} onClick={reload}>Refresh</button>
        {module!=='mocks'&&<button className="studio-primary" disabled={loading||busy} onClick={()=>module==='team'?setComposer({title:'Invite admin',table:'admin_profiles',fields:[field('full_name','Full name',undefined,true),field('email','LihaTech Google email','email',true)],invite:true}):materialPage?publishMaterial():edit()}>{(peoplePage||materialPage)&&<Plus size={17}/>} {module==='team'?'Invite admin':materialPage?'Add Drive link':module==='batches'?'Add batch':'Add student'}</button>}
      </div>
      {module==='students' && <details className="lms-import"><summary>Import students from CSV</summary><label>Assign imported students to<select value={importBatch} onChange={e=>setImportBatch(e.target.value)}><option value="">Choose a current batch</option>{openBatches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.code}</option>)}</select></label><label>CSV column: email<input disabled={busy} type="file" accept=".csv" onChange={e=>{if(e.target.files?.[0]) void importCsv(e.target.files[0]);e.target.value='';}}/></label><p>Every imported student is assigned to the selected batch. Access follows its dates; students complete their profile at first sign-in.</p></details>}
      {materialPage && <div className="lms-upload-panel"><span className="lms-group-icon"><FileUp size={21}/></span><div><strong>Upload a private file</strong><p>PDF, Office document, image or ZIP up to 4 MB. Larger files can be shared through Drive.</p></div><label className="lms-upload-button">Choose file<input disabled={busy||loading} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.png,.jpg,.jpeg" onChange={e=>{if(e.target.files?.[0]) void upload(e.target.files[0]);e.target.value='';}}/></label></div>}
      {materialPage && <p className="lms-drive-note">For Drive links, use Restricted sharing and add each student's registered email in Google Drive. LMS expiry does not remove Drive permissions.</p>}
      {module==='mocks'&&<p className="lms-access-note"><CalendarDays size={18}/><span>{calendar?.configured?`Confirmed interviews are added automatically to the LihaTech calendar. Interviewer: ${calendar.interviewer_email}.`:'Google Calendar is not connected yet. Students can request slots, but approval and automatic Meet links require the server calendar settings.'}</span></p>}
      {module==='mocks'&&pendingRequests.length>0&&<section className="lms-panel"><h2>Requests awaiting approval</h2>{pendingRequests.map(r=>{const slot=find('mock_interview_slots',r.slot_id);return <div className="lms-record" key={r.id}><div><strong>{name('students',r.student_id)}</strong><p>{slot?`${displayDate(slot.starts_at)} → ${displayDate(slot.ends_at)}`:'Slot removed'} · {r.status==='approving'?'Creating meeting':'Pending review'}</p>{r.calendar_error&&<p role="alert">Calendar: {r.calendar_error}</p>}</div><div className="lms-actions"><button className="studio-primary" disabled={busy||!calendar?.configured} onClick={()=>void action(()=>lmsApi(`/admin/mocks/${r.id}/approve`))}>{r.status==='approving'?'Retry approval':'Accept and create Meet'}</button>{r.status==='requested'&&<button className="studio-secondary" disabled={busy} onClick={()=>void action(()=>lmsApi(`/admin/mocks/${r.id}/reject`))}>Reject</button>}</div></div>;})}</section>}
      {materialPage && !data.batches?.length && <p className="lms-access-note">Create a batch before publishing materials. <button className="lms-text-button" onClick={()=>navigate('/batches')}>Go to batches <ChevronRight size={16}/></button></p>}
      {composer && <RecordForm key={JSON.stringify(composer)} {...composer} onSave={save} onCancel={()=>setComposer(null)}/>}
      {module==='mocks'&&rows.length>0&&<h2 className="lms-list-title">Interview records</h2>}
      {module==='students' ? studentGroups.map(group=><section className="lms-panel lms-group" key={group.id}><div className="lms-group-head"><div><span className="lms-group-icon"><Users size={20}/></span><div><h2>{group.title}</h2><p>{group.entries.length} {group.entries.length===1?'student':'students'}{group.id!=='unassigned'&&` · access until ${accessEnd(group.id)}`}</p></div></div>{group.id!=='unassigned'&&<button className="lms-text-button" onClick={()=>navigate('/batches')}>View batches <ChevronRight size={16}/></button>}</div><div className="lms-records">{group.entries.map(({student,membership})=><article className="lms-record lms-person-row" key={`${group.id}-${student.id}`}>
        <div className="lms-person-main"><span className="lms-avatar" aria-hidden="true">{student.profile_completed_at?String(student.full_name??'?').charAt(0).toUpperCase():'?'}</span><div><strong>{student.profile_completed_at?student.full_name:'Profile pending'}</strong><p>{student.email}</p><p><span className={`lms-pill ${membership?.status==='active'&&!membership.left_at?'is-active':'is-muted'}`}>{membership?.left_at?'Removed':membership?.status??'Unassigned'}</span> {membership?`Starts ${displayDate(membership.starts_at)} · ends ${accessEnd(membership.batch_id,membership.expires_at)}`:'Assign a batch to enable access'}</p></div></div>
        <div className="lms-row-actions"><button className="studio-primary" onClick={()=>{setSelected(student);setComposer(null);}}>Manage access</button><button className="studio-secondary" onClick={()=>edit(student)}>Edit</button><button disabled={busy} className="lms-danger-button" onClick={()=>void deleteStudent(student)}>Delete</button></div>
      </article>)}</div></section>) : materialPage ? <div className="lms-material-grid">{rows.map(r=>{const releases=(data.batch_materials??[]).filter(link=>link.material_id===r.id);return <article className="lms-material-card" key={r.id}><div className="lms-material-top"><span className="lms-group-icon">{r.kind==='file'?<FileUp size={20}/>:<Link2 size={20}/>}</span><span className={`lms-pill ${r.status==='published'&&releases.length?'is-active':'is-muted'}`}>{r.status==='published'&&!releases.length?'Unassigned':r.status}</span></div><h2>{r.title}</h2><p className="lms-material-description">{r.description||'No description added yet.'}</p><div className="lms-material-meta"><span>{r.kind==='file'?'Private file':'Drive / web link'}</span><span>{r.module_name||'No section'}</span><span>{releases.length} {releases.length===1?'batch':'batches'}</span></div><p className="lms-material-release">{releases.length?`First release ${displayDate(releases.map(link=>link.available_from).sort()[0])}`:'Not assigned to a batch'}</p><div className="lms-row-actions"><button className="studio-primary" onClick={()=>publishMaterial(r)}>Publish to batch</button><button className="studio-secondary" onClick={()=>{setSelected(r);setComposer(null);}}>Release windows</button><button className="studio-secondary" onClick={()=>edit(r)}>Edit</button>{r.status==='published'&&<button className="lms-text-button" disabled={busy} onClick={()=>void action(()=>saveRow('learning_materials',{status:'hidden'},{id:r.id}))}>Hide</button>}{r.status==='hidden'&&releases.length>0&&<button className="lms-text-button" disabled={busy} onClick={()=>void action(()=>saveRow('learning_materials',{status:'published'},{id:r.id}))}>Restore</button>}</div></article>;})}{!rows.length&&<p className="lms-panel">No materials found. Add a Drive link or upload a file to start.</p>}</div> : <div className={module==='batches'?'lms-batch-grid':'lms-records'}>{rows.map(r=>module==='batches'?<article className="lms-batch-card" key={r.id}><div className="lms-batch-card-top"><span className="lms-group-icon"><Users size={20}/></span><span className={`lms-pill ${batchState(r)==='active'?'is-active':'is-muted'}`}>{batchState(r)}</span></div><h2>{r.name}</h2><p className="lms-batch-code">{r.code} · {r.course_name||'Course details needed'}</p><div className="lms-date-band"><CalendarDays size={18}/><span>{r.start_date?batchDateLabel(r.start_date):'Start not set'} <b>→</b> {r.end_date?batchDateLabel(r.end_date):'End date needed'}</span></div><p className="lms-batch-count">{batchSummary(r)}</p><div className="lms-row-actions"><button className="studio-primary" onClick={()=>{setSelected(r);setComposer(null);}}>Manage batch</button><button className="studio-secondary" onClick={()=>edit(r)}>Edit dates</button></div></article>:<article className="lms-record" key={r.id}>
        <div><strong>{module==='mocks'?`${name('students',(data.mock_interview_bookings??[]).find(b=>b.slot_id===r.id)?.student_id)} · ${displayDate(r.starts_at)}`:r.full_name??r.name??r.title}</strong><p>{module==='mocks'?`Ends ${displayDate(r.ends_at)}`:r.email??r.code??r.description??name('batches',r.batch_id)}</p><p>{module==='mocks'?(data.mock_interview_bookings??[]).find(b=>b.slot_id===r.id)?.status: r.status??(r.is_active?'active':'inactive')}</p></div>
        <div className="lms-actions">{module==='team'?<button disabled={busy} className="studio-secondary" onClick={()=>action(()=>saveRow('admin_profiles',{is_active:!r.is_active},{id:r.id}))}>{r.is_active?'Deactivate':'Activate'}</button>:module!=='mocks'&&<button className="studio-secondary" onClick={()=>edit(r)}>Edit</button>}
        {module==='mocks'&&r.status!=='cancelled'&&(data.mock_interview_bookings??[]).some(b=>b.slot_id===r.id&&['requested','approving','booked'].includes(b.status))&&<button className="lms-danger-button" disabled={busy} onClick={()=>void action(()=>lmsApi(`/admin/mocks/slots/${r.id}/cancel`))}>Cancel interview</button>}
        {module==='mocks'&&<button className="studio-secondary" onClick={()=>{setSelected(r);setComposer(null);}}>View details</button>}</div>
      </article>)}{!loading && !rows.length && <p className="lms-panel">{module==='mocks'?'No interview requests yet. Students can request a time from their calendar.':`No ${c.title.toLowerCase()} found.`}</p>}</div>}
      {module==='students'&&!loading&&!studentGroups.length&&<p className="lms-panel">No students found.</p>}
      {module==='team' && <section className="lms-panel"><h2>Pending invitations</h2><p>Share the portal URL with the invited admin. They must use the exact email before expiry.</p>{(data.staff_invitations??[]).filter(r=>r.status==='pending'&&r.role==='admin').map(r=><div className="lms-record" key={r.id}><div><strong>{r.email}</strong><p>Expires {displayDate(r.expires_at)}</p></div><button disabled={busy} className="studio-secondary" onClick={()=>action(()=>saveRow('staff_invitations',{status:'revoked'},{id:r.id}))}>Revoke</button></div>)}</section>}
    </>}
    {selected && <section className="lms-panel lms-detail"><div className="lms-actions"><h2>{module==='students'&&!selected.profile_completed_at?'Profile pending':selected.full_name??selected.name??selected.title??'Interview bookings'}</h2><button className="studio-secondary" onClick={()=>setSelected(null)}>Close details</button></div>
      {module==='students' && (()=>{const student=find('students',selected.id)??selected;return <section className="lms-student-profile"><h3>Student profile</h3><dl><div><dt>Email</dt><dd>{student.email}</dd></div><div><dt>Phone</dt><dd>{student.phone||'Not shared'}</dd></div><div><dt>Address</dt><dd>{student.address||'Not shared'}</dd></div><div><dt>About</dt><dd>{student.profile_type==='student'?'Student':student.profile_type==='working'?'Professional':'Not shared'}</dd></div>{student.profile_type==='student'&&<><div><dt>College</dt><dd>{student.college_name||'Not shared'}</dd></div><div><dt>Branch / field of study</dt><dd>{student.department||'Not shared'}</dd></div><div><dt>College location</dt><dd>{student.college_location||'Not shared'}</dd></div></>}{student.profile_type==='working'&&<><div><dt>Company</dt><dd>{student.office_name||'Not shared'}</dd></div><div><dt>Position</dt><dd>{student.job_title||'Not shared'}</dd></div><div><dt>Company location</dt><dd>{student.office_location||'Not shared'}</dd></div></>}<div><dt>Profile</dt><dd>{student.profile_completed_at?'Submitted':'Not submitted yet'}</dd></div></dl></section>})()}
      {(module==='students'||module==='batches') && <><h2>Batch enrollments</h2><button className="studio-primary" onClick={()=>enrollment(undefined,module==='students'?selected.id:undefined,module==='batches'?selected.id:undefined)}>{module==='students'?'Assign / change batch':'Assign student'}</button>
        {(data.batch_students??[]).filter(r=>module==='students'?r.student_id===selected.id:r.batch_id===selected.id).map(r=><div className="lms-record" key={`${r.batch_id}-${r.student_id}`}><div><strong>{name(module==='students'?'batches':'students',module==='students'?r.batch_id:r.student_id)}</strong><p>{r.status}{r.left_at?' · left batch':''} · {displayDate(r.starts_at)} → {accessEnd(r.batch_id)}</p></div><div className="lms-actions"><button className="studio-secondary" onClick={()=>enrollment(r,module==='students'?selected.id:undefined,module==='batches'?selected.id:undefined)}>Edit access</button><button disabled={busy} className="studio-secondary" onClick={()=>action(()=>saveRow('batch_students',{status:'revoked',left_at:new Date().toISOString()},{batch_id:r.batch_id,student_id:r.student_id}))}>Remove access</button></div></div>)}</>}
      {(module==='batches'||module==='materials') && <><h2>{materialPage?'Batch release windows':'Material release windows'}</h2><button className="studio-primary" onClick={()=>materialPage?publishMaterial(find('learning_materials',selected.id)??selected):materialAssignment(undefined,selected.id)}> {materialPage?'Publish to another batch':'Assign material'}</button>{(data.batch_materials??[]).filter(r=>module==='batches'?r.batch_id===selected.id:r.material_id===selected.id).map(r=><div className="lms-record" key={`${r.batch_id}-${r.material_id}`}><p>{name(module==='batches'?'learning_materials':'batches',module==='batches'?r.material_id:r.batch_id)} · {displayDate(r.available_from)} → {displayDate(r.expires_at)}</p><div className="lms-actions"><button className="studio-secondary" onClick={()=>materialAssignment(r,module==='batches'?selected.id:undefined,module==='materials'?selected.id:undefined)}>Edit window</button><button disabled={busy} className="studio-secondary" onClick={()=>action(()=>removeAssignment('batch_materials',{batch_id:r.batch_id,material_id:r.material_id}))}>Unpublish for batch</button></div></div>)}{materialPage&&!(data.batch_materials??[]).some(r=>r.material_id===selected.id)&&<p>This material is not available to any batch yet.</p>}</>}
      {module==='mocks' && <><h2>Requests and feedback</h2>{(data.mock_interview_bookings??[]).filter(r=>r.slot_id===selected.id).map(r=><div className="lms-record" key={r.id}><div><strong>{name('students',r.student_id)}</strong><p>{r.status} · score {r.score??'not set'}</p><p>{r.feedback}</p>{r.status==='booked'&&r.meeting_url&&<p><a href={r.meeting_url} target="_blank" rel="noopener noreferrer">Open Google Meet</a></p>}</div>{['booked','completed','no_show'].includes(r.status)&&<button className="studio-secondary" onClick={()=>setComposer({title:'Interview outcome and feedback',table:'mock_interview_bookings',fields:[status('booked','completed','no_show'),field('score','Score (0–100)','number'),field('feedback','Student-visible feedback','textarea'),field('internal_notes','Internal admin notes','textarea')],initial:r,keys:{id:r.id}})}>Update outcome</button>}</div>)}{!(data.mock_interview_bookings??[]).some(r=>r.slot_id===selected.id)&&<p>No requests yet.</p>}</>}
    </section>}
  </div>;
}
