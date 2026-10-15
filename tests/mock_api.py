"""Mock approval checks with no Firebase, Supabase or Google network calls."""
import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("FIREBASE_PROJECT_ID", "lihatech-document-studio")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-only-key")

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError
from backend import main


BOOKING_ID = "00000000-0000-0000-0000-000000000001"
SLOT_ID = "00000000-0000-0000-0000-000000000002"
STUDENT_ID = "00000000-0000-0000-0000-000000000003"
REAL_DAY_AVAILABILITY = main.mock_day_availability


class Table:
    def __init__(self, rows):
        self.rows = rows
        self.changes = []
        self.pending = None
        self.filters = []

    def select(self, *_): return self
    def limit(self, *_): return self
    def eq(self, field, value):
        self.filters.append((field, value))
        return self
    def update(self, values):
        self.pending = values
        return self
    def execute(self):
        rows = [row for row in self.rows if all(row.get(field) == value for field, value in self.filters)]
        if self.pending is not None:
            self.changes.append(self.pending)
            for row in rows:
                row.update(self.pending)
        self.filters = []
        self.pending = None
        return type("Result", (), {"data": rows})()


class MockApproval(unittest.TestCase):
    def setUp(self):
        self.bookings = Table([{"id": BOOKING_ID, "slot_id": SLOT_ID,
            "student_id": STUDENT_ID, "status": "requested"}])
        self.slots = Table([{"id": SLOT_ID, "status": "open",
            "starts_at": "2099-01-01T10:00:00+00:00", "ends_at": "2099-01-01T11:00:00+00:00"}])
        self.students = Table([{"id": STUDENT_ID, "full_name": "Student",
            "email": "student@example.com", "status": "active"}])
        self.database = patch.object(main, "supabase", MagicMock()).start()
        self.database.table.side_effect = {
            "mock_interview_bookings": self.bookings,
            "mock_interview_slots": self.slots,
            "students": self.students,
        }.get
        main.app.dependency_overrides[main.require_manager] = lambda: {"uid": "admin"}
        self.calendar = patch.object(main.mock_calendar, "configured", return_value=True).start()
        self.create = patch.object(main.mock_calendar, "create_interview",
            return_value=("lms" + BOOKING_ID.replace("-", ""), "https://meet.google.com/abc-defg-hij")).start()
        self.client = TestClient(main.app)

    def tearDown(self):
        main.app.dependency_overrides.clear()
        patch.stopall()

    def test_approval_saves_auto_generated_meet(self):
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.bookings.rows[0]["status"], "booked")
        self.assertEqual(self.bookings.rows[0]["meeting_url"], "https://meet.google.com/abc-defg-hij")
        self.create.assert_called_once_with(BOOKING_ID, "Student", "student@example.com",
            "2099-01-01T10:00:00+00:00", "2099-01-01T11:00:00+00:00")

    def test_calendar_failure_keeps_request_pending(self):
        self.create.side_effect = main.mock_calendar.CalendarError("Meet unavailable")
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(self.bookings.rows[0]["status"], "requested")
        self.assertEqual(self.bookings.rows[0]["calendar_error"], "Meet unavailable")

    def test_no_calendar_prevents_claim(self):
        self.calendar.return_value = False
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.bookings.rows[0]["status"], "requested")


class StudentRequest(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.require_active_student] = lambda: {"firebase_uid": "student-uid"}
        self.client = TestClient(main.app)
        self.day = patch.object(main, "mock_day_availability", return_value={
            "date": "2099-01-01", "calendar_connected": True,
            "hours": [{"starts_at": "2099-01-01T09:00:00+05:30",
                       "ends_at": "2099-01-01T10:00:00+05:30", "available": True}],
        }).start()
        patch.object(main, "mock_hours", return_value=(9, 18)).start()
        self.database = patch.object(main, "supabase", MagicMock()).start()
        self.database.rpc.return_value.execute.return_value.data = BOOKING_ID

    def tearDown(self):
        main.app.dependency_overrides.clear()
        patch.stopall()

    def test_student_requests_selected_hour(self):
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T09:00:00+05:30"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "requested")
        self.database.rpc.assert_called_once_with("lms_request_mock_time", {
            "p_uid": "student-uid", "p_starts_at": "2099-01-01T09:00:00+05:30",
            "p_first_hour": 9, "p_last_hour": 18,
        })

    def test_student_requests_quarter_hour_start(self):
        self.day.return_value["hours"] = [{"starts_at": "2099-01-01T13:15:00+05:30",
                                          "ends_at": "2099-01-01T14:15:00+05:30", "available": True}]
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T13:15:00+05:30"})
        self.assertEqual(response.status_code, 200)
        self.database.rpc.assert_called_once_with("lms_request_mock_time", {
            "p_uid": "student-uid", "p_starts_at": "2099-01-01T13:15:00+05:30",
            "p_first_hour": 9, "p_last_hour": 18,
        })

    def test_student_cannot_request_unavailable_hour(self):
        self.day.return_value["hours"][0]["available"] = False
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T09:00:00+05:30"})
        self.assertEqual(response.status_code, 409)
        self.database.rpc.assert_not_called()

    def test_missing_database_migration_is_not_reported_as_taken_slot(self):
        self.database.rpc.return_value.execute.side_effect = APIError({
            "message": "Could not find the function public.lms_request_mock_time",
            "code": "PGRST202", "details": "", "hint": "",
        })
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T09:00:00+05:30"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("database migration", response.json()["detail"])

    def test_day_availability_hides_other_interviews(self):
        day = (datetime.now(main.MOCK_ZONE) + timedelta(days=2)).date().isoformat()
        slot = {"id": SLOT_ID, "batch_id": None, "status": "open", "booking_deadline": None,
                "starts_at": f"{day}T09:00:00+05:30", "ends_at": f"{day}T10:00:00+05:30"}
        query = MagicMock()
        query.select.return_value = query
        query.lt.return_value = query
        query.gt.return_value = query
        query.in_.return_value = query
        query.execute.side_effect = [type("Result", (), {"data": [slot]})(),
                                     type("Result", (), {"data": [{"slot_id": SLOT_ID, "status": "booked"}]})()]
        self.database.table.return_value = query
        with patch.object(main, "mock_day_availability", wraps=REAL_DAY_AVAILABILITY), \
             patch.object(main.mock_calendar, "configured", return_value=False):
            response = self.client.get(f"/api/student/mocks/availability?day={day}")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["hours"][0]["available"])
        self.assertNotIn("bookings", response.json())
        self.assertNotIn("student", str(response.json()))

    def test_quarter_hour_times_keep_one_hour_duration_and_block_overlaps(self):
        day = (datetime.now(main.MOCK_ZONE) + timedelta(days=2)).date().isoformat()
        slot = {"id": SLOT_ID, "batch_id": None, "status": "open", "booking_deadline": None,
                "starts_at": f"{day}T13:15:00+05:30", "ends_at": f"{day}T14:15:00+05:30"}
        query = MagicMock()
        query.select.return_value = query
        query.lt.return_value = query
        query.gt.return_value = query
        query.in_.return_value = query
        query.execute.side_effect = [type("Result", (), {"data": [slot]})(),
                                     type("Result", (), {"data": [{"slot_id": SLOT_ID, "status": "booked"}]})()]
        self.database.table.return_value = query
        with patch.object(main, "mock_day_availability", wraps=REAL_DAY_AVAILABILITY), \
             patch.object(main.mock_calendar, "configured", return_value=False):
            response = self.client.get(f"/api/student/mocks/availability?day={day}")
        self.assertEqual(response.status_code, 200)
        hours = {row["starts_at"][11:16]: row for row in response.json()["hours"]}
        self.assertEqual(len(hours), 33)
        self.assertEqual(hours["13:15"]["ends_at"][11:16], "14:15")
        self.assertTrue(hours["12:15"]["available"])
        for time in ("12:30", "12:45", "13:00", "13:15", "13:30", "13:45", "14:00"):
            self.assertFalse(hours[time]["available"])
        self.assertTrue(hours["14:15"]["available"])
        self.assertEqual(hours["17:00"]["ends_at"][11:16], "18:00")

    def test_google_event_shows_busy_time_without_event_details(self):
        day = (datetime.now(main.MOCK_ZONE) + timedelta(days=2)).date().isoformat()
        query = MagicMock()
        query.select.return_value = query
        query.lt.return_value = query
        query.gt.return_value = query
        query.execute.return_value.data = []
        self.database.table.return_value = query
        event = (f"{day}T13:00:00+05:30", f"{day}T14:00:00+05:30")
        with patch.object(main, "mock_day_availability", wraps=REAL_DAY_AVAILABILITY), \
             patch.object(main.mock_calendar, "configured", return_value=True), \
             patch.object(main.mock_calendar, "busy_periods", return_value=[event]):
            response = self.client.get(f"/api/student/mocks/availability?day={day}")
            month = self.client.get(f"/api/student/mocks/month?month={day[:7]}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(month.status_code, 200)
        self.assertEqual(response.json()["busy_periods"], [{"starts_at": event[0], "ends_at": event[1]}])
        self.assertIn(day, month.json()["busy_days"])
        self.assertEqual(next(row for row in response.json()["hours"] if row["starts_at"][11:16] == "13:15")["reason"], "calendar_busy")
        self.assertNotIn("student", str(month.json()))
        self.assertNotIn("event_title", str(response.json()))


if __name__ == "__main__":
    unittest.main()
