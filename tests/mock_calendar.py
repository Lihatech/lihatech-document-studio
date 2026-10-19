"""Calendar integration checks without contacting Google."""
import os
import sys
import json
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend import mock_calendar


BOOKING_ID = "00000000-0000-0000-0000-000000000001"
EVENT_ID = "lms" + BOOKING_ID.replace("-", "")


class CalendarTests(unittest.TestCase):
    def test_events_expand_recurrence_paginate_and_keep_all_day_end_exclusive(self):
        seen = []
        def respond(request):
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "token"})
            seen.append(request)
            if request.url.params.get("pageToken"):
                return httpx.Response(200, json={"items": [{"id": "free", "summary": "Optional event", "transparency": "transparent", "start": {"dateTime": "2026-10-20T09:00:00+05:30"}, "end": {"dateTime": "2026-10-20T10:00:00+05:30"}}]})
            return httpx.Response(200, json={"nextPageToken": "page2", "items": [{"id": "all-day", "start": {"date": "2026-10-20"}, "end": {"date": "2026-10-21"}}, {"id": "deleted", "status": "cancelled"}]})
        with self.client_for(respond):
            rows = mock_calendar.calendar_events("2026-10-01T00:00:00+05:30", "2026-11-01T00:00:00+05:30")
        self.assertEqual(len(rows), 2)
        self.assertEqual(seen[0].url.params["singleEvents"], "true")
        self.assertEqual(rows[0]["ends_at"], "2026-10-21T00:00:00+05:30")
        self.assertTrue(rows[0]["all_day"])
        self.assertTrue(rows[0]["busy"])
        self.assertFalse(rows[1]["busy"])

    def setUp(self):
        mock_calendar._cached_token = None
        self.environment = patch.dict(os.environ, {
            "GOOGLE_CALENDAR_ID": "primary",
            "GOOGLE_OAUTH_CLIENT_ID": "client",
            "GOOGLE_OAUTH_CLIENT_SECRET": "secret",
            "GOOGLE_OAUTH_REFRESH_TOKEN": "refresh",
            "MOCK_INTERVIEWER_EMAIL": "interviewer@lihatech.com",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def client_for(self, handler):
        real_client = httpx.Client
        transport = httpx.MockTransport(handler)
        return patch.object(mock_calendar.httpx, "Client", lambda **kwargs: real_client(transport=transport, **kwargs))

    def test_create_invites_both_guests_and_returns_generated_meet(self):
        seen = []

        def respond(request):
            seen.append(request)
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "token"})
            if request.method == "POST":
                return httpx.Response(200, json={"id": EVENT_ID})
            return httpx.Response(200, json={"hangoutLink": "https://meet.google.com/abc-defg-hij"})

        with self.client_for(respond):
            result = mock_calendar.create_interview(BOOKING_ID, "Student", "student@example.com",
                "2026-10-20T10:00:00+05:30", "2026-10-20T11:00:00+05:30", "SQL joins\nJava <basics> & OOP")
        self.assertEqual(result, (EVENT_ID, "https://meet.google.com/abc-defg-hij"))
        event = next(request for request in seen if request.method == "POST" and request.url.host == "www.googleapis.com")
        self.assertEqual(event.url.params["conferenceDataVersion"], "1")
        self.assertEqual(event.url.params["sendUpdates"], "all")
        self.assertEqual(event.url.path, "/calendar/v3/calendars/primary/events")
        body = json.loads(event.content)
        self.assertIn("Topics prepared by the student:\nSQL joins\nJava &lt;basics&gt; &amp; OOP", body["description"])
        self.assertEqual(body["id"], EVENT_ID)
        self.assertEqual([guest["email"] for guest in body["attendees"]],
                         ["interviewer@lihatech.com", "student@example.com"])
        self.assertEqual(body["conferenceData"]["createRequest"]["conferenceSolutionKey"]["type"], "hangoutsMeet")

    def test_existing_event_retries_failed_meet_without_second_invitation(self):
        methods = []

        def respond(request):
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "token"})
            methods.append(request.method)
            if request.method == "POST":
                return httpx.Response(409)
            if request.method == "PATCH":
                return httpx.Response(200, json={})
            if "PATCH" in methods:
                return httpx.Response(200, json={"hangoutLink": "https://meet.google.com/abc-defg-hij"})
            return httpx.Response(200, json={"conferenceData": {"createRequest": {"status": {"statusCode": "failure"}}}})

        with self.client_for(respond), patch.object(mock_calendar.time, "sleep"):
            result = mock_calendar.create_interview(BOOKING_ID, "Student", "student@example.com",
                "2026-10-20T10:00:00+05:30", "2026-10-20T11:00:00+05:30")
        self.assertEqual(result[0], EVENT_ID)
        self.assertEqual(methods.count("POST"), 1)
        self.assertEqual(methods.count("PATCH"), 1)

    def test_delete_sends_guest_updates_and_accepts_already_deleted(self):
        seen = []

        def respond(request):
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "token"})
            seen.append(request)
            return httpx.Response(404)

        with self.client_for(respond):
            mock_calendar.delete_interview(EVENT_ID)
        self.assertEqual(seen[0].method, "DELETE")
        self.assertEqual(seen[0].url.params["sendUpdates"], "all")

    def test_free_busy_returns_only_intervals(self):
        seen = []

        def respond(request):
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "token"})
            seen.append(request)
            return httpx.Response(200, json={"calendars": {"primary": {"busy": [
                {"start": "2026-10-20T10:00:00+05:30", "end": "2026-10-20T11:00:00+05:30"}
            ]}}})

        with self.client_for(respond):
            periods = mock_calendar.busy_periods("2026-10-20T09:00:00+05:30", "2026-10-20T18:00:00+05:30")
        self.assertEqual(periods, [("2026-10-20T10:00:00+05:30", "2026-10-20T11:00:00+05:30")])
        self.assertEqual(seen[0].url.path, "/calendar/v3/freeBusy")
        self.assertEqual(json.loads(seen[0].content)["items"], [{"id": "primary"}])

    def test_repeated_availability_reuses_unexpired_oauth_token(self):
        token_requests = []

        def respond(request):
            if request.url.host == "oauth2.googleapis.com":
                token_requests.append(request)
                return httpx.Response(200, json={"access_token": "token", "expires_in": 3600})
            return httpx.Response(200, json={"calendars": {"primary": {"busy": []}}})

        with self.client_for(respond):
            mock_calendar.busy_periods("2026-10-20T09:00:00+05:30", "2026-10-20T18:00:00+05:30")
            mock_calendar.busy_periods("2026-10-21T09:00:00+05:30", "2026-10-21T18:00:00+05:30")
        self.assertEqual(len(token_requests), 1)


if __name__ == "__main__":
    unittest.main()
