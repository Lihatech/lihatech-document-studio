"""Public certificate applications, separate from LMS enrollment and accounts."""
import base64
import binascii
import logging
import os
import smtplib
import ssl
from datetime import date, datetime, timezone
from email.message import EmailMessage
from uuid import UUID
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class ApplicationInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    course_name: str = Field(min_length=1, max_length=180)
    certificate_type: Literal['Course Completion', 'Internship Completion'] = 'Course Completion'
    designation: str = Field(default='', max_length=120)
    requested_start_date: date
    requested_end_date: date
    website: str = Field(default='', max_length=200)  # Honeypot; never shown to applicants.

    @field_validator('full_name', 'course_name')
    @classmethod
    def clean_text(cls, value):
        value = ' '.join(value.split())
        if not value:
            raise ValueError('This field is required.')
        return value

    @model_validator(mode='after')
    def check_certificate_details(self):
        if self.requested_end_date < self.requested_start_date:
            raise ValueError('Choose an end date on or after the start date.')
        self.designation = self.designation.strip() if self.certificate_type == 'Internship Completion' else ''
        if self.certificate_type == 'Internship Completion' and not self.designation:
            raise ValueError('Enter your internship domain or role.')
        return self


class ApprovalInput(BaseModel):
    document: dict
    pdf_base64: str = Field(max_length=8_000_000)


class DeclineInput(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


def decode_pdf(value):
    try:
        pdf = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, 'Invalid certificate PDF.') from None
    if not pdf.startswith(b'%PDF-') or len(pdf) > 6_000_000:
        raise HTTPException(422, 'Provide a PDF smaller than 6 MB.')
    return pdf


def send_certificate(row, applicant):
    user = os.getenv('HOSTINGER_SMTP_USER', '').strip()
    password = os.getenv('HOSTINGER_SMTP_PASSWORD', '')
    if not user or not password:
        raise RuntimeError('Configure HOSTINGER_SMTP_USER and HOSTINGER_SMTP_PASSWORD on the server.')
    message = EmailMessage()
    message['From'] = user
    message['To'] = applicant['email']
    message['Subject'] = 'Your LihaTech certificate'
    message.set_content(f"Hello {row['full_name']},\n\nYour certificate for {row['course_name']} is attached.\nStudent ID: {applicant['student_code']}\n\nRegards,\nLihaTech")
    message.add_attachment(decode_pdf(row['pdf_base64']), maintype='application', subtype='pdf', filename='LihaTech-Certificate.pdf')
    with smtplib.SMTP_SSL('smtp.hostinger.com', 465, timeout=30, context=ssl.create_default_context()) as smtp:
        smtp.login(user, password)
        smtp.send_message(message)


def register(app, db, require_manager):
    def get_row(application_id):
        rows = db.table('certificate_applications').select('*').eq('id', str(application_id)).execute().data
        if not rows:
            raise HTTPException(404, 'Application not found.')
        return rows[0]

    def deliver(row):
        if row['email_status'] == 'sending' and (datetime.now(timezone.utc) - datetime.fromisoformat(row['updated_at'].replace('Z', '+00:00'))).total_seconds() > 300:
            db.table('certificate_applications').update({'email_status': 'failed'}).eq('id', row['id']).eq('email_status', 'sending').eq('updated_at', row['updated_at']).execute()
        # Claim delivery atomically so simultaneous admin clicks cannot send twice.
        claimed = db.table('certificate_applications').update({'email_status': 'sending', 'updated_at': datetime.now(timezone.utc).isoformat()}).eq('id', row['id']).in_('email_status', ['not_sent', 'failed']).execute().data
        if not claimed:
            raise HTTPException(409, 'Email has already been sent or is being sent. Refresh the applications.')
        applicant = db.table('certificate_applicants').select('*').eq('id', row['applicant_id']).single().execute().data
        try:
            send_certificate(row, applicant)
        except Exception:
            logging.getLogger(__name__).exception('Certificate email failed for application %s', row['id'])
            db.table('certificate_applications').update({'email_status': 'failed'}).eq('id', row['id']).execute()
            return {'approved': True, 'email_sent': False}
        db.table('certificate_applications').update({'email_status': 'sent', 'email_sent_at': datetime.now(timezone.utc).isoformat()}).eq('id', row['id']).execute()
        return {'approved': True, 'email_sent': True}

    @app.post('/api/public/certificate-applications', status_code=201)
    def submit(body: ApplicationInput):
        if body.website:
            raise HTTPException(422, 'Could not submit this application.')
        try:
            return db.rpc('submit_public_certificate_application_details', {
                'p_name': body.full_name, 'p_email': str(body.email).lower(), 'p_course': body.course_name,
                'p_type': body.certificate_type, 'p_domain': body.designation,
                'p_start': body.requested_start_date.isoformat(), 'p_end': body.requested_end_date.isoformat(),
            }).execute().data
        except Exception as error:
            if getattr(error, 'code', '') == 'P0001':
                raise HTTPException(409, getattr(error, 'message', 'Application already exists.')) from None
            logging.getLogger(__name__).exception('Certificate application submission failed')
            raise HTTPException(503, 'Applications are temporarily unavailable. Please try again later.') from None

    @app.get('/api/admin/certificate-applications')
    def listing(_admin=Depends(require_manager)):
        return db.table('certificate_applications').select('id,full_name,course_name,certificate_type,designation,requested_start_date,requested_end_date,status,admin_note,document,email_status,email_sent_at,created_at,updated_at,certificate_applicants(email,student_code)').order('created_at', desc=True).execute().data

    @app.post('/api/admin/certificate-applications/{application_id}/approve')
    def approve(application_id: UUID, body: ApprovalInput, _admin=Depends(require_manager)):
        decode_pdf(body.pdf_base64)
        row = get_row(application_id)
        if row['status'] != 'pending':
            raise HTTPException(409, 'This application has already been reviewed.')
        if not str(body.document.get('certificateId', '')).strip():
            raise HTTPException(422, 'A certificate number is required.')
        updated = db.table('certificate_applications').update({'status': 'approved', 'document': body.document, 'pdf_base64': body.pdf_base64, 'updated_at': datetime.now(timezone.utc).isoformat()}).eq('id', row['id']).eq('status', 'pending').execute().data
        if not updated:
            raise HTTPException(409, 'Another admin has already reviewed this application.')
        return deliver(updated[0])

    @app.post('/api/admin/certificate-applications/{application_id}/send')
    def retry(application_id: UUID, _admin=Depends(require_manager)):
        row = get_row(application_id)
        if row['status'] != 'approved':
            raise HTTPException(409, 'Approve the certificate first.')
        return deliver(row)

    @app.post('/api/admin/certificate-applications/{application_id}/decline')
    def decline(application_id: UUID, body: DeclineInput, _admin=Depends(require_manager)):
        if not body.note.strip():
            raise HTTPException(422, 'Enter a reason.')
        rows = db.table('certificate_applications').update({'status': 'declined', 'admin_note': body.note.strip(), 'updated_at': datetime.now(timezone.utc).isoformat()}).eq('id', str(application_id)).eq('status', 'pending').execute().data
        if not rows:
            raise HTTPException(409, 'This application has already been reviewed.')
        return {'ok': True}
