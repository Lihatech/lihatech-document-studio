"""Mocked HTTP checks; never contacts Firebase or Supabase."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('FIREBASE_PROJECT_ID','lihatech-document-studio')
os.environ.setdefault('SUPABASE_URL','https://example.supabase.co')
os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY','test-only-key')
os.environ['SUPABASE_SECRET_KEY']='sb_secret_test_only'
from fastapi.testclient import TestClient
from backend import main

class Downloads(unittest.TestCase):
    def test_publishable_primary_falls_back_to_service_key(self):
        import base64
        service='eyJhbGciOiJIUzI1NiJ9.'+base64.urlsafe_b64encode(b'{"role":"service_role"}').decode().rstrip('=')+'.test'
        with patch.dict(os.environ,{'SUPABASE_SECRET_KEY':'sb_publishable_browser','SUPABASE_SERVICE_ROLE_KEY':service}):
            self.assertEqual(main.server_key(),service)
        with patch.dict(os.environ,{'SUPABASE_SECRET_KEY':'sb_publishable_browser','SUPABASE_SERVICE_ROLE_KEY':'invalid'}):
            with self.assertRaises(RuntimeError): main.server_key()
    def setUp(self):
        main.app.dependency_overrides[main.verify_firebase_user] = lambda: {'uid':'student-a','email_verified':True}
        self.client=TestClient(main.app)
        self.database=patch.object(main,'supabase',MagicMock()).start()
        self.database.rpc.return_value.execute.return_value.data={'storage_path':'a/lesson.pdf'}
        self.database.storage.from_.return_value.download.return_value=b'%PDF-test'
    def tearDown(self):
        main.app.dependency_overrides.clear()
        patch.stopall()
    def test_permitted_file_no_cache(self):
        response=self.client.get('/api/student/materials/00000000-0000-0000-0000-000000000001')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.content,b'%PDF-test')
        self.assertIn('no-store',response.headers['cache-control'])
        self.assertTrue(response.headers['content-type'].startswith('application/pdf'))
        self.assertTrue(response.headers['content-disposition'].startswith('inline'))
        self.assertIn('filename="lesson.pdf"',response.headers['content-disposition'])
        self.database.rpc.assert_called_once_with('lms_private_file',{'p_uid':'student-a','p_id':'00000000-0000-0000-0000-000000000001'})
    def test_expired_or_cross_batch_denied_before_download(self):
        denied=Exception('Access denied')
        denied.code='42501'
        self.database.rpc.return_value.execute.side_effect=denied
        self.assertEqual(self.client.get('/api/student/materials/00000000-0000-0000-0000-000000000001').status_code,403)
        self.database.storage.from_.assert_not_called()
    def test_office_file_download_keeps_original_filename(self):
        self.database.rpc.return_value.execute.return_value.data={'storage_path':'private/report.docx'}
        self.database.storage.from_.return_value.download.return_value=b'PK-office-document'
        response=self.client.get('/api/student/materials/00000000-0000-0000-0000-000000000001',headers={'Origin':'http://localhost:3000'})
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.headers['content-type'].startswith('application/octet-stream'))
        self.assertEqual(response.headers['content-disposition'],'attachment; filename="report.docx"')
        self.assertIn('Content-Disposition',response.headers['access-control-expose-headers'])
    def test_database_failure_is_not_reported_as_expired_access(self):
        self.database.rpc.return_value.execute.side_effect=Exception('Database unavailable')
        response=self.client.get('/api/student/materials/00000000-0000-0000-0000-000000000001')
        self.assertEqual(response.status_code,502)
        self.database.storage.from_.assert_not_called()
    def test_unverified_denied(self):
        main.app.dependency_overrides[main.verify_firebase_user]=lambda:{'uid':'student-a','email_verified':False}
        self.assertEqual(self.client.get('/api/student/materials/00000000-0000-0000-0000-000000000001').status_code,403)
        self.database.rpc.assert_not_called()
    def test_invalid_id(self):
        self.assertEqual(self.client.get('/api/student/materials/invalid').status_code,422)
    def test_missing_bearer(self):
        main.app.dependency_overrides.clear()
        self.assertEqual(self.client.get('/api/student/materials/00000000-0000-0000-0000-000000000001').status_code,401)
        self.database.rpc.assert_not_called()

if __name__=='__main__': unittest.main()
