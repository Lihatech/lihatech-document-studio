import logging
import json
import mimetypes
import os
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials as firebase_credentials
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import Response
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field
from supabase import Client, create_client
if __package__:
    from . import mock_calendar
else:
    import mock_calendar


load_dotenv()

firebase_project_id = os.environ["FIREBASE_PROJECT_ID"]
supabase_url = os.environ["SUPABASE_URL"]
supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
if supabase_secret_key.startswith("sb_publishable_"):
    raise RuntimeError("The file API needs SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY, not a publishable key.")

try:
    firebase_admin.get_app()
except ValueError:
    service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    credential = firebase_credentials.Certificate(json.loads(service_account)) if service_account else None
    firebase_admin.initialize_app(credential, options={"projectId": firebase_project_id})

supabase: Client = create_client(supabase_url, supabase_secret_key)
app = FastAPI(title="LihaTech LMS Admin API", version="0.1.0")
bearer = HTTPBearer(auto_error=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("WEB_ORIGINS", "http://localhost:3000").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class InvitationInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    role: Literal["instructor", "admin"]


def verify_firebase_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in with Google first.")
    try:
        return firebase_auth.verify_id_token(credentials.credentials, check_revoked=True)
    except Exception as error:
        logging.getLogger(__name__).warning(
            "Firebase ID token verification failed (%s): %s",
            type(error).__name__,
            error,
        )
        raise HTTPException(status_code=401, detail="Your Firebase session is invalid or expired.") from None


def require_manager(user: Annotated[dict, Depends(verify_firebase_user)]) -> dict:
    if user.get("email_verified") is not True:
        raise HTTPException(status_code=403, detail="A verified Google email is required.")

    profiles = (
        supabase.table("admin_profiles")
        .select("firebase_uid, role, is_active")
        .eq("firebase_uid", user["uid"])
        .eq("is_active", True)
        .limit(1)
        .execute()
        .data
    )
    if not profiles or profiles[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only an active owner or admin can manage staff.")
    return {**user, "staff_role": profiles[0]["role"]}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/admin/users")
def list_staff(
    role: Literal["instructor", "admin"],
    _admin: Annotated[dict, Depends(require_manager)],
) -> dict:
    staff = (
        supabase.table("admin_profiles")
        .select("firebase_uid, email, full_name, role, is_active, created_at")
        .eq("role", role)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    invitations = (
        supabase.table("staff_invitations")
        .select("id, email, full_name, role, status, created_at, expires_at")
        .eq("role", role)
        .eq("status", "pending")
        .gt("expires_at", datetime.now(timezone.utc).isoformat())
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"staff": staff, "invitations": invitations}


@app.post("/api/admin/users/invitations", status_code=201)
def create_staff_invitation(
    body: InvitationInput,
    admin: Annotated[dict, Depends(require_manager)],
) -> dict:
    full_name = body.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Full name cannot be blank.")
    if body.role != "admin":
        raise HTTPException(status_code=403, detail="Instructor access is deferred to version 2.")

    email = str(body.email).strip().lower()
    if not email.endswith("@lihatech.com"):
        raise HTTPException(status_code=422, detail="Admins must use a LihaTech email.")
    existing = (
        supabase.table("admin_profiles")
        .select("firebase_uid")
        .ilike("email", email)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="A staff profile already exists for this email.")

    try:
        invitation = (
            supabase.table("staff_invitations")
            .insert({
                "email": email,
                "full_name": full_name,
                "role": body.role,
                "invited_by_firebase_uid": admin["uid"],
            })
            .execute()
            .data[0]
        )
    except Exception as error:
        if getattr(error, "code", None) == "23505":
            raise HTTPException(status_code=409, detail="A pending invitation already exists for this email.") from None
        raise HTTPException(status_code=500, detail="Could not create the staff invitation.") from None

    return {"id": invitation["id"], "email": email, "full_name": full_name, "role": body.role, "status": "pending", "expires_at": invitation["expires_at"]}



@app.post("/api/auth/provision")
def provision_invited_staff(user: Annotated[dict, Depends(verify_firebase_user)]) -> dict:
    email = str(user.get("email") or "").strip().lower()
    if user.get("email_verified") is not True or not email:
        raise HTTPException(status_code=403, detail="Sign in with a verified Google email to continue.")

    try:
        result = supabase.rpc("provision_staff_from_invitation", {
            "p_firebase_uid": user["uid"],
            "p_email": email,
        }).execute().data
    except Exception as error:
        message = str(getattr(error, "message", error))
        if "No unexpired staff invitation" in message:
            raise HTTPException(status_code=403, detail="No active invitation was found for this Google email. Ask an admin to invite this exact address.") from None
        if "inactive or mismatched staff profile" in message or "profile already exists" in message:
            raise HTTPException(status_code=403, detail="This email already has a staff profile. Ask an owner to review its access.") from None
        raise HTTPException(status_code=500, detail="Could not activate the invited staff account.") from None

    return result


@app.get("/api/student/materials/{material_id}")
def download_student_material(
    material_id: UUID,
    user: Annotated[dict, Depends(verify_firebase_user)],
) -> Response:
    if user.get("email_verified") is not True:
        raise HTTPException(status_code=403, detail="A verified Google account is required.")
    try:
        material = supabase.rpc("lms_private_file", {
            "p_uid": user["uid"], "p_id": str(material_id),
        }).execute().data
    except Exception as error:
        if getattr(error, "code", None) == "42501":
            raise HTTPException(status_code=403, detail="This material is unavailable or your access has expired.") from None
        logging.getLogger(__name__).exception("Private file authorization failed.")
        raise HTTPException(status_code=502, detail="The file service could not verify access. Try again or contact admin.") from None
    try:
        content = supabase.storage.from_("lms-materials").download(material["storage_path"])
    except Exception:
        raise HTTPException(status_code=502, detail="The file could not be loaded. Try again.") from None
    media_type = mimetypes.guess_type(material["storage_path"])[0]
    if media_type not in ("application/pdf", "image/png", "image/jpeg"):
        media_type = "application/octet-stream"
    return Response(content, media_type=media_type, headers={
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f'{"inline" if media_type in ("application/pdf", "image/png", "image/jpeg") else "attachment"}; filename="learning-material"',
    })


def require_active_student(user: Annotated[dict, Depends(verify_firebase_user)]) -> dict:
    if user.get("email_verified") is not True:
        raise HTTPException(status_code=403, detail="A verified Google account is required.")
    rows = (supabase.table("students").select("id,email,status,firebase_uid")
            .eq("firebase_uid", user["uid"]).limit(1).execute().data)
    if not rows or rows[0]["status"] != "active":
        raise HTTPException(status_code=403, detail="Active student access is required.")
    return rows[0]


class MockRequestInput(BaseModel):
    starts_at: datetime


MOCK_ZONE = timezone(timedelta(hours=5, minutes=30), 'Asia/Kolkata')


def mock_hours() -> tuple[int, int]:
    first = int(os.getenv("MOCK_FIRST_HOUR", "9"))
    last = int(os.getenv("MOCK_LAST_HOUR", "18"))
    if not 0 <= first < last <= 24:
        raise RuntimeError("Set valid MOCK_FIRST_HOUR and MOCK_LAST_HOUR values.")
    return first, last


def mock_day_availability(day: date) -> dict:
    first, last = mock_hours()
    start = datetime(day.year, day.month, day.day, tzinfo=MOCK_ZONE)
    end = start + timedelta(days=1)
    now = datetime.now(timezone.utc)
    if day > (now.astimezone(MOCK_ZONE) + timedelta(days=60)).date():
        raise HTTPException(status_code=400, detail="Choose a day within the next 60 days.")
    rows = (supabase.table("mock_interview_slots")
            .select("id,batch_id,starts_at,ends_at,booking_deadline,status")
            .lt("starts_at", end.isoformat()).gt("ends_at", start.isoformat()).execute().data)
    slot_ids = [row["id"] for row in rows]
    reservations = (supabase.table("mock_interview_bookings").select("slot_id,status")
                    .in_("slot_id", slot_ids).in_("status", ["requested", "approving", "booked", "completed", "no_show"])
                    .execute().data) if slot_ids else []
    reserved = {row["slot_id"] for row in reservations}
    try:
        calendar_busy = mock_calendar.busy_periods(start.isoformat(), end.isoformat()) if mock_calendar.configured() and end > now else []
    except mock_calendar.CalendarError as error:
        raise HTTPException(status_code=502, detail=str(error)) from None

    def overlaps(a_start: datetime, a_end: datetime, b_start: str, b_end: str) -> bool:
        return a_start < datetime.fromisoformat(b_end.replace("Z", "+00:00")) and a_end > datetime.fromisoformat(b_start.replace("Z", "+00:00"))

    hours = []
    for minute in range(first * 60, (last - 1) * 60 + 1, 15):
        begins = start + timedelta(minutes=minute)
        finishes = begins + timedelta(hours=1)
        slot_conflict = any(overlaps(begins, finishes, row["starts_at"], row["ends_at"])
            and (row["status"] == "full" or row["status"] == "open" and (
                row["id"] in reserved or row["batch_id"] is not None
                or row["booking_deadline"] is not None and datetime.fromisoformat(row["booking_deadline"].replace("Z", "+00:00")) <= now
                or datetime.fromisoformat(row["starts_at"].replace("Z", "+00:00")) != begins
                or datetime.fromisoformat(row["ends_at"].replace("Z", "+00:00")) != finishes))
            for row in rows)
        google_conflict = any(overlaps(begins, finishes, busy_start, busy_end) for busy_start, busy_end in calendar_busy)
        hours.append({"starts_at": begins.isoformat(), "ends_at": finishes.isoformat(),
                      "available": now < begins <= now + timedelta(days=60) and not slot_conflict and not google_conflict,
                      "reason": "calendar_busy" if google_conflict else "reserved" if slot_conflict else "outside_window" if begins <= now or begins > now + timedelta(days=60) else None})
    opens = start + timedelta(hours=first)
    closes = start + timedelta(hours=last)
    busy_periods = [{"starts_at": max(opens, datetime.fromisoformat(a.replace("Z", "+00:00"))).isoformat(),
                     "ends_at": min(closes, datetime.fromisoformat(b.replace("Z", "+00:00"))).isoformat()}
                    for a, b in calendar_busy if overlaps(opens, closes, a, b)]
    return {"date": day.isoformat(), "calendar_connected": mock_calendar.configured(),
            "hours": hours, "busy_periods": busy_periods}


@app.get("/api/student/mocks/month")
def student_mock_month(month: str, _student: Annotated[dict, Depends(require_active_student)]) -> dict:
    try:
        if len(month) != 7 or month[4] != "-":
            raise ValueError
        year, number = map(int, month.split("-"))
        if year < 1900 or year > 2100:
            raise ValueError
        first = date(year, number, 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Choose a valid month.") from None
    today = datetime.now(MOCK_ZONE).date()
    start_day = max(first, today)
    end_day = min(first + timedelta(days=monthrange(year, number)[1]), today + timedelta(days=60))
    if end_day < start_day or not mock_calendar.configured():
        return {"month": month, "calendar_connected": mock_calendar.configured(), "busy_days": []}
    first_hour, last_hour = mock_hours()
    start = datetime.combine(start_day, datetime.min.time(), MOCK_ZONE)
    end = datetime.combine(end_day + timedelta(days=1), datetime.min.time(), MOCK_ZONE)
    try:
        busy = [(datetime.fromisoformat(a.replace("Z", "+00:00")), datetime.fromisoformat(b.replace("Z", "+00:00")))
                for a, b in mock_calendar.busy_periods(start.isoformat(), end.isoformat())]
    except mock_calendar.CalendarError as error:
        raise HTTPException(status_code=502, detail=str(error)) from None
    busy_days = []
    for offset in range((end_day - start_day).days + 1):
        day = start_day + timedelta(days=offset)
        opens = datetime.combine(day, datetime.min.time(), MOCK_ZONE) + timedelta(hours=first_hour)
        closes = datetime.combine(day, datetime.min.time(), MOCK_ZONE) + timedelta(hours=last_hour)
        if any(a < closes and b > opens for a, b in busy):
            busy_days.append(day.isoformat())
    return {"month": month, "calendar_connected": True, "busy_days": busy_days}


@app.get("/api/student/mocks/availability")
def student_mock_availability(day: date, _student: Annotated[dict, Depends(require_active_student)]) -> dict:
    return mock_day_availability(day)


@app.post("/api/student/mocks/request")
def request_student_mock(body: MockRequestInput, student: Annotated[dict, Depends(require_active_student)]) -> dict:
    starts_at = body.starts_at
    if starts_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="Choose a time with a timezone.")
    availability = mock_day_availability(starts_at.astimezone(MOCK_ZONE).date())
    hour = next((row for row in availability["hours"] if datetime.fromisoformat(row["starts_at"]) == starts_at), None)
    if not hour or not hour["available"]:
        raise HTTPException(status_code=409, detail="This time is no longer available. Refresh the day and choose another.")
    first, last = mock_hours()
    try:
        booking_id = supabase.rpc("lms_request_mock_time", {
            "p_uid": student["firebase_uid"], "p_starts_at": hour["starts_at"],
            "p_first_hour": first, "p_last_hour": last,
        }).execute().data
    except Exception as error:
        code = getattr(error, "code", None)
        message = getattr(error, "message", str(error))
        if code == "PGRST202":
            logging.getLogger(__name__).error("Mock booking database migration is missing: %s", error)
            raise HTTPException(status_code=503, detail="Mock booking is not ready yet. Contact admin to apply the database migration.") from None
        if "already have an interview request" in message:
            raise HTTPException(status_code=409, detail="You already have an interview request at this time.") from None
        if code == "23505" or "already reserved" in message or "just taken" in message or "unavailable" in message:
            raise HTTPException(status_code=409, detail="This time was just taken. Refresh the day and choose another.") from None
        logging.getLogger(__name__).exception("Could not save mock interview request")
        raise HTTPException(status_code=503, detail="Could not save your request. Please try again or contact admin.") from None
    return {"id": booking_id, "status": "requested"}


@app.get("/api/admin/mocks/calendar")
def mock_calendar_status(_admin: Annotated[dict, Depends(require_manager)]) -> dict:
    return {"configured": mock_calendar.configured(),
            "interviewer_email": os.getenv("MOCK_INTERVIEWER_EMAIL", "")}


@app.post("/api/admin/mocks/{booking_id}/approve")
def approve_mock(booking_id: UUID, _admin: Annotated[dict, Depends(require_manager)]) -> dict:
    if not mock_calendar.configured():
        raise HTTPException(status_code=503, detail="Connect the LihaTech Google Calendar before approving requests.")
    rows = (supabase.table("mock_interview_bookings").select("id,slot_id,student_id,status")
            .eq("id", str(booking_id)).limit(1).execute().data)
    if not rows or rows[0]["status"] not in ("requested", "approving"):
        raise HTTPException(status_code=409, detail="This request is no longer pending.")
    booking = rows[0]
    slots = (supabase.table("mock_interview_slots").select("id,starts_at,ends_at,status")
             .eq("id", booking["slot_id"]).limit(1).execute().data)
    students = (supabase.table("students").select("id,full_name,email,status")
                .eq("id", booking["student_id"]).limit(1).execute().data)
    if not slots or not students or slots[0]["status"] != "open" or students[0]["status"] != "active":
        raise HTTPException(status_code=409, detail="The slot or student is no longer active.")
    slot, student = slots[0], students[0]
    if datetime.fromisoformat(slot["starts_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="This interview time has passed.")
    if booking["status"] == "requested":
        claimed = (supabase.table("mock_interview_bookings").update({"status": "approving", "calendar_error": None})
                   .eq("id", str(booking_id)).eq("status", "requested").select("id").execute().data)
        if not claimed:
            raise HTTPException(status_code=409, detail="This request changed. Refresh and try again.")
    try:
        event_id, meeting_url = mock_calendar.create_interview(str(booking_id), student["full_name"],
            student["email"], slot["starts_at"], slot["ends_at"])
    except mock_calendar.CalendarError as error:
        (supabase.table("mock_interview_bookings").update({"status": "requested", "calendar_error": str(error)})
         .eq("id", str(booking_id)).eq("status", "approving").execute())
        raise HTTPException(status_code=502, detail=str(error)) from None
    saved = (supabase.table("mock_interview_bookings")
             .update({"status": "booked", "calendar_event_id": event_id,
                      "meeting_url": meeting_url, "calendar_error": None})
             .eq("id", str(booking_id)).eq("status", "approving").select("id").execute().data)
    if not saved:
        raise HTTPException(status_code=409, detail="Calendar invitation was created, but booking changed. Retry approval to reconcile it.")
    return {"status": "booked", "meeting_url": meeting_url}


@app.post("/api/admin/mocks/{booking_id}/reject")
def reject_mock(booking_id: UUID, _admin: Annotated[dict, Depends(require_manager)]) -> dict:
    saved = (supabase.table("mock_interview_bookings").update({"status": "rejected"})
             .eq("id", str(booking_id)).eq("status", "requested").select("id").execute().data)
    if not saved:
        raise HTTPException(status_code=409, detail="Only a pending request can be rejected.")
    return {"status": "rejected"}


@app.post("/api/student/mocks/{booking_id}/cancel")
def cancel_student_mock(booking_id: UUID, student: Annotated[dict, Depends(require_active_student)]) -> dict:
    rows = (supabase.table("mock_interview_bookings").select("id,slot_id,status,calendar_event_id")
            .eq("id", str(booking_id)).eq("student_id", student["id"]).limit(1).execute().data)
    if not rows or rows[0]["status"] not in ("requested", "booked"):
        raise HTTPException(status_code=409, detail="This interview cannot be cancelled.")
    booking = rows[0]
    slots = (supabase.table("mock_interview_slots").select("starts_at")
             .eq("id", booking["slot_id"]).limit(1).execute().data)
    if not slots or datetime.fromisoformat(slots[0]["starts_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="This interview has already started.")
    if booking["calendar_event_id"]:
        try:
            mock_calendar.delete_interview(booking["calendar_event_id"])
        except mock_calendar.CalendarError as error:
            raise HTTPException(status_code=502, detail=str(error)) from None
    saved = (supabase.table("mock_interview_bookings").update({"status": "cancelled", "meeting_url": None})
             .eq("id", str(booking_id)).eq("status", booking["status"]).select("id").execute().data)
    if not saved:
        raise HTTPException(status_code=409, detail="This interview changed. Refresh and try again.")
    return {"status": "cancelled"}


@app.post("/api/admin/mocks/slots/{slot_id}/cancel")
def cancel_mock_slot(slot_id: UUID, _admin: Annotated[dict, Depends(require_manager)]) -> dict:
    slots = (supabase.table("mock_interview_slots").select("id,status")
             .eq("id", str(slot_id)).limit(1).execute().data)
    if not slots or slots[0]["status"] == "cancelled":
        raise HTTPException(status_code=409, detail="This slot is already cancelled or missing.")
    bookings = (supabase.table("mock_interview_bookings").select("id,status,calendar_event_id")
                .eq("slot_id", str(slot_id)).in_("status", ["requested", "approving", "booked"]).execute().data)
    if any(booking["status"] == "approving" for booking in bookings):
        raise HTTPException(status_code=409, detail="Approval is in progress. Retry shortly.")
    for booking in bookings:
        if booking["calendar_event_id"]:
            try:
                mock_calendar.delete_interview(booking["calendar_event_id"])
            except mock_calendar.CalendarError as error:
                raise HTTPException(status_code=502, detail=str(error)) from None
        (supabase.table("mock_interview_bookings").update({"status": "cancelled", "meeting_url": None})
         .eq("id", booking["id"]).eq("status", booking["status"]).execute())
    supabase.table("mock_interview_slots").update({"status": "cancelled"}).eq("id", str(slot_id)).execute()
    return {"status": "cancelled"}
