begin;
-- Explicit public snapshot; no links or read privileges on private source assets.
create table public.login_branding (
  organization_id uuid primary key references public.organizations(id),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 120),
  name_en text not null default '' check (char_length(name_en)<=120),
  primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_png text check (octet_length(logo_png)<=400000 and logo_png ~ '^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$'),
  favicon_png text check (octet_length(favicon_png)<=40000 and favicon_png ~ '^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$'),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.login_branding enable row level security;
revoke all on public.login_branding from public,anon,authenticated;
grant select (name_ar,name_en,primary_color,secondary_color,logo_png,favicon_png) on public.login_branding to anon;
grant select,insert,update on public.login_branding to authenticated;
create policy login_branding_public_read on public.login_branding for select to anon using (published);
create policy login_branding_manager_read on public.login_branding for select to authenticated using (private.is_manager(organization_id));
create policy login_branding_manager_insert on public.login_branding for insert to authenticated with check (private.is_manager(organization_id));
create policy login_branding_manager_update on public.login_branding for update to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));
create trigger login_branding_stamp before insert or update on public.login_branding for each row execute function private.identity_stamp();
create trigger login_branding_audit after insert or update on public.login_branding for each row execute function private.identity_audit();
commit;
