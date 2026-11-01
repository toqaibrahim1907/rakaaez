-- Run once in the Supabase SQL Editor after deploying the separate Rakaez PWA.
create table if not exists public.pwa_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  notify_workers boolean not null default true,
  notify_rental boolean not null default true,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pwa_push_subscriptions add column if not exists notify_workers boolean not null default true;
alter table public.pwa_push_subscriptions add column if not exists notify_rental boolean not null default true;
alter table public.pwa_push_subscriptions enable row level security;
revoke all on public.pwa_push_subscriptions from anon, authenticated;
grant all on public.pwa_push_subscriptions to service_role;

-- Keep the public worker list ordered by publication date for the app UI.
create or replace view public.published_workers as
  select ref,nationality,profession,service,availability,age,experience,languages,skills,name,photo_path,total_recruitment_cost,created_at
  from public.workers where publication='منشورة' and availability='متاحة';
revoke all on public.published_workers from public;
grant select on public.published_workers to anon, authenticated;

-- pg_net sends one webhook only when a worker first becomes publicly available.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_pwa_when_worker_is_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pwa_url text;
  webhook_secret text;
  should_notify boolean := false;
begin
  if new.publication = 'منشورة' and new.availability = 'متاحة' then
    if tg_op = 'INSERT' then
      should_notify := true;
    elsif old.publication is distinct from new.publication or old.availability is distinct from new.availability then
      should_notify := true;
    end if;
  end if;

  if not should_notify then return new; end if;

  begin
    select decrypted_secret into pwa_url from vault.decrypted_secrets where name = 'pwa_push_webhook_url' limit 1;
    select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'pwa_push_webhook_secret' limit 1;
    if coalesce(pwa_url, '') = '' or coalesce(webhook_secret, '') = '' then
      raise warning 'PWA notification secrets are not configured in Supabase Vault.';
      return new;
    end if;
    perform net.http_post(
      url := rtrim(pwa_url, '/') || '/api/push/worker-published',
      body := jsonb_build_object('type', tg_op, 'record', to_jsonb(new)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-pwa-webhook-secret', webhook_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'PWA worker notification webhook was not queued: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_pwa_when_worker_is_published() from public, anon, authenticated;
drop trigger if exists notify_pwa_new_published_worker on public.workers;
create trigger notify_pwa_new_published_worker
after insert or update of publication, availability on public.workers
for each row execute function public.notify_pwa_when_worker_is_published();

-- After the PWA is deployed, store its exact base URL and the same secret as
-- PWA_PUSH_WEBHOOK_SECRET in Vercel. Run once, replacing both placeholders:
-- select vault.create_secret('https://YOUR-PWA.vercel.app', 'pwa_push_webhook_url');
-- select vault.create_secret('YOUR_RANDOM_WEBHOOK_SECRET', 'pwa_push_webhook_secret');
