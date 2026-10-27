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
os.environ["SUPABASE_SECRET_KEY"]="sb_secret_test_only"

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
            "student_id": STUDENT_ID, "status": "requested", "prepared_topics": "Java basics, SQL joins"}])
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
        self.events = patch.object(main.mock_calendar, "calendar_events", return_value=[]).start()
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
            "2099-01-01T10:00:00+00:00", "2099-01-01T11:00:00+00:00", "Java basics, SQL joins")

    def test_admin_changes_pending_duration(self):
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/duration", json={"duration_minutes": 35})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ends_at"], "2099-01-01T10:35:00+00:00")
        self.database.rpc.assert_called_once_with("lms_admin_set_mock_duration", {
            "p_booking": BOOKING_ID, "p_minutes": 35, "p_proposal": False,
        })
        self.create.assert_not_called()

    def test_duration_rejects_conflicts_invalid_input_and_students(self):
        for value in (0, 181, 35.5, "35"):
            self.assertEqual(self.client.post(f"/api/admin/mocks/{BOOKING_ID}/duration", json={"duration_minutes": value}).status_code, 422)
        self.events.return_value = [{"id": "busy", "busy": True}]
        self.assertEqual(self.client.post(f"/api/admin/mocks/{BOOKING_ID}/duration", json={"duration_minutes": 60}).status_code, 409)
        self.database.rpc.assert_not_called()
        main.app.dependency_overrides.pop(main.require_manager)
        self.assertEqual(self.client.post(f"/api/admin/mocks/{BOOKING_ID}/duration", json={"duration_minutes": 35}).status_code, 401)

    def test_confirmed_duration_cannot_be_changed_directly(self):
        self.bookings.rows[0]["status"] = "booked"
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/duration", json={"duration_minutes": 35})
        self.assertEqual(response.status_code, 409)
        self.database.rpc.assert_not_called()

    def test_calendar_failure_keeps_request_pending(self):
        self.create.side_effect = main.mock_calendar.CalendarError("Meet unavailable")
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(self.bookings.rows[0]["status"], "requested")
        self.assertEqual(self.bookings.rows[0]["calendar_error"], "Meet unavailable")

    def test_older_request_can_still_be_approved(self):
        self.bookings.rows[0].pop("prepared_topics")
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.create.call_args.args[-1], "")

    def test_no_calendar_prevents_claim(self):
        self.calendar.return_value = False
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.bookings.rows[0]["status"], "requested")

    def test_conflict_prevents_approval_before_claim(self):
        self.events.return_value = [{"id": "busy", "busy": True}]
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.bookings.rows[0]["status"], "requested")
        self.create.assert_not_called()

    def test_retry_ignores_own_event_and_free_events(self):
        self.bookings.rows[0]["status"] = "approving"
        self.events.return_value = [{"id": "lms" + BOOKING_ID.replace("-", ""), "busy": True}, {"id": "free", "busy": False}]
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 200)

    def test_calendar_read_failure_does_not_approve(self):
        self.events.side_effect = main.mock_calendar.CalendarError("Calendar unavailable")
        response = self.client.post(f"/api/admin/mocks/{BOOKING_ID}/approve")
        self.assertEqual(response.status_code, 502)
        self.create.assert_not_called()

    def test_admin_calendar_range_and_validation(self):
        response = self.client.get("/api/admin/mocks/events?month=2026-10")
        self.assertEqual(response.status_code, 200)
        self.events.assert_called_once_with("2026-10-01T00:00:00+05:30", "2026-11-01T00:00:00+05:30")
        for month in ("2026-13", "garbage", "2026-1", "0001-01"):
            self.assertEqual(self.client.get(f"/api/admin/mocks/events?month={month}").status_code, 400)

    def test_students_cannot_read_admin_calendar_events(self):
        main.app.dependency_overrides.pop(main.require_manager)
        response = self.client.get("/api/admin/mocks/events?month=2026-10")
        self.assertEqual(response.status_code, 401)
        self.events.assert_not_called()


class StudentRequest(unittest.TestCase):
    def test_topics_required_and_bounded(self):
        for topics in (None, "", "   ", "x" * 2001):
            body = {"starts_at": "2099-01-01T09:00:00+05:30"}
            if topics is not None:
                body["prepared_topics"] = topics
            response = self.client.post("/api/student/mocks/request", json=body)
            self.assertEqual(response.status_code, 422)
        self.database.rpc.assert_not_called()

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
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T09:00:00+05:30", "prepared_topics": "  SQL joins  "})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "requested")
        self.database.rpc.assert_called_once_with("lms_request_mock_time", {
            "p_uid": "student-uid", "p_starts_at": "2099-01-01T09:00:00+05:30",
            "p_first_hour": 9, "p_last_hour": 18, "p_prepared_topics": "SQL joins",
        })

    def test_student_requests_quarter_hour_start(self):
        self.day.return_value["hours"] = [{"starts_at": "2099-01-01T13:15:00+05:30",
                                          "ends_at": "2099-01-01T14:15:00+05:30", "available": True}]
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T13:15:00+05:30", "prepared_topics": "  SQL joins  "})
        self.assertEqual(response.status_code, 200)
        self.database.rpc.assert_called_once_with("lms_request_mock_time", {
            "p_uid": "student-uid", "p_starts_at": "2099-01-01T13:15:00+05:30",
            "p_first_hour": 9, "p_last_hour": 18, "p_prepared_topics": "SQL joins",
        })

    def test_student_cannot_request_unavailable_hour(self):
        self.day.return_value["hours"][0]["available"] = False
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T09:00:00+05:30", "prepared_topics": "  SQL joins  "})
        self.assertEqual(response.status_code, 409)
        self.database.rpc.assert_not_called()

    def test_missing_database_migration_is_not_reported_as_taken_slot(self):
        self.database.rpc.return_value.execute.side_effect = APIError({
            "message": "Could not find the function public.lms_request_mock_time",
            "code": "PGRST202", "details": "", "hint": "",
        })
        response = self.client.post("/api/student/mocks/request", json={"starts_at": "2099-01-01T09:00:00+05:30", "prepared_topics": "  SQL joins  "})
        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["detail"])
        self.assertNotIn("database migration", response.json()["detail"])

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

    def test_35_minute_slots_block_overlaps_and_offer_exact_booking_end(self):
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
        self.assertEqual(len(hours), 34)
        self.assertEqual(hours["13:15"]["ends_at"][11:16], "13:50")
        self.assertTrue(hours["12:15"]["available"])
        self.assertTrue(hours["12:30"]["available"])
        for time in ("12:45", "13:00", "13:15", "13:30", "13:45", "14:00"):
            self.assertFalse(hours[time]["available"])
        self.assertTrue(hours["14:15"]["available"])
        self.assertEqual(hours["17:15"]["ends_at"][11:16], "17:50")
        self.assertEqual(response.json()["booked_periods"], [{"starts_at": slot["starts_at"], "ends_at": slot["ends_at"]}])

    def test_available_slot_starts_at_exact_end_of_35_minute_booking(self):
        day = (datetime.now(main.MOCK_ZONE) + timedelta(days=2)).date().isoformat()
        slot = {"id": SLOT_ID, "batch_id": None, "status": "open", "booking_deadline": None,
                "starts_at": f"{day}T14:30:00+05:30", "ends_at": f"{day}T15:05:00+05:30"}
        query = MagicMock()
        for method in ("select", "lt", "gt", "in_"):
            getattr(query, method).return_value = query
        query.execute.side_effect = [type("Result", (), {"data": [slot]})(),
                                     type("Result", (), {"data": [{"slot_id": SLOT_ID, "status": "booked"}]})()]
        self.database.table.return_value = query
        with patch.object(main.mock_calendar, "configured", return_value=False):
            result = REAL_DAY_AVAILABILITY(datetime.fromisoformat(day).date(), duration_minutes=50)
        hours = {row["starts_at"][11:16]: row for row in result["hours"]}
        self.assertFalse(hours["15:00"]["available"])
        self.assertTrue(hours["15:05"]["available"])
        self.assertEqual(hours["15:05"]["ends_at"][11:16], "15:55")
        self.assertEqual(result["duration_minutes"], 50)
        self.assertEqual(result["booked_periods"], [{"starts_at": slot["starts_at"], "ends_at": slot["ends_at"]}])

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
             patch.object(main.mock_calendar, "busy_periods", return_value=[event]), \
             patch.object(main.mock_calendar, "calendar_events", return_value=[{"id": "busy", "busy": True, "starts_at": event[0], "ends_at": event[1]}]):
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
