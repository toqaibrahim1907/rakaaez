-- Connect a public worker-card request to its worker record and expose only
-- that requested worker's photo/CV metadata to staff who handle requests.
-- Apply manually in Supabase SQL Editor; this is not run by the website.

alter table public.customer_requests
  add column if not exists worker_ref text references public.workers(ref) on delete set null;

create index if not exists customer_requests_worker_ref_idx
  on public.customer_requests(worker_ref)
  where worker_ref is not null;

-- This view intentionally runs with its owner's table permissions because
-- requests_manager/admin do not have direct SELECT access to the workers table.
-- It is restricted to active request-handling staff, returns only attachment
-- metadata, and only for workers referenced by an existing customer request.
create or replace view public.request_worker_details
with (security_barrier = true)
as
select w.ref, w.name, w.photo_path, w.cv_path, w.cv_file_name
from public.workers as w
where public.employee_role() in ('super_admin', 'requests_manager', 'admin')
  and exists (
    select 1 from public.customer_requests as r
    where r.worker_ref = w.ref
  );

revoke all on public.request_worker_details from public, anon, authenticated;
grant select on public.request_worker_details to authenticated;

drop policy if exists "public submits requests" on public.customer_requests;
create policy "public submits requests" on public.customer_requests
for insert to anon, authenticated
with check (
  status = 'لم يتم التواصل'
  and assignee is null
  and internal_notes = ''
  and (
    worker_ref is null
    or exists (
      select 1 from public.published_workers as pw
      where pw.ref = worker_ref
    )
  )
);

drop policy if exists "request managers read requested worker cvs" on storage.objects;
create policy "request managers read requested worker cvs" on storage.objects
for select to authenticated
using (
  bucket_id = 'worker-cvs'
  and exists (
    select 1 from public.request_worker_details as d
    where d.cv_path = storage.objects.name
  )
);

drop policy if exists "request managers read requested worker photos" on storage.objects;
create policy "request managers read requested worker photos" on storage.objects
for select to authenticated
using (
  bucket_id = 'worker-photos'
  and exists (
    select 1 from public.request_worker_details as d
    where d.photo_path = storage.objects.name
  )
);

comment on column public.customer_requests.worker_ref is 'Worker card reference chosen by the customer; links the request to its private CV and photo for staff follow-up.';
comment on view public.request_worker_details is 'Limited attachment metadata for request-handling staff; does not expose CVs publicly.';
