# Deployment and security operations

## Active stack

Static HTML, CSS, JavaScript ES modules, Bootstrap 5.3.3 RTL and Supabase JS 2.49.8. PostgreSQL owns validation/authorization. Supabase supplies Authentication and private Storage. The preserved `app/`, `db/` and `worker/` directories are historical drafts and are excluded from the static runtime.

## Configuration

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `APP_URL` in the build environment, or locally in ignored `.env.local`. `APP_URL` is the frontend origin used for password recovery. Do not include trailing application routes. The generated browser config contains only the project URL, publishable key and app URL. It contains no privileged credentials.

Use `npm ci`, `npm run build`, `npm test`, `npm run check`. Publish only `dist/`, not the project source, `.env.local`, tests, migrations, node_modules or legacy application directories. Sites packaging retains source separately and builds the deployment archive from the pushed commit.

Do not reuse stale build output from a server framework in `dist/`. The static build verifies and replaces only its own deployment directory within this project. Database and uploaded files remain in Supabase independently of static releases.

## Supabase setup

1. Apply versioned migrations in order using the Supabase connector or CLI. Local filenames match the hosted migration versions; do not replay already-applied migrations.
2. Create verified users through Supabase Authentication; no public signup screen is implemented.
3. Set Auth Site URL to the deployed frontend origin. Add the exact local/production password recovery redirect `ORIGIN/?reset=1` to the redirect allowlist. Keep email confirmation enabled. Disable new user signups if the company requires administrator-created accounts only.
4. Enable leaked-password protection where the Supabase plan supports it. The first hosted security review found this setting disabled. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
5. The initial company and manager were provisioned explicitly for the user-specified verified account. Further users need an active membership and role in the access screen; the UI never grants access from signup metadata.

Auth dashboard settings are separate from PostgreSQL migrations. The repository's `supabase/config.toml` configures a local Supabase instance, not the hosted project's settings. Password-recovery email delivery and production redirect allowlisting must be checked in the hosted dashboard before relying on recovery.

## Authorization model

- All application tables have RLS enabled and explicit grants. Anonymous users cannot access company records.
- Every company row is scoped by organization. Composite foreign keys prevent connecting records across companies.
- Bank and identity attributes are in separately permissioned private-data tables. Hiding controls is only a convenience; RLS and SQL grants enforce access.
- Role administration and the member directory use security-invoker API wrappers around private elevated implementations with explicit manager checks, fixed search paths and restricted grants. Private is not an exposed Data API schema.
- Manager-only evaluation edits remain manager-only even if a forged role assignment contains an evaluation write permission.
- Payment records and audit records are append-only through normal user access. Retry submission IDs prevent duplicate payment insertion. No automatic overpayment, accrual or correction rule is imposed.
- Editable records use version checks to detect stale edits. Organization/id/audit fields cannot be reassigned by browser clients.
- Reports query the same RLS-protected tables. Source read permissions are required in addition to access to the reports screen.
- Catalog retirement prevents assigning inactive statuses to new records; it preserves existing references and does not change contract dates.

## Documents

The `rental-documents` bucket is private, with a 10 MiB limit and PDF/Word MIME allowlist. Object paths must match a real document metadata row and worker in the same company; Storage policies check document permissions. Upserts/overwrites are not allowed. Replacements create a new version.

Downloads require a user session and are delivered as blobs; Word is downloaded, and PDF preview uses a sandboxed frame. Browser file-signature checks are usability checks, not malware scanning. Treat all uploads as untrusted. There is no server-side antivirus/content-disarm service in this initial architecture.

Storage and metadata operations are not one transaction. Upload failure attempts cleanup while metadata still authorizes file deletion. Delete removes the object before metadata. A network failure can leave an incomplete record requiring retry. Do not delete metadata directly without deleting its object first. For shared-production concurrency, lifecycle processing through an Edge Function is a future improvement; do not add a service-role key to browser code to solve this.

## Verification boundaries

Local PostgreSQL tests validate schema, RLS, role escalation protection, tenant isolation, optimistic versions, exact balances, actor stamping, audit append-only behavior and Storage policy predicates against mock Storage tables. Browser tests verify actual user-facing flows against hosted Supabase using synthetic records, which are removed after verification. Security advisor results are recorded in the completion notes. Auth password recovery needs a deliverable email and configured redirect URL and is not tested by sending unsolicited recovery messages.

The hosting access policy is separate from Supabase application roles. This release preserves owner-private Sites access. Adding a staff account inside the application does not automatically grant access through that outer hosting boundary. Sharing the hosted site with staff requires an explicit audience/access change.
