"""Run: .venv/Scripts/python -m unittest discover -s tests -p test_certificate_applications.py"""
import base64
import os
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend.certificate_applications import ApplicationInput, decode_pdf, register, send_certificate


class CertificateApplicationsTest(unittest.TestCase):
    dates = {'requested_start_date':'2026-01-01','requested_end_date':'2026-06-30'}

    def test_validation_and_pdf(self):
        body = ApplicationInput(full_name=' Former  Student ', email='former@example.com', course_name=' Web Development ', **self.dates)
        self.assertEqual(body.full_name, 'Former Student')
        with self.assertRaises(ValueError):
            ApplicationInput(full_name=' ', email='bad', course_name='Course')
        with self.assertRaises(HTTPException):
            decode_pdf(base64.b64encode(b'not a pdf').decode())
        self.assertEqual(decode_pdf(base64.b64encode(b'%PDF-1.4 test').decode()), b'%PDF-1.4 test')

    def test_admin_endpoints_require_auth(self):
        def denied():
            raise HTTPException(401, 'Sign in')
        app = FastAPI()
        register(app, None, denied)
        client = TestClient(app)
        self.assertEqual(client.get('/api/admin/certificate-applications').status_code, 401)
        self.assertEqual(client.post('/api/admin/certificate-applications/00000000-0000-0000-0000-000000000001/send').status_code, 401)
        self.assertEqual(client.get('/api/admin/certificate-applications/00000000-0000-0000-0000-000000000001/pdf').status_code, 401)
        self.assertEqual(client.post('/api/admin/certificate-applications/00000000-0000-0000-0000-000000000001/correct',json={}).status_code,401)
        self.assertEqual(client.post('/api/public/certificate-applications', json={'full_name':'Student','email':'bad','course_name':'Course'}).status_code, 422)

    def test_public_submission_needs_no_login_or_batch(self):
        db = MagicMock()
        db.rpc.return_value.execute.return_value.data = {'id':'application', 'student_code':'LT-CERT-STU-100001'}
        app = FastAPI()
        register(app, db, lambda: None)
        response = TestClient(app).post('/api/public/certificate-applications', json={'full_name':'Former Student','email':'former@example.com','course_name':'Course',**self.dates})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['student_code'], 'LT-CERT-STU-100001')
        db.rpc.assert_called_once_with('submit_public_certificate_application_details', {'p_name':'Former Student','p_email':'former@example.com','p_course':'Course','p_type':'Course Completion','p_domain':'','p_start':'2026-01-01','p_end':'2026-06-30'})
        db.table.assert_not_called()

    def test_internship_dates_and_domain(self):
        details = {'full_name':'Student','email':'former@example.com','course_name':'Course',**self.dates}
        with self.assertRaises(ValueError):
            ApplicationInput(**details, certificate_type='Internship Completion')
        body = ApplicationInput(**details, certificate_type='Internship Completion', designation=' Web Development ')
        self.assertEqual(body.designation, 'Web Development')
        with self.assertRaises(ValueError):
            ApplicationInput(**{**details,'requested_end_date':'2025-12-31'})
        with self.assertRaises(ValueError):
            ApplicationInput(**details, certificate_type='Invalid')
        app=FastAPI(); db=MagicMock(); db.rpc.return_value.execute.return_value.data={'id':'application','student_code':'LT-CERT-STU-100001'}; register(app,db,lambda:None)
        response=TestClient(app).post('/api/public/certificate-applications',json={**details,'certificate_type':'Internship Completion','designation':'Developer Intern'})
        self.assertEqual(response.status_code,201)
        self.assertEqual(db.rpc.call_args.args[1]['p_type'],'Internship Completion')
        self.assertEqual(db.rpc.call_args.args[1]['p_domain'],'Developer Intern')

    def test_email_uses_stored_recipient_and_pdf(self):
        row = {'full_name':'Student','course_name':'Course','pdf_base64':base64.b64encode(b'%PDF-1.4 test').decode()}
        with patch.dict(os.environ, {'HOSTINGER_SMTP_USER':'info@example.com','HOSTINGER_SMTP_PASSWORD':'test'}), patch('backend.certificate_applications.smtplib.SMTP_SSL') as smtp:
            send_certificate(row, {'email':'former@example.com','student_code':'LT-CERT-STU-100001'})
            message = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
            self.assertEqual(message['To'], 'former@example.com')
            self.assertEqual(next(message.iter_attachments()).get_payload(decode=True), b'%PDF-1.4 test')

    def test_admin_downloads_original_saved_pdf(self):
        pdf=b'%PDF-1.4 original emailed certificate'
        db=MagicMock(); app=FastAPI(); register(app,db,lambda:None)
        result=db.table.return_value.select.return_value.eq.return_value.execute.return_value
        result.data=[{'status':'approved','pdf_base64':base64.b64encode(pdf).decode()}]
        client=TestClient(app)
        path='/api/admin/certificate-applications/00000000-0000-0000-0000-000000000001/pdf'
        response=client.get(path)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.content,pdf)
        self.assertEqual(response.headers['content-type'],'application/pdf')
        self.assertEqual(response.headers['cache-control'],'private, no-store')
        result.data=[{'status':'pending','pdf_base64':base64.b64encode(pdf).decode()}]
        self.assertEqual(client.get(path).status_code,404)
        result.data=[{'status':'approved','pdf_base64':None}]
        self.assertEqual(client.get(path).status_code,404)
        result.data=[]
        self.assertEqual(client.get(path).status_code,404)

    def test_correction_requires_reviewed_version_and_approved_status(self):
        db=MagicMock(); app=FastAPI(); register(app,db,lambda:None)
        row={'id':'00000000-0000-0000-0000-000000000001','applicant_id':'person','status':'approved','email_status':'sent','updated_at':'2026-10-29T08:00:00+00:00'}
        lookup=db.table.return_value.select.return_value.eq.return_value.execute.return_value
        lookup.data=[row]
        updated=db.table.return_value.update.return_value.eq.return_value.eq.return_value.neq.return_value.eq.return_value.execute.return_value
        pdf=base64.b64encode(b'%PDF-1.4 corrected').decode()
        updated.data=[{**row,'email_status':'not_sent','pdf_base64':pdf}]
        db.table.return_value.update.return_value.eq.return_value.in_.return_value.execute.return_value.data=[row]
        db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data={'email':'person@example.com','student_code':'LT-CERT-STU-100072'}
        body={'document':{'certificateId':'LT-CERT-123456789ABC'},'pdf_base64':pdf,'expected_updated_at':row['updated_at']}
        path='/api/admin/certificate-applications/'+row['id']+'/correct'
        with patch('backend.certificate_applications.send_certificate') as send:
            client=TestClient(app);response=client.post(path,json=body)
            self.assertEqual(response.status_code,200);send.assert_called_once()
            self.assertEqual(db.table.return_value.update.call_args_list[0].args[0]['pdf_base64'],pdf)
            send.reset_mock();updated.data=[]
            self.assertEqual(client.post(path,json=body).status_code,409);send.assert_not_called()
            lookup.data=[{**row,'status':'pending'}]
            self.assertEqual(client.post(path,json=body).status_code,409)
            lookup.data=[{**row,'email_status':'sending'}]
            self.assertEqual(client.post(path,json=body).status_code,409)


if __name__ == '__main__':
    unittest.main()
