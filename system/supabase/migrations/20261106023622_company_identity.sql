begin;
create table public.company_identity (
 organization_id uuid primary key references public.organizations(id),
 name_ar text not null check(char_length(btrim(name_ar)) between 1 and 120),
 name_en text not null default '' check(char_length(name_en)<=120),
 primary_color text not null default '#138b71' check(primary_color ~ '^#[0-9a-fA-F]{6}$'),
 secondary_color text not null default '#346f9f' check(secondary_color ~ '^#[0-9a-fA-F]{6}$'),
 logo_path text,
 favicon_path text,
 phone text not null default '' check(char_length(phone)<=30),
 whatsapp text not null default '' check(char_length(whatsapp)<=30),
 email text not null default '' check(char_length(email)<=254),
 address text not null default '' check(char_length(address)<=300),
 updated_at timestamptz not null default now(),
 check(logo_path is null or logo_path ~ ('^'||organization_id::text||'/logo/[0-9a-f-]{36}[.](png|jpg|webp)$')),
 check(favicon_path is null or favicon_path ~ ('^'||organization_id::text||'/favicon/[0-9a-f-]{36}[.](png|jpg|webp)$'))
);
alter table public.company_identity enable row level security;
revoke all on public.company_identity from public, anon, authenticated;
grant select,insert,update on public.company_identity to authenticated;
create policy identity_manager_read on public.company_identity for select to authenticated using (private.is_manager(organization_id));
create policy identity_manager_insert on public.company_identity for insert to authenticated with check (private.is_manager(organization_id));
create policy identity_manager_update on public.company_identity for update to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));

create function private.member_company_identity(org uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name_ar',name_ar,'name_en',name_en,'primary_color',primary_color,
   'secondary_color',secondary_color,'logo_path',logo_path,'favicon_path',favicon_path)
 from public.company_identity
 where organization_id=org and private.is_member(org)
$$;
create function public.member_company_identity(org uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.member_company_identity(org)
$$;
revoke all on function private.member_company_identity(uuid),public.member_company_identity(uuid) from public,anon;
grant execute on function private.member_company_identity(uuid),public.member_company_identity(uuid) to authenticated;

create function private.identity_stamp() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.organization_id<>new.organization_id then raise exception 'Immutable company' using errcode='23514'; end if;
 new.updated_at=clock_timestamp();
 return new;
end $$;
create function private.identity_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id)
 values(new.organization_id,auth.uid(),lower(tg_op),'company_identity',new.organization_id);
 return new;
end $$;
revoke all on function private.identity_stamp(),private.identity_audit() from public,anon,authenticated;
create trigger identity_stamp before insert or update on public.company_identity for each row execute function private.identity_stamp();
create trigger identity_audit after insert or update on public.company_identity for each row execute function private.identity_audit();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-branding','company-branding',false,2097152,array['image/png','image/jpeg','image/webp']);
create policy company_branding_read on storage.objects for select to authenticated using (
 bucket_id='company-branding' and
 case when name ~ '^[0-9a-f-]{36}/(logo|favicon)/[0-9a-f-]{36}[.](png|jpg|webp)$'
 then private.is_member(split_part(name,'/',1)::uuid)
 else false end
);
create policy company_branding_upload on storage.objects for insert to authenticated with check (
 bucket_id='company-branding' and
 case when name ~ '^[0-9a-f-]{36}/(logo|favicon)/[0-9a-f-]{36}[.](png|jpg|webp)$'
 then private.is_manager(split_part(name,'/',1)::uuid)
 else false end
);
commit;
