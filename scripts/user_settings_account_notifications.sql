-- Optional: run in Supabase SQL editor if notification saves fail (unknown column).
-- Adds columns used by Account → Notifications in src/app/(app)/account/page.tsx

alter table user_settings add column if not exists email_on_sequence_sent boolean default true;
alter table user_settings add column if not exists weekly_lead_summary boolean default false;
