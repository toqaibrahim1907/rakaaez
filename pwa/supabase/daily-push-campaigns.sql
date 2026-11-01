-- Apply this after creating pwa_push_webhook_url and pwa_push_webhook_secret
-- in Supabase Vault, and after deploying the PWA to its production URL.
-- Supabase Cron uses UTC: 07:00, 12:00, and 17:00 UTC = 10:00, 15:00,
-- and 20:00 in Saudi Arabia (UTC+3).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.pwa_push_subscriptions add column if not exists welcome_due_at timestamptz;
alter table public.pwa_push_subscriptions add column if not exists welcome_sent_at timestamptz;

create table if not exists public.pwa_push_campaign_runs (
  campaign_key text primary key,
  slot text not null check (slot in ('morning','afternoon','evening')),
  sent integer not null default 0,
  failed integer not null default 0,
  subscriber_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.pwa_push_campaign_runs enable row level security;
revoke all on public.pwa_push_campaign_runs from public, anon, authenticated;
grant all on public.pwa_push_campaign_runs to service_role;

-- Re-running this file replaces the same three daily campaigns.
select cron.unschedule(jobid)
from cron.job
where jobname in ('rakaez-daily-workers-push','rakaez-daily-rental-push','rakaez-daily-evening-push','rakaez-install-welcome-push');

select cron.schedule(
  'rakaez-daily-workers-push', '0 7 * * *',
  $job$
    select net.http_post(
      url := (select rtrim(decrypted_secret, '/') || '/api/push/daily' from vault.decrypted_secrets where name = 'pwa_push_webhook_url' limit 1),
      headers := jsonb_build_object('Content-Type','application/json','x-pwa-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'pwa_push_webhook_secret' limit 1)),
      body := jsonb_build_object('slot','morning'),
      timeout_milliseconds := 10000
    );
  $job$
);

select cron.schedule(
  'rakaez-daily-rental-push', '0 12 * * *',
  $job$
    select net.http_post(
      url := (select rtrim(decrypted_secret, '/') || '/api/push/daily' from vault.decrypted_secrets where name = 'pwa_push_webhook_url' limit 1),
      headers := jsonb_build_object('Content-Type','application/json','x-pwa-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'pwa_push_webhook_secret' limit 1)),
      body := jsonb_build_object('slot','afternoon'),
      timeout_milliseconds := 10000
    );
  $job$
);

select cron.schedule(
  'rakaez-daily-evening-push', '0 17 * * *',
  $job$
    select net.http_post(
      url := (select rtrim(decrypted_secret, '/') || '/api/push/daily' from vault.decrypted_secrets where name = 'pwa_push_webhook_url' limit 1),
      headers := jsonb_build_object('Content-Type','application/json','x-pwa-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'pwa_push_webhook_secret' limit 1)),
      body := jsonb_build_object('slot','evening'),
      timeout_milliseconds := 10000
    );
  $job$
);

-- Check once per minute for installations whose welcome message is due.
select cron.schedule(
  'rakaez-install-welcome-push', '* * * * *',
  $job$
    select net.http_post(
      url := (select rtrim(decrypted_secret, '/') || '/api/push/welcome-dispatch' from vault.decrypted_secrets where name = 'pwa_push_webhook_url' limit 1),
      headers := jsonb_build_object('Content-Type','application/json','x-pwa-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'pwa_push_webhook_secret' limit 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
