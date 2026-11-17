begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200), created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=200)
);
create table public.organization_members (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 user_id uuid not null references public.profiles(id), is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(organization_id,user_id), unique(organization_id,id)
);
create table public.roles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check(code ~ '^[a-z][a-z0-9_-]{1,40}$'), name text not null check(length(trim(name)) between 1 and 80),
 is_system boolean not null default false, unique(organization_id,code), unique(organization_id,id)
);
create table public.permissions (code text primary key, module text not null, description text not null);
insert into public.permissions(code,module,description)
select 'rental.'||area||'.'||action,'rental',area||' '||action
from unnest(array['workers','workers_private','clients','clients_private','contracts','salaries','evaluations','documents']) area
cross join unnest(array['read','write']) action;
insert into public.permissions values
 ('rental.reports.read','rental','Reports'),('rental.settings.write','rental','Settings'),
 ('rental.access.write','rental','Manage access'),('rental.audit.read','rental','Audit'),('rental.import.write','rental','Import');
create table public.member_roles (
 organization_id uuid not null references public.organizations(id), member_id uuid not null, role_id uuid not null,
 primary key(member_id,role_id),
 foreign key(organization_id,member_id) references public.organization_members(organization_id,id) on delete cascade,
 foreign key(organization_id,role_id) references public.roles(organization_id,id) on delete cascade
);
create table public.role_permissions (
 organization_id uuid not null references public.organizations(id), role_id uuid not null,
 permission_code text not null references public.permissions(code), primary key(role_id,permission_code),
 foreign key(organization_id,role_id) references public.roles(organization_id,id) on delete cascade
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 actor_id uuid references auth.users(id), action text not null, entity_type text not null,
 entity_id uuid, occurred_at timestamptz not null default now()
);
create index membership_user on public.organization_members(user_id,organization_id);
create index member_roles_lookup on public.member_roles(organization_id,member_id);
create index audit_org_time on public.audit_events(organization_id,occurred_at desc);

create function private.is_member(org uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=(select auth.uid()) and m.is_active) $$;
create function private.is_manager(org uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.organization_members m join public.member_roles mr on mr.member_id=m.id and mr.organization_id=m.organization_id join public.roles r on r.id=mr.role_id and r.organization_id=m.organization_id where m.organization_id=org and m.user_id=(select auth.uid()) and m.is_active and r.code='manager' and r.is_system) $$;
create function private.has_permission(org uuid, perm text) returns boolean language sql stable security definer set search_path=''
as $$ select private.is_manager(org) or exists(select 1 from public.organization_members m join public.member_roles mr on mr.member_id=m.id and mr.organization_id=m.organization_id join public.role_permissions rp on rp.role_id=mr.role_id and rp.organization_id=m.organization_id where m.organization_id=org and m.user_id=(select auth.uid()) and m.is_active and rp.permission_code=perm) $$;
revoke all on function private.is_member(uuid),private.is_manager(uuid),private.has_permission(uuid,text) from public,anon;
grant execute on function private.is_member(uuid),private.is_manager(uuid),private.has_permission(uuid,text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.organizations,public.profiles,public.organization_members,public.roles,public.permissions,public.member_roles,public.role_permissions,public.audit_events from anon,authenticated;
grant select on public.organizations,public.profiles,public.organization_members,public.roles,public.permissions,public.member_roles,public.role_permissions,public.audit_events to authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy organization_read on public.organizations for select to authenticated using(private.is_member(id));
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy member_read on public.organization_members for select to authenticated using(user_id=(select auth.uid()) or private.is_manager(organization_id));
create policy role_read on public.roles for select to authenticated using(private.is_member(organization_id));
create policy permission_read on public.permissions for select to authenticated using((select auth.uid()) is not null);
create policy member_role_read on public.member_roles for select to authenticated using(private.is_manager(organization_id) or exists(select 1 from public.organization_members m where m.id=member_id and m.user_id=(select auth.uid())));
create policy role_permission_read on public.role_permissions for select to authenticated using(private.is_member(organization_id));
create policy audit_read on public.audit_events for select to authenticated using(private.has_permission(organization_id,'rental.audit.read'));

create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')); return new; end $$;
revoke all on function private.create_profile() from public,anon,authenticated;
create trigger create_profile after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create function public.rental_context() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare org uuid; output jsonb;
begin
 select organization_id into org from public.organization_members where user_id=auth.uid() and is_active order by created_at limit 1;
 if org is null then return jsonb_build_object('organization_id',null,'permissions','[]'::jsonb,'manager',false); end if;
 select jsonb_build_object('organization_id',org,'organization_name',(select name from public.organizations where id=org),'manager',private.is_manager(org),
 'permissions',coalesce((select jsonb_agg(code) from public.permissions where private.has_permission(org,code)),'[]'::jsonb)) into output;
 return output;
end $$;
revoke all on function public.rental_context() from public,anon;
grant execute on function public.rental_context() to authenticated;

create function public.rental_save_role(p_organization_id uuid,p_code text,p_name text,p_permissions text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare role_uuid uuid;
begin
 if not private.is_manager(p_organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_organization_id for update;
 if p_code='manager' or exists(select 1 from unnest(p_permissions) p where p in ('rental.access.write','rental.evaluations.write') or not exists(select 1 from public.permissions where code=p)) then raise exception 'Reserved role or permission'; end if;
 insert into public.roles(organization_id,code,name,is_system) values(p_organization_id,p_code,p_name,p_code='employee') on conflict(organization_id,code) do update set name=excluded.name returning id into role_uuid;
 delete from public.role_permissions where role_id=role_uuid;
 insert into public.role_permissions(organization_id,role_id,permission_code) select p_organization_id,role_uuid,p from (select distinct unnest(p_permissions) p) x;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id) values(p_organization_id,auth.uid(),'role_save','roles',role_uuid);
 return role_uuid;
end $$;
create function public.rental_assign_member(p_organization_id uuid,p_user_id uuid,p_role_id uuid,p_active boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare member_uuid uuid;
begin
 if not private.is_manager(p_organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_organization_id for update;
 if p_user_id=auth.uid() then raise exception 'Cannot change your own membership'; end if;
 if not exists(select 1 from public.roles where id=p_role_id and organization_id=p_organization_id) then raise exception 'Invalid role'; end if;
 insert into public.organization_members(organization_id,user_id,is_active) values(p_organization_id,p_user_id,p_active) on conflict(organization_id,user_id) do update set is_active=excluded.is_active returning id into member_uuid;
 delete from public.member_roles where member_id=member_uuid;
 insert into public.member_roles values(p_organization_id,member_uuid,p_role_id);
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id) values(p_organization_id,auth.uid(),'member_assign','organization_members',member_uuid);
end $$;
create function public.rental_member_directory(p_organization_id uuid) returns table(user_id uuid,email text,display_name text,is_active boolean,role_id uuid) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_manager(p_organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select m.user_id,u.email::text,p.display_name,m.is_active,mr.role_id from public.organization_members m join auth.users u on u.id=m.user_id join public.profiles p on p.id=m.user_id left join public.member_roles mr on mr.member_id=m.id where m.organization_id=p_organization_id;
end $$;
revoke all on function public.rental_save_role(uuid,text,text,text[]),public.rental_assign_member(uuid,uuid,uuid,boolean),public.rental_member_directory(uuid) from public,anon;
grant execute on function public.rental_save_role(uuid,text,text,text[]),public.rental_assign_member(uuid,uuid,uuid,boolean),public.rental_member_directory(uuid) to authenticated;
commit;
