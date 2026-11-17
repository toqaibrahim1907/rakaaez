# Future WordPress import

The rental schema uses UUID primary keys and typed relationships. `rental_import_mappings` stores company-scoped source system/entity/ID mappings, with uniqueness for idempotent re-imports. Do not replace internal UUIDs with WordPress IDs.

After receiving an actual export, inventory field names, post/meta types, worker-client references, statuses, attachments, timezones and monetary precision. Propose explicit mappings and resolve duplicate identities before importing. Unknown financial/date rules must remain unresolved rather than inferred from old counts or labels.

Import order: company membership and catalogs, workers and their private details, clients and private details, contracts, manually verified salary records/payments, evaluations, then private documents and legacy mappings. Preserve original payment dates and source references; do not manufacture new salary periods or balances.

Use a separate test project or approved development environment for import rehearsal, with reconciliation counts and error reports. Never run untrusted dump SQL directly. Keep import credentials outside browser bundles and Git; prefer a reviewed offline administrative import process or narrow Edge Function. No production importer has been implemented yet.
