# Rental Management

The active application is plain HTML/CSS/JavaScript with Bootstrap RTL and Supabase. No Express, React or database server is required to run the frontend. Node is used only for static packaging and tests.

Existing React UI work remains unchanged under `app/`. Its API and Drizzle drafts are retained as migration references; they are not executed or deployed. Their original dependency manifests are saved under `legacy/`. The approved screens and styling have been ported into `web/`.

## Run locally

1. Install Node.js 22.13 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local`, set the Supabase URL and **publishable** key, and set `APP_URL`.
4. Run `npm run build`, then `npm run dev`.
5. Visit `http://127.0.0.1:5173` and sign in with an existing Supabase Auth user who has company membership.

The frontend never uses a service-role/secret key. The build rejects keys that are not publishable keys and copies only explicitly allowed public configuration into the static site. Missing configuration displays a setup screen.

If Windows resolves an invalid npm shim, invoke the installed npm CLI through Node; for this machine it is `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run build`.

## Layout

- `web/js/modules/website.js`: the initial native website content draft editor, using the system account and website permissions. It is not connected to the public website yet. The earlier `web/website-admin/` snapshot is retained for reference and is no longer linked from the system.
- The website CV extraction feature requires the Rakaaez `/api/worker-extraction` server endpoint and its server-side configuration on the system's host. The static system server does not provide this endpoint; PDF uploads and manual entry remain available, but automated extraction requires deploying or proxying that endpoint securely. Do not put its secrets in the frontend.
- `web/js/modules/rental/`: dashboard, workers, clients, documents, contracts, salaries, evaluations, archive, reports, settings and roles.
- `web/js/components/`: reusable DOM-safe UI helpers, forms, tables and Bootstrap modals.
- `web/js/data/`: field definitions, exact monetary arithmetic, RLS-scoped Supabase repository.
- `supabase/migrations/`: relational PostgreSQL schema, grants, RLS, private document policies and integrity triggers.
- `tests/`: PostgreSQL authorization, exact-money and UI regression tests.
- `docs/deployment.md`: cloud deployment, Auth configuration and verification.
- `docs/wordpress-import.md`: future legacy import design.

## Verification

Run `npm test` and `npm run check`. PostgreSQL tests use PGlite with mock Auth/Storage schemas and real PostgreSQL roles, constraints, policies, functions and triggers. They test RLS through authenticated and anonymous database roles. Hosted Supabase Storage/Auth behavior also requires integration checks; the local SQL tests do not replace those services.

No automatic salary accrual, proration, deductions, contract date changes, expiry status transitions or performance thresholds are implemented. Dates, statuses, amounts and evaluations are entered explicitly. Report arithmetic only aggregates saved data. Payment history is append-only; an adjustment/correction workflow awaits business approval. Workday values are manager-entered.

The first manager is explicitly provisioned against an existing verified Auth user. Employees have no access until assigned permissions. There is no first-visitor administrator assignment and no role trusted from browser metadata.

Supabase project: `bxpceusjvjofnofblwju`. The same static frontend can be deployed to another host using environment configuration; hosting is independent of Supabase.

