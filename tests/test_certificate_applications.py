"""Run: .venv/Scripts/python -m unittest discover -s tests -p test_certificate_applications.py"""
import base64
import os
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend.certificate_applications import ApplicationInput, decode_pdf, register, send_certificate


class CertificateApplicationsTest(unittest.TestCase):
    def test_validation_and_pdf(self):
        body = ApplicationInput(full_name=' Former  Student ', email='former@example.com', course_name=' Web Development ')
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
        self.assertEqual(client.post('/api/public/certificate-applications', json={'full_name':'Student','email':'bad','course_name':'Course'}).status_code, 422)

    def test_public_submission_needs_no_login_or_batch(self):
        db = MagicMock()
        db.rpc.return_value.execute.return_value.data = {'id':'application', 'student_code':'LT-CERT-STU-100001'}
        app = FastAPI()
        register(app, db, lambda: None)
        response = TestClient(app).post('/api/public/certificate-applications', json={'full_name':'Former Student','email':'former@example.com','course_name':'Course'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['student_code'], 'LT-CERT-STU-100001')
        db.rpc.assert_called_once_with('submit_public_certificate_application', {'p_name':'Former Student','p_email':'former@example.com','p_course':'Course'})
        db.table.assert_not_called()

    def test_email_uses_stored_recipient_and_pdf(self):
        row = {'full_name':'Student','course_name':'Course','pdf_base64':base64.b64encode(b'%PDF-1.4 test').decode()}
        with patch.dict(os.environ, {'HOSTINGER_SMTP_USER':'info@example.com','HOSTINGER_SMTP_PASSWORD':'test'}), patch('backend.certificate_applications.smtplib.SMTP_SSL') as smtp:
            send_certificate(row, {'email':'former@example.com','student_code':'LT-CERT-STU-100001'})
            message = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
            self.assertEqual(message['To'], 'former@example.com')
            self.assertEqual(next(message.iter_attachments()).get_payload(decode=True), b'%PDF-1.4 test')


if __name__ == '__main__':
    unittest.main()
