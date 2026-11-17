# Verification record — 3 November 2026

## Automated checks

17 checks passed using Node's built-in test runner, PGlite PostgreSQL and a lightweight test DOM:

- Manager write access and server-stamped actor identity.
- Restricted employee reads/writes and private-bank-data isolation.
- Cross-organization visibility and foreign key isolation.
- Blocked role escalation and manager-only evaluations, including a forged evaluation permission.
- Immutable company scope and optimistic edit versions.
- Exact salary-payment subtraction, duplicate submission protection and immutable payment history.
- Storage policy predicates requiring matching document metadata and organization permissions.
- Immediate access revocation.
- Anonymous denial and audit log integrity.
- Exact decimal UI balance arithmetic and CSV formula/quote escaping.
- Separate currency totals, paid/unpaid display states and protected manager role administration.
- Rendering all rental views, preventing injected HTML and filtering worker results.

`node scripts/check-static.mjs` passed JavaScript syntax and frontend-key checks. The static build completed with a publishable key only.

## Hosted checks

All five migrations were applied to Supabase project `bxpceusjvjofnofblwju`. The initial manager was explicitly assigned to the user-specified verified Auth account. A transaction-scoped employee test on the hosted database returned no visible workers/private records, `manager=false`, and no permissions; the transaction was rolled back.

The manager signed in personally through the local frontend. Browser checks against hosted Supabase verified worker create/edit, client creation, contract creation with manually entered dates/status, manual salary creation, payment recording, manager evaluation, PDF upload/download, Word upload as a new document version, report totals and report date filtering. The test contract amount was 1200.50 SAR; the salary test was 100.10 SAR with a 30.05 SAR payment and 70.05 SAR remaining.

The user authorized cleanup. Temporary PDF/Word objects and metadata were removed through the authenticated application; the synthetic worker/client/contract/salary/payment/evaluation rows were then removed with narrowly scoped administrative cleanup. The hosted database confirmed zero test workers, zero test document metadata and zero objects in the rental bucket. Audit events were retained.

The dashboard and sidebar were checked at a 390 × 844 mobile viewport, then the normal viewport was restored. Table contents scroll within their panels, and the mobile sidebar opens using the menu control.

The security advisor reported no application RLS or publicly exposed elevated-function warnings after private administrative helpers were isolated behind invoker wrappers. It still reported leaked-password protection disabled in hosted Auth. Enable it where supported: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Performance advice for unused indexes and additional foreign-key indexes is informational on this empty dataset and does not change authorization.

## Remaining business/configuration boundaries

Automatic salary accrual, prorating, adjustments, payment corrections, contract-date extensions and automated status transitions remain unimplemented pending business approval. Password recovery requires the deployed URL to be allowed in Supabase Auth; recovery email delivery was not tested. Uploaded file signature checks are client-side convenience checks, not a malware scanning service. The host's owner-private audience remains separate from Supabase employee permissions.
