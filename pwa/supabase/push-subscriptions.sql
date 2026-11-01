-- Run once in the Supabase SQL Editor for the separate Rakaez PWA project.
create table if not exists public.pwa_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pwa_push_subscriptions enable row level security;
revoke all on public.pwa_push_subscriptions from anon, authenticated;
grant all on public.pwa_push_subscriptions to service_role;
