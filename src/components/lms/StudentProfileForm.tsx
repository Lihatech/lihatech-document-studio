import { useState, type FormEvent } from 'react';
import { type Row } from '../../lib/lms';

const profileFields = ['full_name', 'phone', 'address', 'profile_type', 'college_name', 'department', 'college_location', 'office_name', 'job_title', 'office_location'] as const;
export type StudentProfileValues = Record<(typeof profileFields)[number], string>;

export default function StudentProfileForm({ student, firstLogin, busy, onSave, onCancel }: {
  student: Row; firstLogin: boolean; busy: boolean;
  onSave: (values: StudentProfileValues) => Promise<void>; onCancel?: () => void;
}) {
  const [values, setValues] = useState<StudentProfileValues>(() => Object.fromEntries(
    profileFields.map(key => [key, firstLogin && key === 'full_name' ? '' : student[key] ?? '']),
  ) as StudentProfileValues);
  const change = (key: keyof StudentProfileValues, value: string) => setValues(current => ({ ...current, [key]: value }));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(values);
  }

  return <form className="panel student-profile-form" onSubmit={submit}>
    <div className="student-profile-form-head"><span>{firstLogin ? 'FIRST SIGN-IN' : 'MY DETAILS'}</span><h2>{firstLogin ? 'Tell us a little about you' : 'Edit your profile'}</h2><p>Enter your name to complete your profile. Everything else is optional; share only what you are comfortable sharing. LihaTech admins can see these details to support you.</p></div>
    <div className="student-profile-fields">
      <label>Full name <strong>Required</strong><input autoComplete="name" required maxLength={120} value={values.full_name} onChange={event => change('full_name', event.target.value)}/></label>
      <label>Phone number <span>Optional</span><input autoComplete="tel" type="tel" maxLength={40} value={values.phone} onChange={event => change('phone', event.target.value)}/></label>
      <label className="wide">Address <span>Optional</span><textarea autoComplete="street-address" rows={2} maxLength={500} value={values.address} onChange={event => change('address', event.target.value)}/></label>
      <label>What best describes you? <span>Optional</span><select value={values.profile_type} onChange={event => change('profile_type', event.target.value)}><option value="">Prefer not to say</option><option value="student">Student</option><option value="working">Professional</option></select></label>
      {values.profile_type === 'student' && <><label>College or institution <span>Optional</span><input maxLength={160} value={values.college_name} onChange={event => change('college_name', event.target.value)}/></label><label>Branch / field of study <span>Optional</span><input maxLength={160} value={values.department} onChange={event => change('department', event.target.value)}/></label><label>College location <span>Optional</span><input maxLength={160} value={values.college_location} onChange={event => change('college_location', event.target.value)}/></label></>}
      {values.profile_type === 'working' && <><label>Company name <span>Optional</span><input maxLength={160} value={values.office_name} onChange={event => change('office_name', event.target.value)}/></label><label>Position / job title <span>Optional</span><input maxLength={120} value={values.job_title} onChange={event => change('job_title', event.target.value)}/></label><label>Company location <span>Optional</span><input maxLength={160} value={values.office_location} onChange={event => change('office_location', event.target.value)}/></label></>}
    </div>
    <div className="student-profile-form-actions"><button className="primary-button" disabled={busy} type="submit">{busy ? 'Saving…' : firstLogin ? 'Save and continue' : 'Save changes'}</button>{onCancel && <button className="outline-button" disabled={busy} type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}
