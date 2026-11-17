drop policy website_published_photo_read on storage.objects; create policy website_published_photo_read on storage.objects for select to anon,authenticated using (bucket_id='website-worker-photos' and exists (select 1 from public.website_published_workers w where w.photo_path=objects.name and split_part(objects.name,'/',1)=w.organization_id::text));

