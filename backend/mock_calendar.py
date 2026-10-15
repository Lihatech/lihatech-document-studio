"""Google Calendar event creation for approved one-to-one mock interviews."""
import os
import time
from uuid import UUID, uuid4

import httpx


class CalendarError(Exception):
    pass


def configured() -> bool:
    return all(os.getenv(name) for name in (
        "GOOGLE_CALENDAR_ID", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET",
        "GOOGLE_OAUTH_REFRESH_TOKEN", "MOCK_INTERVIEWER_EMAIL",
    ))


def interviewer_email() -> str:
    value = os.getenv("MOCK_INTERVIEWER_EMAIL", "").strip().lower()
    if not value or "@" not in value:
        raise CalendarError("Mock interview calendar is not configured.")
    return value


def _token(client: httpx.Client) -> str:
    if not configured():
        raise CalendarError("Mock interview calendar is not configured.")
    try:
        response = client.post("https://oauth2.googleapis.com/token", data={
            "client_id": os.environ["GOOGLE_OAUTH_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_OAUTH_CLIENT_SECRET"],
            "refresh_token": os.environ["GOOGLE_OAUTH_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        })
        response.raise_for_status()
        return response.json()["access_token"]
    except (httpx.HTTPError, KeyError, ValueError) as error:
        raise CalendarError("Could not authorize the LihaTech calendar.") from error


def _url(event_id: str = "") -> str:
    calendar_id = httpx.URL("https://www.googleapis.com").copy_with(
        path=f"/calendar/v3/calendars/{os.environ['GOOGLE_CALENDAR_ID']}/events"
             + (f"/{event_id}" if event_id else "")
    )
    return str(calendar_id)


def busy_periods(starts_at: str, ends_at: str) -> list[tuple[str, str]]:
    """Read only free/busy intervals; event titles and guests never reach students."""
    with httpx.Client(timeout=12) as client:
        token = _token(client)
        try:
            response = client.post("https://www.googleapis.com/calendar/v3/freeBusy",
                headers={"Authorization": f"Bearer {token}"}, json={
                    "timeMin": starts_at, "timeMax": ends_at,
                    "items": [{"id": os.environ["GOOGLE_CALENDAR_ID"]}],
                })
            response.raise_for_status()
            calendar = response.json()["calendars"][os.environ["GOOGLE_CALENDAR_ID"]]
            if calendar.get("errors"):
                raise CalendarError("Could not read the LihaTech calendar availability.")
            return [(item["start"], item["end"]) for item in calendar["busy"]]
        except (httpx.HTTPError, KeyError, ValueError) as error:
            raise CalendarError("Could not read the LihaTech calendar availability.") from error


def create_interview(booking_id: str, student_name: str, student_email: str,
                     starts_at: str, ends_at: str) -> tuple[str, str]:
    """Use a deterministic event ID so retrying cannot send duplicate invitations."""
    event_id = "lms" + UUID(booking_id).hex
    with httpx.Client(timeout=12) as client:
        token = _token(client)
        headers = {"Authorization": f"Bearer {token}"}
        event = {
            "id": event_id,
            "summary": f"LihaTech mock interview - {student_name}",
            "description": "One-to-one mock interview arranged through LihaTech Learn.",
            "start": {"dateTime": starts_at}, "end": {"dateTime": ends_at},
            "attendees": [{"email": interviewer_email()}, {"email": student_email}],
            "visibility": "private", "guestsCanInviteOthers": False,
            "guestsCanModify": False, "guestsCanSeeOtherGuests": False,
            "conferenceData": {"createRequest": {
                "requestId": event_id,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }},
        }
        try:
            response = client.post(_url(), params={"conferenceDataVersion": 1, "sendUpdates": "all"},
                                   headers=headers, json=event)
            if response.status_code != 409:
                response.raise_for_status()
            retried_conference = False
            for attempt in range(6):
                current = client.get(_url(event_id), headers=headers)
                current.raise_for_status()
                result = current.json()
                link = result.get("hangoutLink") or next((entry.get("uri") for entry in
                    result.get("conferenceData", {}).get("entryPoints", []) if entry.get("entryPointType") == "video"), None)
                if link:
                    return event_id, link
                if result.get("conferenceData", {}).get("createRequest", {}).get("status", {}).get("statusCode") == "failure":
                    if retried_conference:
                        break
                    retry = client.patch(_url(event_id), params={"conferenceDataVersion": 1},
                        headers=headers, json={"conferenceData": {"createRequest": {
                            "requestId": "lms" + uuid4().hex,
                            "conferenceSolutionKey": {"type": "hangoutsMeet"},
                        }}})
                    retry.raise_for_status()
                    retried_conference = True
                if attempt < 5:
                    time.sleep(1)
        except (httpx.HTTPError, ValueError) as error:
            raise CalendarError("Google Calendar could not create the interview invitation.") from error
    raise CalendarError("Google Calendar did not return a Meet link. Retry approval shortly.")


def delete_interview(event_id: str) -> None:
    with httpx.Client(timeout=12) as client:
        token = _token(client)
        try:
            response = client.delete(_url(event_id), params={"sendUpdates": "all"},
                                     headers={"Authorization": f"Bearer {token}"})
            if response.status_code != 404:
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise CalendarError("Google Calendar could not cancel the invitation.") from error
