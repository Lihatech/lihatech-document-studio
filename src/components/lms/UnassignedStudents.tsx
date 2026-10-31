import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import type {Row} from '../../lib/lms';
export default function UnassignedStudents({students,busy,onManage,onDelete,onDeleteAll}:{students:Row[];busy:boolean;onManage:(row:Row)=>void;onDelete:(row:Row)=>void;onDeleteAll:()=>void}){
  const [query,setQuery]=useState('');
  if(!students.length)return null;
  const shown=students.filter(row=>`${row.full_name} ${row.email} ${row.student_code}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="lms-panel unassigned-students"><details><summary><span><strong>Students without batch access</strong><small>{students.length} students · Expand to manage</small></span><ChevronDown size={20}/></summary><div className="lms-toolbar"><label>Find students<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, email or student ID"/></label><button type="button" className="lms-danger-button" disabled={busy} onClick={onDeleteAll}>Delete all {students.length} unassigned students</button></div><div className="unassigned-student-list">{shown.map(row=><article className="lms-record" key={row.id}><div><strong>{row.profile_completed_at?row.full_name:row.email}</strong><p>{row.student_code} · {row.status==='suspended'?'Access blocked':row.status}</p></div><div className="lms-row-actions"><button type="button" className="studio-secondary" disabled={busy} onClick={()=>onManage(row)}>Manage student</button><button type="button" className="lms-danger-button" disabled={busy} onClick={()=>onDelete(row)}>Delete</button></div></article>)}</div>{!shown.length&&<p>No students match your search.</p>}</details></section>;
}
