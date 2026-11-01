-- Reapply the narrow database/storage permissions needed to save CV uploads
-- as unpublished worker drafts. Admins still cannot publish or edit content.

grant select, insert, update, delete on public.workers to authenticated;

drop policy if exists "admins read own worker profiles" on public.workers;
create policy "admins read own worker profiles" on public.workers
  for select to authenticated
  using (public.employee_role() = 'admin' and created_by = auth.uid());

drop policy if exists "admins insert own worker drafts" on public.workers;
create policy "admins insert own worker drafts" on public.workers
  for insert to authenticated
  with check (public.employee_role() = 'admin' and created_by = auth.uid() and publication = 'مسودة');

drop policy if exists "admins update own worker drafts" on public.workers;
create policy "admins update own worker drafts" on public.workers
  for update to authenticated
  using (public.employee_role() = 'admin' and created_by = auth.uid() and publication = 'مسودة')
  with check (public.employee_role() = 'admin' and created_by = auth.uid() and publication = 'مسودة');

drop policy if exists "admins upload private cvs" on storage.objects;
create policy "admins upload private cvs" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'worker-cvs'
    and public.employee_role() = 'admin'
    and storage.extension(name) = 'pdf'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admins upload worker photos" on storage.objects;
create policy "admins upload worker photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'worker-photos'
    and public.employee_role() = 'admin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
