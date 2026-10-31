-- Add CV portrait and recruitment price to worker cards.
alter table public.workers add column if not exists photo_path text;
alter table public.workers add column if not exists total_recruitment_cost numeric(12,2);

create or replace view public.published_workers as
  select ref,nationality,profession,service,availability,age,experience,languages,skills,name,photo_path,total_recruitment_cost
  from public.workers where publication='منشورة' and availability='متاحة';
revoke all on public.published_workers from public;
grant select on public.published_workers to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('worker-photos','worker-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.is_published_worker_photo(object_name text)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workers where photo_path=object_name and publication='منشورة' and availability='متاحة') $$;
revoke all on function public.is_published_worker_photo(text) from public;
grant execute on function public.is_published_worker_photo(text) to anon,authenticated;

drop policy if exists "published worker photos are visible" on storage.objects;
create policy "published worker photos are visible" on storage.objects for select to anon,authenticated
using(bucket_id='worker-photos' and public.is_published_worker_photo(name));
drop policy if exists "worker managers read worker photos" on storage.objects;
create policy "worker managers read worker photos" on storage.objects for select to authenticated
using(bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "worker managers upload worker photos" on storage.objects;
create policy "worker managers upload worker photos" on storage.objects for insert to authenticated
with check(bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "worker managers delete worker photos" on storage.objects;
create policy "worker managers delete worker photos" on storage.objects for delete to authenticated
using(bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
