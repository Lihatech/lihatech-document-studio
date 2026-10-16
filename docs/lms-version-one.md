# LMS version 1

The admin and student portals now share this React/Vite project, Firebase Google login and Supabase. The student layout is adapted from the existing `lihatech-lms` interface; its demo authentication and sample records are not used. Existing Document Studio routes and exports stay in the admin portal.

## Roles and login

Students sign in with Google using the same email registered by the admin. There is no separate LMS username or password to create or distribute. On first Google sign-in, Firebase supplies the identity and the LMS links it to the registered student record; an unregistered address receives a contact-admin message.

`lms_session` accepts only a verified Firebase identity from the configured LihaTech Firebase project. Active owner/admin records map to the single admin experience; the existing owner database value is retained for compatibility, not offered as a separate version 1 role. Admin email approval remains in the admin branch of the frontend login. Admin invitations require a LihaTech email. Registered students can use personal verified Google addresses. Their first login binds their UID to the registered email; changing that email through admin management clears the old identity link. Unregistered users receive a contact-admin message. Students always render the student layout even if they type an admin/document URL. Instructors have no version 1 permissions; instructor workflows and device restrictions are deferred.

The database replaces broad instructor access with owner/admin-only staff access. Student-facing RPCs return safe projections: own enrollment, allowed material metadata and own bookings/feedback. Students have no direct reads of internal notes, staff/student tables or Document Studio data and cannot edit permissions or enrollments.

## Admin workflow

1. Create a batch with its course/programme name, start and end dates, certificate type and optional offer type/role/department. Access opens automatically at midnight on the start date and closes after the end date in Kolhapur time (IST); planned and active batches follow these dates. Paused, completed and cancelled batches grant no material access. Existing batches need their course name completed before document requests can be submitted.
2. Add a student using their registered Google email and batch, or import an email-only CSV into a selected batch. Creation and assignment are atomic. Students complete their own profile at first sign-in. Each student has one current assignment; assigning another batch revokes the old membership while preserving history. Start and end dates come from the batch, including later date changes. Administrators can suspend or revoke a student's access. Completed, cancelled, paused and expired batches are excluded from new-assignment and publishing dropdowns.
3. On Materials, add a Google Drive/HTTPS link and choose its batch and release window in one form. Or upload a private file up to 4 MB, then complete the same publishing form. Materials can have an optional module/section label; courses and course restrictions are not part of the active version 1 UI. Publishing saves the material and batch release together in one database transaction; a future release is scheduled and its URL is withheld until it opens. Use Publish to batch again for another batch, edit a release window, unpublish from one batch, or hide the material everywhere.
4. Students open Mock interviews, choose a date in the month calendar, select an available one-hour time range (starts every 15 minutes), then send a request. The default window is 09:00–18:00 Kolhapur time (IST) for the next 60 days, independent of batches; the backend checks saved requests and the shared Google Calendar's free/busy intervals. Overlapping one-hour interviews cannot be reserved. Shared Google Calendar events appear as Busy date markers and time ranges without titles or attendee details. Admin accepts or rejects each request. Accepting creates a Google Calendar event on the dedicated LihaTech organizer account's primary calendar, invites the configured interviewer and the student, and generates a Google Meet link automatically. Students can withdraw pending requests or cancel future confirmed interviews; cancellation removes the Calendar event and sends guest updates. Admin can cancel an interview and record completed/no-show status, score, student-visible feedback and separate internal notes.
5. Invite, revoke or deactivate admins. All active admins can invite another admin. The last active admin cannot be removed. Share the portal URL manually; no invitation email is sent by this implementation.

The admin overview links the active learning tasks; course/report navigation and progress charts are hidden. Audit triggers still record staff, enrollment, content and mock changes. Students request certificates or configured offer letters from Documents. Names, programme, dates and offer details are derived on the server from their profile and single batch; client-supplied official fields are ignored. Students can submit/update correction suggestions on open requests. Admins can correct official request details, approve or decline, then open the existing Document Studio builder with the corrected details prefilled. Salary/stipend terms, issue date and final design remain under admin review. Submitted requests preserve a snapshot instead of changing when a profile or batch is edited later. Staff share the finished document manually and then mark the request shared. Live-lecture scheduling remains outside this version 1 scope.

## Material and timing limits

Server time controls enrollment and material availability. A batch end date includes that full calendar day in Kolhapur time (IST). Active/completed batches can allow learning access until that date; planned/paused/cancelled batches cannot. Student state refreshes every 30 seconds and on window focus; every protected operation checks current database access, even during that refresh interval. On first sign-in, students confirm their name and may share optional contact, address, college or workplace details. They can edit these from My profile; admins see the shared details in the student record. Apply `20261019000000_student_profile.sql` before deploying the profile UI.

Google Drive permissions are separate from LMS permissions. Use Restricted sharing and add the registered student email in Drive. This version does not automatically add/remove Drive permissions. A copied public Drive URL remains accessible outside the LMS, and downloaded copies cannot be revoked. Admin UI explains this limitation.

Private uploads are limited to 4 MB to fit the serverless download response limit; use Drive for larger files. Students cannot read the storage bucket or mint long-lived signed URLs. `GET /api/student/materials/{id}` verifies the Firebase token (including revocation), checks current enrollment/material access through a service-only RPC, then returns uncached file bytes. Supabase/Firebase service credentials are server-only.

## Deployment

Apply the LMS migrations in order through `supabase/migrations/20261017000000_mock_requests_calendar.sql` before deploying this frontend. The first migration intentionally fails if existing student emails are duplicated; review duplicates rather than deleting user data. These migrations do not seed records or alter existing document payloads.

For student document requests, also apply `supabase/migrations/20261020000000_student_document_requests.sql`. The student form and admin queue call the new RPCs; they will show a missing-function error until this migration is applied. Requests store the student's supplied details and review status, while finished certificates and letters remain in the existing Document Studio registry.

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
- `MOCK_FIRST_HOUR=9` and `MOCK_LAST_HOUR=18` to set the daily request window in Kolhapur time (IST; optional)

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

## Batch/document workflow rollout

Apply `20261020000000_student_document_requests.sql` if it has not already been applied, then `20261021000000_batch_document_workflow.sql`. The latter retains one current membership per student, revokes extra memberships without deleting their history, aligns live access dates with batch dates, and adds the batch document fields and protected RPCs. Review any students who previously had multiple memberships. No live Supabase migration is applied by the local checks.

Search and filters cover students, batches, materials, mock records, admins, student material libraries and document queues/history. Document archives retain search and add certificate/letter type, payslip month and exact invoice payment-status filters. Material display order is removed from forms; student materials sort by title.

Checks: `node tests/batch_workflow.mjs` verifies batch boundaries and read-only request UI; `supabase/tests/batch_document_workflow.sql` verifies assignment, automatic dates and document permissions in a rollback transaction. `tests/batch_workflow_db.mjs` can run all migrations and these SQL checks in an isolated PGlite installation supplied through `PGLITE_MODULE` (not an application dependency).
