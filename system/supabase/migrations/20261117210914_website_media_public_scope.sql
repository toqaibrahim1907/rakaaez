drop policy website_media_published_read on storage.objects; create policy website_media_published_read on storage.objects for select to anon,authenticated using (bucket_id='website-site-media' and exists(select 1 from public.website_published_content c where c.images->>'hero'=objects.name and split_part(objects.name,'/',1)=c.organization_id::text));

