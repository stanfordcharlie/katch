-- Run this in the Supabase SQL Editor to create user_settings and RLS.

create table user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  contact_signals text[] default '{"Shared a pain point","Budget approved / confirmed","Decision maker","Wants a demo","Active buying timeline","I promised to send something","Mentioned a referral","They asked me to follow up"}',
  visible_fields text[] default '{"email","phone","linkedin","company","title","event","lead_score","notes"}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table user_settings enable row level security;

create policy "Users can manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
