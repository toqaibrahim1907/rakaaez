-- Additive, safe-to-review migration for retaining source CV values beside
-- normalized values. This file is not run automatically by the application.
-- Existing app-facing columns remain unchanged for compatibility.
alter table public.workers
  add column if not exists nationality_raw text not null default '',
  add column if not exists religion_raw text not null default '',
  add column if not exists job_raw text not null default '',
  add column if not exists salary_raw text not null default '',
  add column if not exists age_raw text not null default '',
  add column if not exists experience_raw text not null default '',
  add column if not exists passport_number_raw text not null default '',
  add column if not exists salary_value numeric(12,2),
  add column if not exists age_value integer,
  add column if not exists experience_value numeric(5,2);

comment on column public.workers.nationality_raw is 'Original nationality value returned by the CV extractor; private review data.';
comment on column public.workers.religion_raw is 'Original explicitly extracted religion; private review data, never inferred.';
comment on column public.workers.job_raw is 'Original job title returned by the CV extractor.';
comment on column public.workers.salary_raw is 'Original salary value returned by the CV extractor.';
comment on column public.workers.age_raw is 'Original age value returned by the CV extractor.';
comment on column public.workers.experience_raw is 'Original experience value returned by the CV extractor.';
comment on column public.workers.passport_number_raw is 'Original passport value returned by the CV extractor; highly sensitive and private.';
comment on column public.workers.salary_value is 'Numeric version of the reviewed salary field.';
comment on column public.workers.age_value is 'Numeric version of the reviewed age field.';
comment on column public.workers.experience_value is 'Numeric years version of the reviewed experience field.';

-- Do not add these fields to public.published_workers. The view intentionally
-- selects an explicit safe list of columns and must remain unchanged.
