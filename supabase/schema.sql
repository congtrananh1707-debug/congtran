-- ============================================================
-- Kong English Tutor — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  username       text unique not null,
  display_name   text not null default '',
  role           text not null default 'user' check (role in ('user', 'admin')),
  level          text not null default 'A2' check (level in ('A1','A2','B1','B2','C1','C2')),
  manual_level   text check (manual_level in ('A1','A2','B1','B2','C1','C2')),
  interests      jsonb not null default '[]'::jsonb,
  input_lang     text not null default 'en' check (input_lang in ('en','vi')),
  word_bank      jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- messages ----------
create table if not exists public.messages (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  role                 text not null check (role in ('user', 'assistant')),
  content              text not null,
  vietnamese           text not null default '',
  suggestion           text not null default '',
  better_way_original  text not null default '',
  better_way_improved  text not null default '',
  suggestions          jsonb not null default '[]'::jsonb,
  vocabulary           jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at);

-- ---------- is_admin() helper (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = uid and role = 'admin'
  );
$$;

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- profiles: user reads/updates own row
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles: admin can read all
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
  for select using (public.is_admin(auth.uid()));

-- messages: user reads / writes / deletes own rows
drop policy if exists messages_self_read on public.messages;
create policy messages_self_read on public.messages
  for select using (auth.uid() = user_id);

drop policy if exists messages_self_insert on public.messages;
create policy messages_self_insert on public.messages
  for insert with check (auth.uid() = user_id);

drop policy if exists messages_self_delete on public.messages;
create policy messages_self_delete on public.messages
  for delete using (auth.uid() = user_id);

-- ============================================================
-- ADMIN BOOTSTRAP — run ONCE after the schema above, then delete.
-- 1) Replace the placeholders below with your chosen credentials.
-- 2) In Supabase Dashboard → Authentication → Users → Add user:
--      Email:    <admin-username>@kong.local
--      Password: <admin-password>
--      Tick "Auto Confirm User"
-- 3) Then run the SQL below (it promotes that user to admin):
-- ============================================================

-- insert into public.profiles (user_id, username, display_name, role)
-- select id, 'admin', 'Admin', 'admin'
-- from auth.users
-- where email = 'admin@kong.local'
-- on conflict (user_id) do update set role = 'admin', username = excluded.username;
