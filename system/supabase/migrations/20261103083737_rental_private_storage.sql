begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('rental-documents','rental-documents',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create function private.document_access(object_name text,operation text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.rental_documents d join public.rental_workers w on w.id=d.worker_id and w.organization_id=d.organization_id where d.object_path=object_name and d.bucket_id='rental-documents' and private.has_permission(d.organization_id,'rental.documents.'||operation))
$$;
revoke all on function private.document_access(text,text) from public,anon;
grant execute on function private.document_access(text,text) to authenticated;
create policy rental_object_read on storage.objects for select to authenticated using(bucket_id='rental-documents' and private.document_access(name,'read'));
create policy rental_object_insert on storage.objects for insert to authenticated with check(bucket_id='rental-documents' and private.document_access(name,'write'));
create policy rental_object_delete on storage.objects for delete to authenticated using(bucket_id='rental-documents' and private.document_access(name,'write'));
-- No UPDATE policy: object replacement always creates a new document version.
commit;
