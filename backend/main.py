import logging
import os
from datetime import datetime, timezone
from typing import Annotated, Literal

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from supabase import Client, create_client


load_dotenv()

firebase_project_id = os.environ["FIREBASE_PROJECT_ID"]
supabase_url = os.environ["SUPABASE_URL"]
supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"]

try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(options={"projectId": firebase_project_id})

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
    if body.role == "admin" and admin["staff_role"] != "owner":
        raise HTTPException(status_code=403, detail="Only an owner can invite another admin.")

    email = str(body.email).strip().lower()
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
