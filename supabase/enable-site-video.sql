-- Run once in Supabase SQL Editor to allow site video uploads up to 50 MiB.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
where id = 'site-media';
