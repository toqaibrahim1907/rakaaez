-- Adds limited administrators who can manage worker CVs, customer requests,
-- and complaints, without access to site content or employee management.
alter table public.employee_profiles
  drop constraint if exists employee_profiles_role_check;
alter table public.employee_profiles
  add constraint employee_profiles_role_check
  check (role in ('super_admin','content_manager','workers_manager','requests_manager','admin'));
create or replace view public.staff_directory as
  select user_id,full_name,role,active from public.employee_profiles;
revoke all on public.staff_directory from public;
grant select on public.staff_directory to authenticated;

drop policy if exists "worker managers read all workers" on public.workers;
create policy "worker managers read all workers" on public.workers for select to authenticated
  using (public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "admins read own worker profiles" on public.workers;
create policy "admins read own worker profiles" on public.workers for select to authenticated
  using (public.employee_role()='admin' and created_by=auth.uid());
drop policy if exists "worker managers insert workers" on public.workers;
create policy "worker managers insert workers" on public.workers for insert to authenticated
  with check (public.employee_role() in ('super_admin','workers_manager') and created_by = auth.uid());
drop policy if exists "admins insert own worker drafts" on public.workers;
create policy "admins insert own worker drafts" on public.workers for insert to authenticated
  with check (public.employee_role()='admin' and created_by=auth.uid() and publication='مسودة');
drop policy if exists "worker managers update workers" on public.workers;
create policy "worker managers update workers" on public.workers for update to authenticated
  using (public.employee_role() in ('super_admin','workers_manager'))
  with check (public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "admins update own worker drafts" on public.workers;
create policy "admins update own worker drafts" on public.workers for update to authenticated
  using (public.employee_role()='admin' and created_by=auth.uid() and publication='مسودة')
  with check (public.employee_role()='admin' and created_by=auth.uid() and publication='مسودة');
drop policy if exists "worker managers delete workers" on public.workers;
create policy "worker managers delete workers" on public.workers for delete to authenticated
  using (public.employee_role() in ('super_admin','workers_manager'));

drop policy if exists "request managers read requests" on public.customer_requests;
create policy "request managers read requests" on public.customer_requests for select to authenticated
  using (public.employee_role() in ('super_admin','requests_manager','admin'));
drop policy if exists "request managers update requests" on public.customer_requests;
create policy "request managers update requests" on public.customer_requests for update to authenticated
  using (public.employee_role() in ('super_admin','requests_manager','admin'))
  with check (public.employee_role() in ('super_admin','requests_manager','admin'));

drop policy if exists "request managers read complaints" on public.customer_complaints;
create policy "request managers read complaints" on public.customer_complaints for select to authenticated
  using (public.employee_role() in ('super_admin','requests_manager','admin'));
drop policy if exists "request managers update complaints" on public.customer_complaints;
create policy "request managers update complaints" on public.customer_complaints for update to authenticated
  using (public.employee_role() in ('super_admin','requests_manager','admin'))
  with check (public.employee_role() in ('super_admin','requests_manager','admin'));

drop policy if exists "authorized staff read private cvs" on storage.objects;
create policy "authorized staff read private cvs" on storage.objects for select to authenticated
  using (bucket_id='worker-cvs' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "admins read own private cvs" on storage.objects;
create policy "admins read own private cvs" on storage.objects for select to authenticated
  using (bucket_id='worker-cvs' and public.employee_role()='admin' and exists(select 1 from public.workers w where w.cv_path=name and w.created_by=auth.uid()));
drop policy if exists "authorized staff upload private cvs" on storage.objects;
create policy "authorized staff upload private cvs" on storage.objects for insert to authenticated
  with check (bucket_id='worker-cvs' and public.employee_role() in ('super_admin','workers_manager') and storage.extension(name)='pdf');
drop policy if exists "admins upload private cvs" on storage.objects;
create policy "admins upload private cvs" on storage.objects for insert to authenticated
  with check (bucket_id='worker-cvs' and public.employee_role()='admin' and storage.extension(name)='pdf' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "authorized staff delete private cvs" on storage.objects;
create policy "authorized staff delete private cvs" on storage.objects for delete to authenticated
  using (bucket_id='worker-cvs' and public.employee_role() in ('super_admin','workers_manager'));

drop policy if exists "worker managers read worker photos" on storage.objects;
create policy "worker managers read worker photos" on storage.objects for select to authenticated
  using (bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "admins read own worker photos" on storage.objects;
create policy "admins read own worker photos" on storage.objects for select to authenticated
  using (bucket_id='worker-photos' and public.employee_role()='admin' and exists(select 1 from public.workers w where w.photo_path=name and w.created_by=auth.uid()));
drop policy if exists "worker managers upload worker photos" on storage.objects;
create policy "worker managers upload worker photos" on storage.objects for insert to authenticated
  with check (bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "admins upload worker photos" on storage.objects;
create policy "admins upload worker photos" on storage.objects for insert to authenticated
  with check (bucket_id='worker-photos' and public.employee_role()='admin' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "worker managers delete worker photos" on storage.objects;
create policy "worker managers delete worker photos" on storage.objects for delete to authenticated
  using (bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));

-- Site content and employee profile policies intentionally remain super-admin/content-manager only.
