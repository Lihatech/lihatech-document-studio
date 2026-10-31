import type { Row } from './lms';

export const interviewDay = (value:string) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date(value));
export function interviewLabel(row:Row,now=Date.now()):string {
  if(row.status==='booked'&&Date.parse(row.ends_at)<now)return 'Past — completion unrecorded';
  return ({requested:'Awaiting review',approving:'Creating meeting',booked:'Confirmed',completed:'Completed',no_show:'Missed',rejected:'Declined',cancelled:'Cancelled'} as Record<string,string>)[row.status]??row.status;
}
export function interviewRoster(students:Row[],members:Row[],batch:string,student='all'):Row[] {
  return students.filter(row=>(student==='all'||row.id===student)&&(batch==='all'||members.some(link=>link.student_id===row.id&&link.batch_id===batch&&!link.left_at&&link.status!=='revoked')));
}
export function interviewSummary(roster:Row[],records:Row[],now=Date.now()) {
  const ids=new Set(roster.map(row=>row.id)),rows=records.filter(row=>ids.has(row.student_id));
  const completed=new Set(rows.filter(row=>row.status==='completed').map(row=>row.student_id));
  const pending=new Set(rows.filter(row=>['requested','approving'].includes(row.status)||(row.status==='booked'&&Date.parse(row.ends_at)>=now)).map(row=>row.student_id));
  const recorded=new Set(rows.map(row=>row.student_id));
  const unrecorded=new Set(rows.filter(row=>row.status==='booked'&&Date.parse(row.ends_at)<now).map(row=>row.student_id));
  const eligible=rows.filter(row=>['booked','completed','no_show'].includes(row.status));
  return {total:roster.length,completed:completed.size,notCompleted:roster.length-completed.size,pending:pending.size,none:roster.filter(row=>!recorded.has(row.id)).length,unrecorded:unrecorded.size,feedbackSent:eligible.filter(row=>!!row.feedback?.trim()).length,feedbackPending:eligible.filter(row=>!row.feedback?.trim()).length};
}
