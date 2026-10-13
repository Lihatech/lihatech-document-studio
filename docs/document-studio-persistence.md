# Document Studio persistence audit

Document Studio records now use Supabase, separate from LMS tables. Invoices, certificates, letters, payslips, clients, programmes, employee profiles and activity entries share one registry and retain their existing JSON document payloads and layouts. Saving documents and their activity entries commits atomically. Removal archives records; document numbers remain reserved. Invoice generation includes archived numbers so it does not recycle them. CSV import requires actual client names and amounts instead of inventing defaults. Revision checks reject stale edits and duplicate invoice/certificate numbers instead of silently overwriting another device.

## Editable shared data

Certificate category, partner institute and saved programme dropdowns provide Add new option. Categories and partner profiles live in company settings; programmes live in the registry. Company branding, uploaded logos, signatures, stamps, tax/contact/bank preferences, invoice service suggestions and per-type letter defaults are shared settings. Invoice drafts are private to the signed-in Firebase UID and saved remotely. A draft uses last-save-wins when the same user opens it on multiple devices; document and settings saves have conflict checks.

Removed automatically seeded documents, clients, courses and employee identities, fabricated financial/contact defaults, surname rewriting and the unused CertificatePDF component. Shared save/archive helpers and SavedOptionSelect remove repeated persistence and dropdown code. UI navigation, templates, print dimensions and the active PDF export path remain in place.

Stable document layout code, built-in certificate wording/categories, field enumerations, calculations and official bundled branding remain shipped code. These are template/application definitions, not customer records. User-added categories and settings override or extend the shipped defaults. Template/legal wording was not rewritten during this audit.

## Existing browser records

Old browser data is not deleted or automatically uploaded: earlier app versions seeded sample records. The legacy import banner and its actions have been removed from the interface. Document Studio loads records from the shared registry; any old browser data remains untouched in the original browser.

## Deployment and validation

Apply both 20261013 migrations before deploying the frontend. They use the existing company_settings table and has_admin_access function; staff approval and Firebase/Supabase authentication rules remain in force. No LMS schema or modules change.

Run npm run lint, npm run build, node tests/access.mjs, node tests/branding.mjs and node tests/documentStudio.mjs and node tests/forms.mjs. The transaction-only database checks in supabase/tests/document_studio.sql verify permissions, atomic rollback, revisions, number uniqueness, archival, case-insensitive reusable options, settings conflicts and private drafts. Test fixture changes are rolled back. Database tests require a privileged test connection and an existing active owner profile.

A later module UI review tested desktop and mobile navigation, dark contrast and keyboard drawer behavior using an isolated temporary fixture (see document-studio-ui.md). Actual authenticated writes and exported PDFs were not exercised in that UI review. Verify branding in each exported document, invoice draft restoration and save/edit/archive on two signed-in devices before treating the deployment as fully acceptance-tested.
