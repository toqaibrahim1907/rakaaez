-- Run in Supabase SQL Editor to enable the website complaint workflow.
create table if not exists public.customer_complaints (
  id text primary key,
  phone text not null check (char_length(phone) between 8 and 20),
  complaint_text text not null check (char_length(complaint_text) between 8 and 3000),
  status text not null default 'جديدة' check (status in ('جديدة','تم التواصل','جاري الحل','تم الحل','تعذر التواصل')),
  source text not null default 'chatbot' check (source in ('chatbot','admin')),
  assignee uuid references public.employee_profiles(user_id),
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_complaints enable row level security;
grant insert on public.customer_complaints to anon;
grant select,update on public.customer_complaints to authenticated;

drop policy if exists "public submits complaints" on public.customer_complaints;
create policy "public submits complaints" on public.customer_complaints
for insert to anon,authenticated
with check(status='جديدة' and assignee is null and internal_notes='');
drop policy if exists "request managers read complaints" on public.customer_complaints;
create policy "request managers read complaints" on public.customer_complaints
for select to authenticated using(public.employee_role() in ('super_admin','requests_manager','admin'));
drop policy if exists "request managers update complaints" on public.customer_complaints;
create policy "request managers update complaints" on public.customer_complaints
for update to authenticated using(public.employee_role() in ('super_admin','requests_manager','admin'))
with check(public.employee_role() in ('super_admin','requests_manager','admin'));
