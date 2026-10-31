import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interviewDay, interviewLabel, interviewRoster, interviewSummary } from '../src/lib/interviewHistory';
const now=Date.parse('2026-10-31T10:00:00Z');
test('participation counts distinct students and distinguishes unrecorded past bookings',()=>{
  const roster=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
  const records=[
    {student_id:'a',status:'completed',feedback:'Good progress'},
    {student_id:'a',status:'completed',feedback:''},
    {student_id:'a',status:'booked',ends_at:'2026-11-02T10:00:00Z'},
    {student_id:'b',status:'requested',ends_at:'2026-11-01T10:00:00Z'},
    {student_id:'c',status:'booked',ends_at:'2026-10-30T10:00:00Z'},
    {student_id:'outside',status:'completed'},
  ];
  assert.deepEqual(interviewSummary(roster,records,now),{total:4,completed:1,notCompleted:3,pending:2,none:1,unrecorded:1,feedbackSent:1,feedbackPending:3});
});
test('roster respects batch and student selection and ignores revoked assignments',()=>{
  const students=[{id:'a'},{id:'b'},{id:'c'}],members=[
    {student_id:'a',batch_id:'one',status:'active'},
    {student_id:'a',batch_id:'two',status:'active'},
    {student_id:'b',batch_id:'one',status:'revoked'},
    {student_id:'c',batch_id:'one',status:'active',left_at:'2026-10-01'},
  ];
  assert.deepEqual(interviewRoster(students,members,'one'),[{id:'a'}]);
  assert.deepEqual(interviewRoster(students,members,'two','b'),[]);
  assert.equal(interviewRoster(students,members,'all').length,3);
});
test('past confirmed booking is never labelled attended automatically',()=>{
  assert.equal(interviewLabel({status:'booked',ends_at:'2026-10-30T10:00:00Z'},now),'Past — completion unrecorded');
  assert.equal(interviewLabel({status:'completed'},now),'Completed');
});
test('date filtering uses the interview timezone across midnight',()=>{
  assert.equal(interviewDay('2026-10-31T20:00:00Z'),'2026-11-01');
});
