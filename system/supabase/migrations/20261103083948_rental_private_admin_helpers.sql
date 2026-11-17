begin;
-- Keep elevated implementations outside the Data API schema. Public entry points
-- are invokers; every private implementation explicitly verifies manager access.
alter function public.rental_save_role(uuid,text,text,text[]) set schema private;
alter function public.rental_assign_member(uuid,uuid,uuid,boolean) set schema private;
alter function public.rental_member_directory(uuid) set schema private;
create function public.rental_save_role(p_organization_id uuid,p_code text,p_name text,p_permissions text[]) returns uuid language sql security invoker set search_path=''
as $$ select private.rental_save_role(p_organization_id,p_code,p_name,p_permissions) $$;
create function public.rental_assign_member(p_organization_id uuid,p_user_id uuid,p_role_id uuid,p_active boolean default true) returns void language sql security invoker set search_path=''
as $$ select private.rental_assign_member(p_organization_id,p_user_id,p_role_id,p_active) $$;
create function public.rental_member_directory(p_organization_id uuid) returns table(user_id uuid,email text,display_name text,is_active boolean,role_id uuid) language sql stable security invoker set search_path=''
as $$ select * from private.rental_member_directory(p_organization_id) $$;
revoke all on function public.rental_save_role(uuid,text,text,text[]),public.rental_assign_member(uuid,uuid,uuid,boolean),public.rental_member_directory(uuid) from public,anon;
grant execute on function public.rental_save_role(uuid,text,text,text[]),public.rental_assign_member(uuid,uuid,uuid,boolean),public.rental_member_directory(uuid) to authenticated;
commit;
