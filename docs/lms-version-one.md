# LMS version 1

The admin and student portals now share this React/Vite project, Firebase Google login and Supabase. The student layout is adapted from the existing `lihatech-lms` interface; its demo authentication and sample records are not used. Existing Document Studio routes and exports stay in the admin portal.

## Roles and login

Students sign in with Google using the same email registered by the admin. There is no separate LMS username or password to create or distribute. On first Google sign-in, Firebase supplies the identity and the LMS links it to the registered student record; an unregistered address receives a contact-admin message.

`lms_session` accepts only a verified Firebase identity from the configured LihaTech Firebase project. Active owner/admin records map to the single admin experience; the existing owner database value is retained for compatibility, not offered as a separate version 1 role. Admin email approval remains in the admin branch of the frontend login. Admin invitations require a LihaTech email. Registered students can use personal verified Google addresses. Their first login binds their UID to the registered email; changing that email through admin management clears the old identity link. Unregistered users receive a contact-admin message. Students always render the student layout even if they type an admin/document URL. Instructors have no version 1 permissions; instructor workflows and device restrictions are deferred.

The database replaces broad instructor access with owner/admin-only staff access. Student-facing RPCs return safe projections: own enrollment, allowed material metadata and own bookings/feedback. Students have no direct reads of internal notes, staff/student tables or Document Studio data and cannot edit permissions or enrollments.

## Admin workflow

1. Create a batch with start and end dates, then activate it before students need access. The individual student form requires a batch and an access start. The batch end date is the default access cutoff; an optional earlier student cutoff can shorten it. CSV imports accept `full_name,email,phone` columns (phone optional), are atomic, and support up to 1,000 rows; assign those students to batches after import.
2. Assign students to one or more batches. Enrollment has a start timestamp, optional earlier cutoff and active/suspended/revoked status. Editing the batch end date automatically changes the effective cutoff for its students. Removing access preserves the membership and leaving timestamp.
3. On Materials, add a Google Drive/HTTPS link and choose its batch and release window in one form. Or upload a private file up to 4 MB, then complete the same publishing form. Materials can have an optional module/section label; courses and course restrictions are not part of the active version 1 UI. Publishing saves the material and batch release together in one database transaction; a future release is scheduled and its URL is withheld until it opens. Use Publish to batch again for another batch, edit a release window, unpublish from one batch, or hide the material everywhere.
4. Students open Mock interviews, choose a date in the month calendar, select an available one-hour time range (starts every 15 minutes), then send a request. The default window is 09:00–18:00 Sri Lanka time for the next 60 days, independent of batches; the backend checks saved requests and the shared Google Calendar's free/busy intervals. Overlapping one-hour interviews cannot be reserved. Shared Google Calendar events appear as Busy date markers and time ranges without titles or attendee details. Admin accepts or rejects each request. Accepting creates a Google Calendar event on the dedicated LihaTech organizer account's primary calendar, invites the configured interviewer and the student, and generates a Google Meet link automatically. Students can withdraw pending requests or cancel future confirmed interviews; cancellation removes the Calendar event and sends guest updates. Admin can cancel an interview and record completed/no-show status, score, student-visible feedback and separate internal notes.
5. Invite, revoke or deactivate admins. All active admins can invite another admin. The last active admin cannot be removed. Share the portal URL manually; no invitation email is sent by this implementation.

The admin overview links the four active learning tasks; course/report navigation and progress charts are hidden. Audit triggers still record staff, enrollment, content and mock changes. Live-lecture scheduling and certificate-request workflows are outside this version 1 scope; existing document generation remains available.

## Material and timing limits

Server time controls enrollment and material availability. A batch end date includes that full calendar day in Sri Lanka time. Active/completed batches can allow learning access until that date; planned/paused/cancelled batches cannot. Student state refreshes every 30 seconds and on window focus; every protected operation checks current database access, even during that refresh interval.

Google Drive permissions are separate from LMS permissions. Use Restricted sharing and add the registered student email in Drive. This version does not automatically add/remove Drive permissions. A copied public Drive URL remains accessible outside the LMS, and downloaded copies cannot be revoked. Admin UI explains this limitation.

Private uploads are limited to 4 MB to fit the serverless download response limit; use Drive for larger files. Students cannot read the storage bucket or mint long-lived signed URLs. `GET /api/student/materials/{id}` verifies the Firebase token (including revocation), checks current enrollment/material access through a service-only RPC, then returns uncached file bytes. Supabase/Firebase service credentials are server-only.

## Deployment

Apply the LMS migrations in order through `supabase/migrations/20261017000000_mock_requests_calendar.sql` before deploying this frontend. The first migration intentionally fails if existing student emails are duplicated; review duplicates rather than deleting user data. These migrations do not seed records or alter existing document payloads.

The LMS migrations through the material publishing function were applied to the linked Supabase project on 13 October 2026. The mock interview migration was applied to the linked development project on 15 October 2026 and recorded in `supabase_migrations.schema_migrations`. GitHub push and cloud deployment have not been performed for these changes.

The Vite frontend and `api/index.py` ASGI function are in the same Vercel project. API rewrites precede the SPA fallback. Vercel Python support: https://vercel.com/docs/functions/runtimes/python . Keep the project configured for the Vite frontend build and `dist` output. Root `requirements.txt` includes the backend dependencies.

Keep existing `VITE_FIREBASE_*` and `VITE_SUPABASE_*` browser configuration. Configure these server environment variables for the file API:

- `FIREBASE_PROJECT_ID=lihatech-document-studio`
- `FIREBASE_SERVICE_ACCOUNT_JSON` containing the Firebase service account JSON (or application-default credentials on a separate server)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `WEB_ORIGINS` for allowed frontend origins when using a separate backend
- `GOOGLE_CALENDAR_ID=primary`, for the dedicated LihaTech organizer account
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN`, obtained by authorizing that same account with both Calendar events (`https://www.googleapis.com/auth/calendar.events`) and free/busy (`https://www.googleapis.com/auth/calendar.freebusy`) scopes and offline access
- `MOCK_INTERVIEWER_EMAIL`, the interviewer guest address
- `MOCK_FIRST_HOUR=9` and `MOCK_LAST_HOUR=18` to set the daily request window in Sri Lanka time (optional)

Enable the Google Calendar API in the OAuth project's Google Cloud console. Keep the refresh token server-side and authorize the organizer account, not the interviewer's personal account. The organizer and two guests then appear on each accepted invitation. Confirm the account's Meet license and guest/host settings with one real booking; the interviewer is invited as a guest and may need automatic co-host support later if host-only controls are required. Admin approvals remain unavailable until all calendar settings are present. A failed Meet generation leaves the request pending with an error that can be retried; a deterministic event ID prevents duplicate invitations.

Never prefix secrets with `VITE_`. The default file API uses same-origin `/api`; an explicitly configured `VITE_LMS_API_BASE_URL` overrides it. Locally run `backend/.venv/Scripts/python.exe -m uvicorn main:app --reload` from `backend`; Vite proxies `/api` to port 8000. Cloud API configuration and actual authenticated login/file delivery require deployment acceptance testing.

## Validation

- `npm run lint` and `npm run build`.
- Existing `node tests/access.mjs`, `branding.mjs`, `documentStudio.mjs`, `forms.mjs`.
- `backend/.venv/Scripts/python.exe tests/lms_api.py`: mocked HTTP checks for valid downloads, no-cache headers, denied access, invalid IDs, unverified identity and missing bearer tokens.
- `tests/lms_db_check.py`: earlier migration checks in one rollback-only transaction. Set `LMS_DB_URL`, `LMS_DB_PASSWORD` (or `LMS_DB_PASSWORD_FILE`) and install `psycopg[binary]`. Use `--existing` after applying those migrations. The old booking checks describe the pre-approval, batch-specific flow and need updating before running against the mock migration.
- `tests/mock_calendar.py` and `tests/mock_api.py`: mocked Calendar API and approval checks for invitations, automatic Meet links, retries, event cancellation and failed approval recovery.
- `node tests/lms_ui_review.mjs`: generates an isolated browser fixture; remove `lms-review.html`, `lms-review.js`, `lms-review.css` after review. No production auth bypass or live API calls. Review at desktop and 375px mobile, including materials, mock booking, enrollment forms and keyboard navigation.

Before launch, sign in with real admin and student accounts, test two batches and two student identities, check expired/suspended material access, verify deployed private downloads, then request, approve, join and cancel one real mock with the organizer, interviewer and student accounts. Real Google login, Vercel deployment, Calendar authorization and simultaneous request load tests are not confirmed by isolated UI or mocked HTTP checks.
