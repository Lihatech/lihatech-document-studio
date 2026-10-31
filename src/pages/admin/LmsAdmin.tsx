import AdminMockCalendar from '../../components/lms/AdminMockCalendar';
import React, { useEffect, useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { saveAs } from 'file-saver';
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, Layers3, Plus, Users, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import BatchDetails from '../../components/lms/BatchDetails';
import UnassignedStudents from '../../components/lms/UnassignedStudents';
import DeleteBatchDialog from '../../components/lms/DeleteBatchDialog';
import LmsTrash from '../../components/lms/LmsTrash';
import '../../styles/lmsTrash.css';
import MaterialsManager, { PublishMaterialsDialog } from '../../components/lms/MaterialsManager';
import RecordForm, { type Field } from '../../components/lms/RecordForm';
import { confirmAction } from '../../lib/dialogs';
import { batchDateLabel, displayDate, listRows, lmsApi, lmsTables, rpc, saveRow, removeAssignment, type Row } from '../../lib/lms';
import { assignableBatch, batchState } from '../../lib/batches';
import '../../styles/lms.css';

const field=(key:string,label:string,type?:Field['type'],required=false):Field=>({key,label,type,required});
const accessField:Field={key:'access',label:'Batch access',options:[{value:'active',label:'Active'},{value:'suspended',label:'Paused'},{value:'revoked',label:'Remove access'}]};
type Composer={title:string;kind:'batch'|'student'|'assignment'|'release'|'team';fields:Field[];initial?:Row;record?:Row};
const failure=(error:unknown)=>error instanceof Error?error.message:'Could not save. Please try again.';

export default function LmsAdmin({module:requestedModule='overview',navigate}:{module?:string;navigate:(path:string)=>void;certificateCategories?:string[]}){
  const module=requestedModule==='students'?'batches':requestedModule;
  const [data,setData]=useState<Record<string,Row[]>>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
  const [batchId,setBatchId]=useState<string|null>(null),[composer,setComposer]=useState<Composer|null>(null);
  const [importing,setImporting]=useState(false),[importBatch,setImportBatch]=useState(''),[importRows,setImportRows]=useState<Row[]>([]),[importError,setImportError]=useState('');
  const [sharing,setSharing]=useState<{materials:string[];batches:string[]}|null>(null),[interview,setInterview]=useState<Row|null>(null);
  const [feedbackStudent,setFeedbackStudent]=useState<Row|null>(null),[feedbackText,setFeedbackText]=useState(''),[feedbackError,setFeedbackError]=useState('');
  function openFeedback(row:Row){setFeedbackStudent(row);setFeedbackText(row.feedback||'');setFeedbackError('');}
  async function sendFeedback(event:React.FormEvent){
    event.preventDefault();if(busy||!feedbackStudent)return;
    setBusy(true);setFeedbackError('');
    try{await rpc('lms_admin_send_interview_feedback',{p_booking:feedbackStudent.id,p_feedback:feedbackText.trim()});setFeedbackStudent(null);setNotice('Feedback sent to student.');await reload();}
    catch(e){setFeedbackError(failure(e));}finally{setBusy(false);}
  }
  const [trashOpen,setTrashOpen]=useState(false),[trashUndo,setTrashUndo]=useState(false),[deletingBatch,setDeletingBatch]=useState<Row|null>(null),[batchDeleteError,setBatchDeleteError]=useState('');
  const [calendar,setCalendar]=useState<{configured:boolean;interviewer_email:string}|null>(null);
  async function reload(){setLoading(true);setError('');try{const entries=await Promise.all(lmsTables.map(async table=>[table,await listRows(table)]));setData(Object.fromEntries(entries));}catch(e){setError(failure(e));}finally{setLoading(false);}}
  useEffect(()=>{void reload();const openNotification=()=>void reload();window.addEventListener('lihatech-notification-open',openNotification);return()=>window.removeEventListener('lihatech-notification-open',openNotification);},[]);
  useEffect(()=>{setBatchId(null);setComposer(null);setQuery('');setError('');setNotice('');if(module==='mocks')void lmsApi<{configured:boolean;interviewer_email:string}>('/admin/mocks/calendar','GET').then(setCalendar).catch(e=>setError(failure(e)));},[module]);
  const batches=data.batches??[],students=data.students??[],members=data.batch_students??[];
  const batch=batches.find(row=>row.id===batchId);
  const available=batches.filter(assignableBatch);
  const studentName=(student?:Row)=>student?.profile_completed_at?student.full_name:student?.email||'Student';
  const batchChoice=(current?:string):Field=>({key:'batch_id',label:'Batch',required:true,options:[{value:'',label:'Choose a batch'},...batches.filter(row=>assignableBatch(row)||row.id===current).map(row=>({value:row.id,label:`${row.name} · ${row.code} · ${batchDateLabel(row.start_date)} – ${batchDateLabel(row.end_date)}`}))]});
  async function action(fn:()=>Promise<unknown>,message='Changes saved.'){setBusy(true);setError('');try{await fn();setNotice(message);await reload();}catch(e){setError(failure(e));}finally{setBusy(false);}}
  function editBatch(row?:Row){
    setComposer({kind:'batch',title:row?'Edit batch':'Create batch',record:row,initial:row??{start_date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})},fields:[field('name','Batch name',undefined,true),field('code','Batch code',undefined,true),field('course_name','Course / programme name',undefined,true),field('start_date','Batch start date','date',true),field('end_date','Batch end date','date',true)]});
  }
  function editStudent(student?:Row,targetBatch?:string){
    if(!student&&!available.length){setError('Create an upcoming or active batch before adding students.');return;}
    const membership=members.find(row=>row.student_id===student?.id&&!row.left_at&&row.status!=='revoked')??members.find(row=>row.student_id===student?.id);
    setComposer({kind:'student',title:student?'Manage student':'Add student',record:student,initial:{email:student?.email||'',batch_id:targetBatch??membership?.batch_id??'',access:student&&student.status!=='active'?'suspended':membership?.left_at?'revoked':membership?.status??'active'},fields:[field('email','Registered Google email','email',true),batchChoice(membership?.batch_id),...(student?[accessField]:[])]});
  }
  function assignStudent(row?:Row){
    if(row){editStudent(students.find(student=>student.id===row.student_id),row.batch_id);return;}
    setComposer({kind:'assignment',title:'Assign existing student',initial:{batch_id:batchId,access:'active'},fields:[{key:'student_id',label:'Student',required:true,options:[{value:'',label:'Choose a student'},...students.map(student=>({value:student.id,label:`${studentName(student)} · ${student.student_code||''}`}))]},batchChoice(batchId??undefined)]});
  }
  async function removeAccess(row:Row){
    if(!await confirmAction('Remove this student’s batch access? Their account, profile and history will be kept.','Remove access'))return;
    await action(()=>saveRow('batch_students',{status:'revoked',left_at:new Date().toISOString()},{batch_id:row.batch_id,student_id:row.student_id}));
  }
  async function deleteStudent(student:Row){
    if(busy||!await confirmAction(`Move ${studentName(student)} to Trash? Access is blocked immediately. You can restore this student within 5 days.`,'Move to Trash'))return;
    await action(async()=>{await rpc('lms_admin_trash_students',{p_students:[student.id]});setTrashUndo(true);},'Student moved to Trash. Restore within 5 days.');
  }
  function deleteBatch(row:Row){setBatchDeleteError('');setDeletingBatch(row);}
  async function confirmBatchDelete(withStudents:boolean){
    if(!deletingBatch||busy)return;setBusy(true);setBatchDeleteError('');
    try{await rpc('lms_admin_trash_batch',{p_batch:deletingBatch.id,p_delete_students:withStudents});setBatchId(null);setDeletingBatch(null);setTrashUndo(true);setNotice('Batch moved to Trash. Restore within 5 days.');await reload();}
    catch(e){setBatchDeleteError(failure(e));}finally{setBusy(false);}
  }
  async function deleteAllUnassigned(){
    if(busy||!unassigned.length||!await confirmAction(`Move all ${unassigned.length} students without batch access to Trash? Their access is blocked immediately. You can restore them within 5 days.`,'Move all to Trash'))return;
    await action(async()=>{await rpc('lms_admin_trash_students',{p_students:unassigned.map(row=>row.id),p_only_unassigned:true});setTrashUndo(true);},'Unassigned students moved to Trash. Restore within 5 days.');
  }
  async function save(values:Row){
    if(!composer)return;
    if(composer.kind==='batch'){
      if(values.end_date<values.start_date)throw new Error('End date must be on or after the start date.');
      await saveRow('batches',{...values,status:'active',...(!composer.record?{certificate_type:'Course Completion'}:{})},composer.record?{id:composer.record.id}:undefined);
    }else if(composer.kind==='student'){
      if(composer.record)await rpc('lms_admin_save_student',{p_id:composer.record.id,p_email:values.email,p_batch:values.batch_id,p_access:values.access});
      else await rpc('lms_create_student_in_batch',{p_email:values.email,p_batch:values.batch_id});
    }else if(composer.kind==='assignment')await rpc('lms_assign_student_to_batch',{p_student:values.student_id,p_batch:values.batch_id,p_status:'active'});
    else if(composer.kind==='release'){if(values.expires_at&&new Date(values.expires_at)<=new Date(values.available_from))throw new Error('Expiry must be after the release time.');await saveRow('batch_materials',values,{batch_id:composer.record!.batch_id,material_id:composer.record!.material_id});}
    else if(composer.kind==='team')await rpc('lms_invite_admin',{p_name:values.full_name,p_email:values.email});
    setComposer(null);setNotice('Changes saved.');await reload();
  }
  function template(excel=false){
    if(excel){const book=utils.book_new();utils.book_append_sheet(book,utils.json_to_sheet([{email:'student1@example.com'},{email:'student2@example.com'}]),'Students');writeFile(book,'student-import-template.xlsx');}
    else saveAs(new Blob(['email\nstudent1@example.com\nstudent2@example.com\n'],{type:'text/csv;charset=utf-8'}),'student-import-template.csv');
  }
  async function readImport(file:File){
    setImportError('');setImportRows([]);
    try{if(file.size>4*1024*1024)throw new Error('Use an import file up to 4 MB.');const workbook=read(await file.arrayBuffer());const raw=utils.sheet_to_json<Row>(workbook.Sheets[workbook.SheetNames[0]],{defval:''});
      const rows=raw.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.trim().toLowerCase(),String(value).trim().toLowerCase()])));
      if(!rows.length||rows.length>1000)throw new Error('Import between 1 and 1,000 students at a time.');
      const bad=rows.findIndex(row=>!row.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));if(bad>=0)throw new Error(`Row ${bad+2} needs a valid email in the email column.`);
      if(new Set(rows.map(row=>row.email)).size!==rows.length)throw new Error('The file has duplicate email addresses. Remove duplicates and upload it again.');
      setImportRows(rows.map(row=>({email:row.email})));
    }catch(e){setImportError(failure(e));}
  }
  async function submitImport(event:React.FormEvent){event.preventDefault();setBusy(true);setImportError('');try{if(!importRows.length||!importBatch)throw new Error('Choose a batch and an import file.');await rpc('lms_import_students_to_batch',{p_rows:importRows,p_batch:importBatch});setImporting(false);setNotice(`${importRows.length} student rows processed. Existing students were merged into this batch and new students received IDs.`);await reload();}catch(e){setImportError(failure(e));}finally{setBusy(false);}}
  const matchingBatches=batches.filter(row=>`${row.name} ${row.code} ${row.course_name} ${members.filter(link=>link.batch_id===row.id).map(link=>{const student=students.find(student=>student.id===link.student_id);return `${studentName(student)} ${student?.email} ${student?.student_code}`;}).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const matchingStudents=students.filter(student=>`${student.full_name||''} ${student.email} ${student.student_code||''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const unassigned=students.filter(student=>!members.some(link=>link.student_id===student.id&&!link.left_at&&link.status!=='revoked'));
  const bookings=data.mock_interview_bookings??[],slots=data.mock_interview_slots??[];
  const slotFor=(booking:Row)=>slots.find(slot=>slot.id===booking.slot_id);
  const title=module==='batches'?'Batches & students':module==='materials'?'Learning materials':module==='mocks'?'Mock interviews':module==='team'?'Admin access':'Learning operations';
  return <div className="lms-workspace">
    <header className="lms-page-head"><div>{module!=='overview'&&<button className="lms-back" onClick={()=>navigate('/')}><ArrowLeft size={16}/> Learning overview</button>}<p className="lms-eyebrow">LIHATECH LEARN</p><h1>{title}</h1><p>{module==='batches'?'Open a batch to manage its students, access and documents.':module==='materials'?'Upload once and publish documents to any number of batches.':module==='mocks'?'Review requests and manage confirmed interviews.':'Manage learning and student access.'}</p></div>{module==='batches'&&<button type="button" className="studio-secondary lms-trash-open" onClick={()=>setTrashOpen(true)}><Trash2 size={17}/> Trash</button>}</header>
    {error&&<p role="alert" className="lms-error">{error} <button className="studio-secondary" onClick={()=>void reload()}>Retry</button></p>}{notice&&<p role="status" className="lms-status">{notice}{trashUndo&&<button type="button" className="lms-trash-undo" onClick={()=>setTrashOpen(true)}>Open Trash / Undo</button>}</p>}
    {loading&&!Object.keys(data).length&&<p role="status">Loading records…</p>}
    {module==='overview'&&<><section className="lms-overview-strip"><div><span>STUDENTS</span><strong>{students.length}</strong><small>registered learners</small></div><div><span>BATCHES</span><strong>{batches.filter(row=>batchState(row)==='active').length}</strong><small>in progress</small></div><div><span>DOCUMENTS</span><strong>{data.learning_materials?.length??0}</strong><small>uploaded resources</small></div><div><span>INTERVIEWS</span><strong>{bookings.filter(row=>row.status==='requested').length}</strong><small>awaiting review</small></div></section><section className="lms-workflow">{[{path:'/batches',title:'Batches & students',detail:'Create batches and register students.',icon:Users},{path:'/materials',title:'Learning materials',detail:'Upload documents and share across batches.',icon:BookOpen},{path:'/mock-interviews',title:'Mock interviews',detail:'Review bookings and arrange interviews.',icon:CalendarDays}].map(({path,title,detail,icon:Icon})=><button className="lms-workflow-card" key={path} onClick={()=>navigate(path)}><span className="lms-group-icon"><Icon size={24}/></span><strong>{title}</strong><span>{detail}</span><ChevronRight size={20}/></button>)}</section><button className="lms-text-button" onClick={()=>navigate('/documents')}>Open Documents <ChevronRight size={16}/></button></>}
    {module==='batches'&&(!batch?<><div className="lms-toolbar"><label>Search students or batches<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Batch, name, email or student ID"/></label><button className="studio-secondary" onClick={()=>void reload()}>Refresh</button><button className="studio-primary" onClick={()=>editBatch()}><Plus size={17}/> Create batch</button></div>{query.trim()&&<section className="lms-panel"><h2>Student search results ({matchingStudents.length})</h2>{matchingStudents.map(student=><div className="lms-record" key={student.id}><div><strong>{studentName(student)}</strong><p>{student.email} · {student.student_code}</p><p>{members.filter(link=>link.student_id===student.id&&!link.left_at&&link.status!=='revoked').map(link=>batches.find(b=>b.id===link.batch_id)?.name).join(', ')||'No current batch'}</p></div><button className="studio-secondary" onClick={()=>editStudent(student)}>Manage student</button></div>)}{!matchingStudents.length&&<p>No students match this name, email or ID.</p>}</section>}<div className="lms-batch-grid">{matchingBatches.map(row=><article className="lms-batch-card" key={row.id}><span className="lms-group-icon"><Layers3 size={22}/></span><h2>{row.name}</h2><p>{row.code} · {row.course_name||'Course setup needed'}</p><div className="lms-date-band"><CalendarDays size={18}/>{batchDateLabel(row.start_date)} → {batchDateLabel(row.end_date)}</div><p>{members.filter(link=>link.batch_id===row.id&&!link.left_at&&link.status!=='revoked').length} students</p><div className="lms-row-actions"><button className="studio-primary" onClick={()=>setBatchId(row.id)}>Manage batch & students</button><button type="button" className="lms-danger-button" disabled={busy} onClick={()=>void deleteBatch(row)}>Delete batch</button></div></article>)}</div>{!loading&&!matchingBatches.length&&<p className="lms-panel">No batches found. Create a batch to begin.</p>}<UnassignedStudents students={unassigned} busy={busy} onManage={row=>editStudent(row)} onDelete={row=>void deleteStudent(row)} onDeleteAll={()=>void deleteAllUnassigned()}/></>:<BatchDetails key={batch.id} batch={batch} data={data} busy={busy} onClose={()=>setBatchId(null)} onEdit={()=>editBatch(batch)} onDelete={()=>void deleteBatch(batch)} onEnrollment={assignStudent} onAddStudent={()=>editStudent(undefined,batch.id)} onImport={()=>{setImportBatch(batch.id);setImportRows([]);setImportError('');setImporting(true);}} onEditStudent={student=>editStudent(student)} onDeleteStudent={student=>void deleteStudent(student)} onRemoveStudent={row=>void removeAccess(row)} onMaterial={row=>row?setComposer({kind:'release',title:'Edit release window',record:row,initial:row,fields:[field('available_from','Available from','datetime-local',true),field('expires_at','Expiry (optional)','datetime-local')]}):setSharing({materials:[],batches:[batch.id]})} onRemoveMaterial={async row=>{if(await confirmAction('Unpublish this document for this batch?','Unpublish'))void action(()=>removeAssignment('batch_materials',{batch_id:row.batch_id,material_id:row.material_id}));}}/>)}
    {module==='materials'&&<MaterialsManager data={data} reload={reload}/>}
    {module==='mocks'&&<><AdminMockCalendar batches={batches} members={members} onFeedback={openFeedback} bookings={bookings} slots={slots} students={students} busy={busy} configured={!!calendar?.configured} actionError={error} onRefresh={reload} onDetails={setInterview} onApprove={row=>void action(()=>lmsApi(`/admin/mocks/${row.id}/approve`))} onDecline={async row=>{if(await confirmAction('Decline this interview request?','Decline request'))void action(()=>lmsApi(`/admin/mocks/${row.id}/reject`));}} onApproveReschedule={row=>void action(()=>lmsApi(`/admin/mocks/${row.id}/reschedule/approve`))} onDeclineReschedule={async row=>{if(await confirmAction('Decline this reschedule? The current interview will remain scheduled.','Decline reschedule'))void action(()=>lmsApi(`/admin/mocks/${row.id}/reschedule/reject`));}} onCancel={async row=>{if(await confirmAction('Cancel this interview and its calendar invitation?','Cancel interview'))void action(()=>lmsApi(`/admin/mocks/slots/${row.slot_id}/cancel`));}} onReschedule={(row,startsAt)=>void action(()=>lmsApi(`/admin/mocks/${row.id}/reschedule`,'POST',{starts_at:startsAt,prepared_topics:row.prepared_topics||''}),'New interview time requested.')}/></>}
    {module==='team'&&<><button className="studio-primary" onClick={()=>setComposer({kind:'team',title:'Invite admin',fields:[field('full_name','Full name',undefined,true),field('email','LihaTech Google email','email',true)]})}>Invite admin</button>{data.admin_profiles?.map(row=><div className="lms-record lms-panel" key={row.id}><div><strong>{row.full_name}</strong><p>{row.email}</p></div><button className="studio-secondary" onClick={()=>void action(()=>saveRow('admin_profiles',{is_active:!row.is_active},{id:row.id}))}>{row.is_active?'Deactivate':'Activate'}</button></div>)}<section className="lms-panel"><h2>Pending invitations</h2>{data.staff_invitations?.filter(row=>row.status==='pending'&&row.role==='admin').map(row=><div className="lms-record" key={row.id}><span>{row.email}</span><button className="lms-danger-button" onClick={async()=>{if(await confirmAction('Cancel this admin invitation?','Cancel invitation'))void action(()=>saveRow('staff_invitations',{status:'revoked'},{id:row.id}));}}>Cancel invitation</button></div>)}</section></>}
    {trashOpen&&<LmsTrash onClose={()=>setTrashOpen(false)} onRestored={async()=>{setTrashUndo(false);await reload();}}/>}
    {deletingBatch&&<DeleteBatchDialog batch={deletingBatch} eligible={students.filter(student=>members.some(link=>link.student_id===student.id&&link.batch_id===deletingBatch.id&&!link.left_at&&link.status!=='revoked')&&!members.some(link=>link.student_id===student.id&&link.batch_id!==deletingBatch.id&&!link.left_at&&link.status!=='revoked')).length} shared={students.filter(student=>members.some(link=>link.student_id===student.id&&link.batch_id===deletingBatch.id&&!link.left_at&&link.status!=='revoked')&&members.some(link=>link.student_id===student.id&&link.batch_id!==deletingBatch.id&&!link.left_at&&link.status!=='revoked')).length} busy={busy} error={batchDeleteError} onClose={()=>setDeletingBatch(null)} onDelete={withStudents=>void confirmBatchDelete(withStudents)}/>}
    {composer&&<Modal title={composer.title} busy={busy} wide onClose={()=>setComposer(null)}><RecordForm title={composer.title} fields={composer.fields} initial={composer.initial} onSave={save} onBusyChange={setBusy} onCancel={()=>setComposer(null)} note={values=>composer.kind==='student'?<p className="lms-access-note">{composer.record?.student_code&&<strong>Student ID: {composer.record.student_code}. </strong>}Students complete their own profile after sign-in. Batch dates: {batchDateLabel(batches.find(row=>row.id===values.batch_id)?.start_date)} – {batchDateLabel(batches.find(row=>row.id===values.batch_id)?.end_date)}. Removing access keeps their account and history.</p>:composer.kind==='batch'?<p className="lms-access-note">Access opens and closes automatically using these dates. New students receive a student ID automatically.</p>:null}/></Modal>}
    {importing&&<Modal title="Import students" busy={busy} onClose={()=>setImporting(false)}><form className="lms-form" onSubmit={submitImport}><p>Use one column named <strong>email</strong>, with one Google email per row. Replace the sample addresses in the template. Each student receives an ID and completes their profile at first sign-in.</p><div className="lms-actions"><button type="button" className="studio-secondary" onClick={()=>template()}>Download CSV template</button><button type="button" className="studio-secondary" onClick={()=>template(true)}>Download Excel template</button></div><label>Batch<select required value={importBatch} onChange={e=>setImportBatch(e.target.value)}><option value="">Choose a batch</option>{available.map(row=><option key={row.id} value={row.id}>{row.name} · {row.code}</option>)}</select></label><label>CSV or Excel file<input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={e=>{if(e.target.files?.[0])void readImport(e.target.files[0]);}}/></label>{importRows.length>0&&<p>{importRows.length} students ready to import: {importRows.slice(0,3).map(row=>row.email).join(', ')}{importRows.length>3?'…':''}</p>}{importError&&<p className="lms-error" role="alert">{importError}</p>}<div className="lms-actions"><button className="studio-primary" disabled={busy||!importRows.length}>{busy?'Importing…':'Import students'}</button><button type="button" className="studio-secondary" disabled={busy} onClick={()=>setImporting(false)}>Cancel</button></div></form></Modal>}
    {sharing&&<PublishMaterialsDialog data={data} materialIds={sharing.materials} batchIds={sharing.batches} onClose={()=>setSharing(null)} onDone={async()=>{setSharing(null);await reload();}}/>}
    {interview&&<Modal title="Interview details" onClose={()=>setInterview(null)}><p>{studentName(students.find(student=>student.id===interview.student_id))} · {displayDate(slotFor(interview)?.starts_at)}</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><strong>Topics prepared</strong><br/>{interview.prepared_topics||'Not provided (older request).'}</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{interview.feedback||'No feedback yet.'}</p>{interview.status==='booked'&&interview.meeting_url&&<a href={interview.meeting_url} target="_blank" rel="noopener noreferrer">Open Google Meet</a>}</Modal>}
    {feedbackStudent&&<Modal title="Send feedback" busy={busy} onClose={()=>setFeedbackStudent(null)}><form className="lms-form" onSubmit={sendFeedback}><p>{studentName(students.find(student=>student.id===feedbackStudent.student_id))} · {displayDate(slotFor(feedbackStudent)?.starts_at)}</p><label>Feedback<textarea autoFocus required maxLength={5000} rows={6} value={feedbackText} disabled={busy} onChange={event=>setFeedbackText(event.target.value)} placeholder="Write your feedback for the student…"/></label>{feedbackError&&<p className="lms-error" role="alert">{feedbackError}</p>}<div className="lms-actions"><button type="submit" className="studio-primary" disabled={busy||!feedbackText.trim()}>{busy?'Sending…':'Send'}</button></div></form></Modal>}
  </div>;
}
