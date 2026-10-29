<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# LihaTech LMS Admin + Document Studio

The Document Studio is now the admin shell for LihaTech Learn. The root route is the LMS admin overview; the existing invoice, certificate, letter, and payslip tools are available under the Document Studio module.

View your app in AI Studio: https://ai.studio/apps/d429c553-12a3-4e9c-9f68-2f6eae0c9cf4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Admin routes

- `/` or `/lms` — LMS admin overview using local demo data
- `/students` — student accounts, batch assignment, access, progress, and notes operations
- `/batches` — cohort dates, courses, instructors, membership, and progress operations
- `/courses` — course, lesson, video, syllabus, project, and publishing operations
- `/lectures` — live lecture scheduling, links, materials, recordings, and status operations
- `/mock-interviews` — mentor slots, capacity, bookings, feedback, and completion operations
- `/certificate-requests` — eligibility review, approval, generation, issuance, and revocation operations
- `/documents` — Document Studio module
- `/team` — invite instructors and admins, and review active staff/pending access invites
- `/reports` — LMS operational reports
- `/invoice/*`, `/certificate/*`, `/letter/*`, `/payslip/*` — existing document workflows

## FastAPI integration seam

The frontend API helper lives in `src/lib/lmsApi.ts` and attaches the current Firebase ID token as a bearer token. Keep LMS operations in FastAPI and PDF/document rendering in this React app.

### Run the FastAPI service locally

1. Apply the Supabase migrations below.
2. In PowerShell, from the repository root:

   ```powershell
   cd backend
   py -3 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

3. Fill in `backend/.env` with the Firebase project ID, a path to a Firebase service-account JSON stored outside the repository, the Supabase project URL and secret key, and the frontend origin. Never put these server credentials in a `VITE_*` variable or commit them.
4. Start the API with `uvicorn main:app --reload --port 8000`.
5. In the frontend `.env.local`, set `VITE_LMS_API_BASE_URL="http://localhost:8000/api"` and restart Vite.

The team page creates a pending invitation without sending email. Share the app URL yourself. The invitee signs in with Google using the exact invited email; FastAPI verifies the Firebase ID token and atomically creates their active staff profile. Invites expire after seven days. Owners can invite admins or instructors; admins can invite instructors.

## Public certificate applications

`/certificate-request` is a public form accepting full name, email and completed course. It creates a separate certificate applicant ID; it never creates an LMS account or batch enrollment. Admins review these in the **Public certificate applications** section of `/certificate-requests` and use the existing certificate editor. Approval saves the PDF and sends it as an email attachment. A failed email can be retried from the list without approving again.

Apply `supabase/migrations/20261104000000_public_certificate_applications.sql` in Supabase SQL Editor after the existing migrations. These tables are private: only the authenticated admin API can read applications; public submissions go through the validated API. Configure the existing backend Firebase and Supabase server credentials, plus `HOSTINGER_SMTP_USER` (your full info@ mailbox) and `HOSTINGER_SMTP_PASSWORD` (mailbox password). Never prefix server credentials with `VITE_`.

For local development, put server settings in `backend/.env`, run `uvicorn backend.main:app --port 8000`, then `npm run dev` in another terminal. Vite proxies `/api` to port 8000. Vercel uses the existing Python API entry point and API rewrites; add the same server settings in Vercel environment variables. Until the migration and SMTP credentials are configured, submissions/email will not work.

Checks: `npm run lint`, `npm run build`, `node tests/certificate_application_ui.mjs` (Vite running), and `.venv/Scripts/python -m unittest discover -s tests -p test_certificate_applications.py`. UI tests mock submission; email tests mock SMTP and do not send mail.

## Supabase configuration

Company settings (including compressed logo, signature, stamp, and partner images) are saved in the protected `company_settings` table and loaded after admin sign-in. Upload images in Settings and press Save; success appears only after Supabase accepts the save. The same branding is then available to authorized staff on other devices. Apply the existing Supabase migrations and configure Firebase third-party authentication before deploying this change. Browser storage is only a cache, not the shared source of truth.

Run `node tests/branding.mjs` to check branding persistence and shared-storage failure handling.

The Supabase schema for the LMS admin panel is in `supabase/migrations/`. It includes students, batches, courses, lessons, access control, lectures, mock interviews, certificate requests, document metadata, staff invitations, admin activity, and a private `document-assets` bucket for branding assets.

Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the Firebase web app values to `.env.local`. The older `VITE_SUPABASE_ANON_KEY` is supported as a fallback. Firebase handles Google sign-in; the Firebase ID token is passed to Supabase for database requests.

Enable Google in Firebase Console under **Authentication → Sign-in method** and set the support email. Add `localhost` and your deployed app domain under **Authentication → Settings → Authorized domains**.

In Google Cloud Console, use the OAuth client associated with this Firebase project. Its authorized redirect URI must include `https://lihatech-document-studio.firebaseapp.com/__/auth/handler`; add your app origins (`http://localhost:3000` and the deployed origin) as authorized JavaScript origins. If Firebase already configured its OAuth client, leave those values as they are.

In Supabase, go to **Authentication → Third-Party Auth → Add integration → Firebase** and enter project ID `lihatech-document-studio`. The local CLI config is set to that Firebase project too.

Apply pending migrations once with:

```bash
supabase db push --linked
```

Provision the first owner once by copying their Firebase UID from Firebase Console → Authentication → Users, then running this in Supabase SQL Editor with the owner's actual email and full UID:

```sql
insert into public.admin_profiles (firebase_uid, email, full_name, role)
values ('FIREBASE_UID', 'admin@lihatech.com', 'Admin Name', 'owner');
```

Only the first owner needs manual SQL setup. Additional instructors/admins are added from the Team page. The admin profile and RLS policies restrict database access to active Firebase UIDs. Generated certificates remain on-demand PDFs; the database stores their metadata rather than PDF blobs.
