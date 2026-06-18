-- Supabase-native scheduler for scheduled_tasks.
--
-- This sets up a pg_cron job that, every minute, asks the Next.js app to run any
-- due tasks. The app holds all the logic (audience resolution, image rendering,
-- WhatsApp sending); Supabase is only the trigger.
--
-- REQUIRED: replace the two placeholders below before running, OR (preferred)
-- store them in Supabase Vault so they are not hard-coded:
--   APP_URL      -> your public app base URL, e.g. https://app.example.com
--   CRON_SECRET  -> same value as CRON_SECRET in the app's environment
--
-- Run this in the Supabase SQL editor (needs superuser to enable extensions).

-- 1. Extensions ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;

-- 2. (Preferred) store secrets in Vault --------------------------------------
-- Run once; then the cron job reads them back instead of embedding literals.
--   select vault.create_secret('https://app.example.com', 'app_url');
--   select vault.create_secret('your-cron-secret',        'cron_secret');

-- 3. Schedule the runner ------------------------------------------------------
-- Unschedule a previous definition (ignore error if it doesn't exist yet).
DO $$
BEGIN
  PERFORM cron.unschedule('run-due-tasks');
EXCEPTION WHEN OTHERS THEN
  -- not scheduled yet
  NULL;
END $$;

-- Vault-based variant (recommended). Comment this out and use the literal
-- variant below if you are not using Vault.
SELECT cron.schedule(
  'run-due-tasks',
  '* * * * *',  -- every minute
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url')
               || '/api/cron/run-due-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Literal variant (use only if NOT using Vault — replace placeholders):
-- SELECT cron.schedule(
--   'run-due-tasks',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'APP_URL/api/cron/run-due-tasks',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','CRON_SECRET'),
--     body    := '{}'::jsonb,
--     timeout_milliseconds := 25000
--   );
--   $$
-- );

-- Inspect:  SELECT * FROM cron.job;
-- History:  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
