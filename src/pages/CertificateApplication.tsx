import React, { useState } from 'react';
import { LMS_API_BASE_URL } from '../lib/lmsApi';
import { Award, FileText, Send, CheckCircle2 } from 'lucide-react';
import { StudentIdentityFields } from '../components/lms/StudentProfileForm';
import { documentName, profileValues } from '../lib/studentProfile';
import '../styles/documentRequests.css';
import '../styles/certificateApplications.css';

export default function CertificateApplication() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[studentId,setStudentId]=useState('');
  const [personal,setPersonal]=useState(()=>profileValues({}));
  const [certificateType,setCertificateType]=useState<'Course Completion'|'Internship Completion'>('Course Completion');
  const [startDate,setStartDate]=useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const fields=new FormData(event.currentTarget);
    setBusy(true);setError('');
    try {
      const response=await fetch(`${LMS_API_BASE_URL||'/api'}/public/certificate-applications`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...Object.fromEntries(fields),full_name:documentName(personal),certificate_type:certificateType}),
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof result?.detail==='string'?result.detail:'Could not submit your application. Please try again.');
      setStudentId(result.student_code);
    } catch(e){setError(e instanceof Error?e.message:'Could not submit your application.');}
    finally{setBusy(false);}
  }
  return <main className="certificate-application"><div className="certificate-application-shell">
    <header className="application-brand"><a href="/" aria-label="LihaTech home"><img src="/lihatech-logo-official.png" alt="LihaTech" width="52" height="52"/></a><div><strong>LihaTech</strong><span>Certificate applications</span></div></header>
    <div className="application-heading">
    <p className="application-eyebrow">LIHATECH · CERTIFICATES</p>
    <h1>Apply for your certificate</h1>
    <p>Request a completion certificate and receive your approved PDF by email.</p></div>
    <section className="certificate-application-card panel request-form-panel">
    {studentId?<div role="status"><span className="request-panel-icon"><CheckCircle2 size={24}/></span><h2>Application received</h2><p>Your student ID is <strong>{studentId}</strong>. Save it for future reference.</p><p>Our team will review your completion details and email your certificate PDF to the address you provided after approval.</p><p>Please check your inbox and spam folder for the certificate.</p></div>:<>
      <div className="request-panel-intro"><span className="request-panel-icon"><FileText size={24}/></span><div><h2>Request your document</h2><p>Confirm your title and name, then choose your completion certificate.</p></div></div>
      <div className="request-kind-grid" role="group" aria-label="Document type">
        <button type="button" className={certificateType==='Course Completion'?'selected':''} aria-pressed={certificateType==='Course Completion'} onClick={()=>setCertificateType('Course Completion')}><Award size={23}/><strong>Course completion</strong><small>For the course you completed</small></button>
        <button type="button" className={certificateType==='Internship Completion'?'selected':''} aria-pressed={certificateType==='Internship Completion'} onClick={()=>setCertificateType('Internship Completion')}><FileText size={23}/><strong>Internship completion</strong><small>For your internship domain or role</small></button>
      </div>
      <form onSubmit={submit} className="request-form">
        <section className="request-personal-details"><h3>Name on your certificate</h3><p className="request-help">Check your title and the spelling of your name before sending.</p><div className="application-name-grid"><StudentIdentityFields values={personal} change={(key,value)=>setPersonal(current=>({...current,[key]:value}))}/></div><p className="request-help">Name on document: <strong>{documentName(personal)||'Enter your full name'}</strong></p></section>
        <section className="request-personal-details"><h3>Certificate details</h3>
          <label>Course name <strong>Required</strong><input name="course_name" required maxLength={180} placeholder="Enter the course or programme you completed"/></label>
          {certificateType==='Internship Completion'&&<label>Internship domain / role <strong>Required</strong><input name="designation" required maxLength={120} placeholder="e.g. Web Development or Developer Intern"/><span className="request-help">Admin will check this before approving your internship certificate.</span></label>}
        </section>
        <section className="request-personal-details"><h3>Requested certificate dates</h3><div className="request-date-grid">
          <label>Requested start date<input name="requested_start_date" required type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></label>
          <label>Requested end date<input name="requested_end_date" required type="date" min={startDate}/></label>
        </div><p className="request-help">Enter the dates you would like printed on your certificate. Admin will review and confirm the final dates.</p></section>
        <section className="request-personal-details"><h3>Delivery email</h3><label htmlFor="application-email">Email address</label><input id="application-email" aria-describedby="application-email-help" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/><p className="request-help" id="application-email-help">Your approved certificate PDF will be sent here.</p></section>
        <div className="application-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
        {error&&<p role="alert" className="request-error">{error}</p>}
        <p className="request-help">Your student ID will be generated automatically. No sign-in or batch assignment is needed.</p>
        <button className="primary-button" disabled={busy} type="submit"><Send size={17}/>{busy?'Submitting…':'Submit application'}</button>
      </form>
    </>}
    </section><footer className="application-footer"><a href="/privacy.html">Privacy policy</a><a href="/">Staff / student sign-in</a></footer>
  </div></main>;
}
