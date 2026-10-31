-- Al Rakaez Al Bashariya: initial production schema.
-- Apply in Supabase SQL editor. Never put a service_role key in the browser.
create extension if not exists pgcrypto;

create table if not exists public.employee_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('super_admin','content_manager','workers_manager','requests_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.employee_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.employee_profiles where user_id = auth.uid() and active = true $$;
revoke all on function public.employee_role() from public;
grant execute on function public.employee_role() to authenticated;
create or replace view public.staff_directory as
  select user_id,full_name,role from public.employee_profiles where active=true;
revoke all on public.staff_directory from public;
grant select on public.staff_directory to authenticated;

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  name text not null default '',
  service text not null default 'الاستقدام',
  nationality text not null default '',
  profession text not null default 'عاملة منزلية',
  age text not null default '', experience text not null default '',
  languages text not null default '', skills text not null default '',
  photo_path text, total_recruitment_cost numeric(12,2),
  availability text not null default 'متاحة' check (availability in ('متاحة','تم الحجز','غير متاحة','مؤرشفة')),
  publication text not null default 'مسودة' check (publication in ('مسودة','منشورة')),
  cv_path text not null,
  cv_file_name text not null,
  extracted boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.workers add column if not exists photo_path text;
alter table public.workers add column if not exists total_recruitment_cost numeric(12,2);

create table if not exists public.customer_requests (
  id text primary key,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  mobile text not null check (char_length(mobile) between 8 and 20),
  service text not null check (service in ('التأجير','الاستقدام')),
  nationality text not null default '', profession text not null default '',
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'لم يتم التواصل' check (status in ('جديد','لم يتم التواصل','تم التواصل','تم التواصل ولم يرد','رد العميل','مكتمل','معتذر عنه')),
  assignee uuid references public.employee_profiles(user_id), internal_notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.customer_complaints (
  id text primary key,
  phone text not null check (char_length(phone) between 8 and 20),
  complaint_text text not null check (char_length(complaint_text) between 8 and 3000),
  status text not null default 'جديدة' check (status in ('جديدة','تم التواصل','جاري الحل','تم الحل','تعذر التواصل')),
  source text not null default 'chatbot' check (source in ('chatbot','admin')),
  assignee uuid references public.employee_profiles(user_id),
  internal_notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id integer primary key default 1 check (id = 1),
  headline text not null default 'وقت أكثر لأسرتك، وراحة تدوم.',
  subhead text not null default '', theme text not null default 'blue',
  sections jsonb not null default '[]'::jsonb,
  images jsonb not null default '{}'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.site_content add column if not exists draft jsonb not null default '{}'::jsonb;
insert into public.site_content(id) values (1) on conflict do nothing;

alter table public.employee_profiles enable row level security;
alter table public.workers enable row level security;
alter table public.customer_requests enable row level security;
alter table public.customer_complaints enable row level security;
alter table public.site_content enable row level security;
grant select,insert,update,delete on public.employee_profiles,public.workers,public.customer_requests,public.site_content to authenticated;
grant insert on public.customer_requests to anon;
grant insert on public.customer_complaints to anon;
grant select,update on public.customer_complaints to authenticated;
grant select on public.site_content to anon;

drop policy if exists "employees read own profile" on public.employee_profiles;
create policy "employees read own profile" on public.employee_profiles for select to authenticated using (user_id = auth.uid() or public.employee_role() = 'super_admin');
drop policy if exists "super admins manage employee profiles" on public.employee_profiles;
create policy "super admins manage employee profiles" on public.employee_profiles for all to authenticated using (public.employee_role() = 'super_admin') with check (public.employee_role() = 'super_admin');

drop policy if exists "public sees available published workers" on public.workers;
drop policy if exists "worker managers read all workers" on public.workers;
create policy "worker managers read all workers" on public.workers for select to authenticated using (public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "worker managers insert workers" on public.workers;
create policy "worker managers insert workers" on public.workers for insert to authenticated with check (public.employee_role() in ('super_admin','workers_manager') and created_by = auth.uid());
drop policy if exists "worker managers update workers" on public.workers;
create policy "worker managers update workers" on public.workers for update to authenticated using (public.employee_role() in ('super_admin','workers_manager')) with check (public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "worker managers delete workers" on public.workers;
create policy "worker managers delete workers" on public.workers for delete to authenticated using (public.employee_role() in ('super_admin','workers_manager'));

-- Keep private columns (names and CV storage paths) out of the anonymous API.
create or replace view public.published_workers as
  select ref,nationality,profession,service,availability,age,experience,languages,skills,name,photo_path,total_recruitment_cost
  from public.workers where publication='منشورة' and availability='متاحة';
revoke all on public.workers from anon;
revoke all on public.workers from authenticated;
grant select,insert,update,delete on public.workers to authenticated;
revoke all on public.published_workers from public;
grant select on public.published_workers to anon, authenticated;

drop policy if exists "public submits requests" on public.customer_requests;
create policy "public submits requests" on public.customer_requests for insert to anon, authenticated with check (status = 'لم يتم التواصل' and assignee is null and internal_notes = '');
drop policy if exists "request managers read requests" on public.customer_requests;
create policy "request managers read requests" on public.customer_requests for select to authenticated using (public.employee_role() in ('super_admin','requests_manager'));
drop policy if exists "request managers update requests" on public.customer_requests;
create policy "request managers update requests" on public.customer_requests for update to authenticated using (public.employee_role() in ('super_admin','requests_manager')) with check (public.employee_role() in ('super_admin','requests_manager'));

drop policy if exists "public submits complaints" on public.customer_complaints;
create policy "public submits complaints" on public.customer_complaints for insert to anon,authenticated with check (status='جديدة' and assignee is null and internal_notes='');
drop policy if exists "request managers read complaints" on public.customer_complaints;
create policy "request managers read complaints" on public.customer_complaints for select to authenticated using (public.employee_role() in ('super_admin','requests_manager'));
drop policy if exists "request managers update complaints" on public.customer_complaints;
create policy "request managers update complaints" on public.customer_complaints for update to authenticated using (public.employee_role() in ('super_admin','requests_manager')) with check (public.employee_role() in ('super_admin','requests_manager'));

drop policy if exists "public reads published content" on public.site_content;
create policy "public reads published content" on public.site_content for select to anon, authenticated using (published = true);
drop policy if exists "content managers read content" on public.site_content;
create policy "content managers read content" on public.site_content for select to authenticated using (public.employee_role() in ('super_admin','content_manager'));
drop policy if exists "content managers write content" on public.site_content;
create policy "content managers write content" on public.site_content for all to authenticated using (public.employee_role() in ('super_admin','content_manager')) with check (public.employee_role() in ('super_admin','content_manager'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('worker-cvs','worker-cvs',false,15728640,array['application/pdf']),
       ('worker-photos','worker-photos',false,5242880,array['image/jpeg','image/png','image/webp']),
       ('site-media','site-media',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "authorized staff read private cvs" on storage.objects;
create policy "authorized staff read private cvs" on storage.objects for select to authenticated using (bucket_id='worker-cvs' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "authorized staff upload private cvs" on storage.objects;
create policy "authorized staff upload private cvs" on storage.objects for insert to authenticated with check (bucket_id='worker-cvs' and public.employee_role() in ('super_admin','workers_manager') and (storage.extension(name) = 'pdf'));
drop policy if exists "authorized staff delete private cvs" on storage.objects;
create policy "authorized staff delete private cvs" on storage.objects for delete to authenticated using (bucket_id='worker-cvs' and public.employee_role() in ('super_admin','workers_manager'));

create or replace function public.is_published_worker_photo(object_name text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.workers where photo_path=object_name and publication='منشورة' and availability='متاحة') $$;
revoke all on function public.is_published_worker_photo(text) from public;
grant execute on function public.is_published_worker_photo(text) to anon,authenticated;
drop policy if exists "published worker photos are visible" on storage.objects;
create policy "published worker photos are visible" on storage.objects for select to anon,authenticated using (bucket_id='worker-photos' and public.is_published_worker_photo(name));
drop policy if exists "worker managers read worker photos" on storage.objects;
create policy "worker managers read worker photos" on storage.objects for select to authenticated using (bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "worker managers upload worker photos" on storage.objects;
create policy "worker managers upload worker photos" on storage.objects for insert to authenticated with check (bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));
drop policy if exists "worker managers delete worker photos" on storage.objects;
create policy "worker managers delete worker photos" on storage.objects for delete to authenticated using (bucket_id='worker-photos' and public.employee_role() in ('super_admin','workers_manager'));

drop policy if exists "public reads site media" on storage.objects;
create policy "public reads site media" on storage.objects for select to anon, authenticated using (bucket_id='site-media');
drop policy if exists "content managers upload site media" on storage.objects;
create policy "content managers upload site media" on storage.objects for insert to authenticated with check (bucket_id='site-media' and public.employee_role() in ('super_admin','content_manager'));
drop policy if exists "content managers update site media" on storage.objects;
create policy "content managers update site media" on storage.objects for update to authenticated using (bucket_id='site-media' and public.employee_role() in ('super_admin','content_manager')) with check (bucket_id='site-media' and public.employee_role() in ('super_admin','content_manager'));
drop policy if exists "content managers delete site media" on storage.objects;
create policy "content managers delete site media" on storage.objects for delete to authenticated using (bucket_id='site-media' and public.employee_role() in ('super_admin','content_manager'));

-- Bootstrap: create the first employee in Authentication, then run:
-- insert into public.employee_profiles(user_id,full_name,role) values ('AUTH_USER_UUID','اسم المدير','super_admin');
-- Do not enable public signup. Add later employees through Auth + the super-admin-only employee_profiles policy.
