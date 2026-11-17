insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('website-worker-cvs','website-worker-cvs',false,15728640,array['application/pdf']),
('website-worker-photos','website-worker-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy website_files_read on storage.objects for select to authenticated using (
 bucket_id in ('website-worker-cvs','website-worker-photos') and exists (
 select 1 from public.website_workers w where split_part(name,'/',1)=w.organization_id::text
 and split_part(name,'/',2)=w.id::text and private.has_permission(w.organization_id,'rental.website.read')));
create policy website_files_insert on storage.objects for insert to authenticated with check (
 bucket_id in ('website-worker-cvs','website-worker-photos') and exists (
 select 1 from public.website_workers w where split_part(name,'/',1)=w.organization_id::text
 and split_part(name,'/',2)=w.id::text and private.has_permission(w.organization_id,'rental.website.write')));
create policy website_files_delete on storage.objects for delete to authenticated using (
 bucket_id in ('website-worker-cvs','website-worker-photos') and exists (
 select 1 from public.website_workers w where split_part(name,'/',1)=w.organization_id::text
 and split_part(name,'/',2)=w.id::text and private.has_permission(w.organization_id,'rental.website.write')));

