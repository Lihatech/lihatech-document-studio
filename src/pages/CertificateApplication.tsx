import React, { useState } from 'react';
import { LMS_API_BASE_URL } from '../lib/lmsApi';
import '../styles/certificateApplications.css';

export default function CertificateApplication() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[studentId,setStudentId]=useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const fields=new FormData(event.currentTarget);
    setBusy(true);setError('');
    try {
      const response=await fetch(`${LMS_API_BASE_URL||'/api'}/public/certificate-applications`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.fromEntries(fields)),
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof result?.detail==='string'?result.detail:'Could not submit your application. Please try again.');
      setStudentId(result.student_code);
    } catch(e){setError(e instanceof Error?e.message:'Could not submit your application.');}
    finally{setBusy(false);}
  }
  return <main className="certificate-application"><section className="certificate-application-card">
    <a href="/" aria-label="LihaTech home"><img src="/lihatech-logo-official.png" alt="LihaTech" width="72" height="72"/></a>
    <p className="application-eyebrow">LIHATECH · CERTIFICATES</p>
    <h1>Apply for your certificate</h1>
    {studentId?<div role="status"><h2>Application received</h2><p>Your student ID is <strong>{studentId}</strong>. Save it for future reference.</p><p>Our team will review your course completion and email your certificate PDF to the address you provided after approval.</p><p>Please check your inbox and spam folder for the certificate.</p></div>:<>
      <p>Completed a LihaTech course? Enter your details below. Our team will review your application and email your certificate after approval.</p>
      <form onSubmit={submit}>
        <label>Full name<input name="full_name" autoComplete="name" required maxLength={120} placeholder="As it should appear on your certificate"/></label>
        <div><label htmlFor="application-email">Email address</label><input id="application-email" aria-describedby="application-email-help" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/><small id="application-email-help">Your certificate PDF will be sent here.</small></div>
        <label>Course name<input name="course_name" required maxLength={180} placeholder="Enter the course you completed"/></label>
        <div className="application-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
        {error&&<p role="alert" className="application-error">{error}</p>}
        <button disabled={busy} type="submit">{busy?'Submitting…':'Submit application'}</button>
      </form>
      <p className="application-note">Your student ID will be generated automatically. You do not need a student account to apply.</p>
    </>}
    <footer><a href="/privacy.html">Privacy policy</a><a href="/">Staff / student sign-in</a></footer>
  </section></main>;
}
