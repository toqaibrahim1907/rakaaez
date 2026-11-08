-- Private extracted CV attributes. Keep these columns out of public.published_workers.
alter table public.workers
  add column if not exists salary text not null default '',
  add column if not exists religion text not null default '',
  add column if not exists passport_number text not null default '';

comment on column public.workers.salary is 'Salary value extracted from the private worker CV; internal only.';
comment on column public.workers.religion is 'Religion extracted from the private worker CV; internal only.';
comment on column public.workers.passport_number is 'Passport number extracted from the private worker CV; internal only.';

-- Admins can upload a CV before the worker row exists. Allow them to read only
-- PDF objects in their own uid folder so Vercel can create a short-lived URL
-- for extraction without inserting an unreviewed worker record first.
drop policy if exists "admins read own pending worker cvs" on storage.objects;
create policy "admins read own pending worker cvs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'worker-cvs'
    and public.employee_role() = 'admin'
    and storage.extension(name) = 'pdf'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The selected worker image is uploaded before insert as well. Keep draft
-- photos private while allowing the uploading admin to review their own file.
drop policy if exists "admins read own worker photos by folder" on storage.objects;
create policy "admins read own worker photos by folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'worker-photos'
    and public.employee_role() = 'admin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Extraction mapping: job -> profession; worker_photo -> photo_path.
-- Existing CV and photo objects remain in the private worker-cvs / worker-photos buckets.
-- No public view change is required; published_workers excludes these CV-only fields.
