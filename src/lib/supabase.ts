import { createClient } from '@supabase/supabase-js'

// ─── Cấu hình Supabase ────────────────────────────────────────────────────────
// Ưu tiên biến môi trường (.env.local), fallback về hardcoded nếu chưa cấu hình env.
// Tạo file .env.local ở root project với nội dung:
//   VITE_SUPABASE_URL=https://xxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=sb_publishable_...

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ||
  'https://cfmbdlebnspxmtwymmdq.supabase.co'

const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'sb_publishable_Ktbptsp-JBPqFfC0Xsl6BQ_U-3fvi88'

// ─── Kiểm tra cấu hình ───────────────────────────────────────────────────────
export const isSupabaseConfigured =
  !SUPABASE_URL.includes('REPLACE') && !SUPABASE_ANON_KEY.includes('REPLACE')

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,  // prevent rate-limiting on active families
        },
      },
    })
  : null

// ─── SQL Schema (paste vào Supabase SQL Editor) ───────────────────────────────
export const SCHEMA_SQL = `
-- Chạy toàn bộ SQL này trong Supabase Dashboard > SQL Editor
-- MIGRATION (chạy một lần nếu đã có bảng cũ):
--   ALTER TABLE members        ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE quests         ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE rewards        ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE health_records ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE skills         ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE silent_heroes  ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE mail_messages  ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE gratitude_notes ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE wheel_items    ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE family_quests  ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE albums         ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE photos         ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE vocab_words    ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE ancestors      ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE anniversaries  ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
--   ALTER TABLE app_settings   ADD COLUMN IF NOT EXISTS last_push_at BIGINT DEFAULT 0;

-- Members
CREATE TABLE IF NOT EXISTS members (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'child',
  emoji TEXT DEFAULT '🧒',
  color TEXT DEFAULT 'bg-amber-500',
  birthday TEXT,
  blood_type TEXT,
  favorite_foods TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  goals TEXT[] DEFAULT '{}',
  tokens INTEGER DEFAULT 0,
  avatar_url TEXT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'daily',
  tokens INTEGER DEFAULT 0,
  assigned_to TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_by TEXT DEFAULT '',
  completed_by TEXT,
  completed_at BIGINT,
  flash_deadline BIGINT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🎁',
  token_cost INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Health records
CREATE TABLE IF NOT EXISTS health_records (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  member_id TEXT NOT NULL,
  date TEXT NOT NULL,
  height FLOAT,
  weight FLOAT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Skills
CREATE TABLE IF NOT EXISTS skills (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  member_id TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🎯',
  achieved BOOLEAN DEFAULT FALSE,
  achieved_date TEXT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Mail messages
CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  from_member TEXT DEFAULT '',
  to_members TEXT[] DEFAULT '{}',
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  mood TEXT DEFAULT 'happy',
  timestamp BIGINT,
  read_by TEXT[] DEFAULT '{}',
  reactions JSONB DEFAULT '[]',
  replies JSONB DEFAULT '[]',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Gratitude notes
CREATE TABLE IF NOT EXISTS gratitude_notes (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  from_member TEXT DEFAULT '',
  to_member TEXT DEFAULT '',
  message TEXT DEFAULT '',
  color TEXT DEFAULT 'bg-yellow-200 border-yellow-300',
  timestamp BIGINT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Wheel items
CREATE TABLE IF NOT EXISTS wheel_items (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT DEFAULT '🎯',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  question TEXT NOT NULL,
  answers TEXT[] DEFAULT '{}',
  correct_index INTEGER DEFAULT 0,
  created_by TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Family quests
CREATE TABLE IF NOT EXISTS family_quests (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_days INTEGER DEFAULT 7,
  current_days INTEGER DEFAULT 0,
  start_date TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Albums
CREATE TABLE IF NOT EXISTS albums (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT DEFAULT '',
  cover_emoji TEXT DEFAULT '📸',
  description TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Photos (ảnh trong album — data_url lưu base64)
CREATE TABLE IF NOT EXISTS photos (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  album_id TEXT NOT NULL,
  data_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  tagged_members TEXT[] DEFAULT '{}',
  date TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Silent heroes
CREATE TABLE IF NOT EXISTS silent_heroes (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  member_id TEXT NOT NULL,
  logged_by TEXT NOT NULL,
  deed TEXT NOT NULL,
  timestamp BIGINT,
  reactions JSONB DEFAULT '[]',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Vocab words
-- MIGRATION for existing tables (run once):
--   ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS emoji TEXT;
CREATE TABLE IF NOT EXISTS vocab_words (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT DEFAULT '',
  example TEXT DEFAULT '',
  theme TEXT DEFAULT 'kitchen',
  mastered_by TEXT[] DEFAULT '{}',
  emoji TEXT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  emoji TEXT DEFAULT '📅',
  color TEXT DEFAULT 'bg-violet-500',
  created_by TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Ancestors (Gia phả)
-- MIGRATION for existing tables (run once):
--   ALTER TABLE ancestors ADD COLUMN IF NOT EXISTS phone TEXT;
--   ALTER TABLE ancestors ADD COLUMN IF NOT EXISTS address TEXT;
--   ALTER TABLE ancestors ADD COLUMN IF NOT EXISTS hometown TEXT;
--   ALTER TABLE ancestors ADD COLUMN IF NOT EXISTS occupation TEXT;
--   ALTER TABLE ancestors ADD COLUMN IF NOT EXISTS manual_x FLOAT;
--   ALTER TABLE ancestors ADD COLUMN IF NOT EXISTS manual_y FLOAT;
CREATE TABLE IF NOT EXISTS ancestors (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'male',
  relationship TEXT DEFAULT '',
  birth_year INTEGER,
  death_year INTEGER,
  solar_birth_date TEXT,
  solar_death_date TEXT,
  lunar_death_day INTEGER,
  lunar_death_month INTEGER,
  biography TEXT,
  photo_url TEXT,
  parent_ids TEXT[] DEFAULT '{}',
  spouse_id TEXT,
  phone TEXT,
  address TEXT,
  hometown TEXT,
  occupation TEXT,
  manual_x FLOAT,
  manual_y FLOAT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- Anniversaries (Ngày Giỗ)
CREATE TABLE IF NOT EXISTS anniversaries (
  id TEXT NOT NULL,
  family_code TEXT NOT NULL,
  name TEXT NOT NULL,
  ancestor_id TEXT,
  solar_date TEXT,
  lunar_day INTEGER NOT NULL,
  lunar_month INTEGER NOT NULL,
  notes TEXT,
  updated_at BIGINT DEFAULT 0,
  PRIMARY KEY (id, family_code)
);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  family_code TEXT PRIMARY KEY,
  app_name TEXT DEFAULT 'MyBaoFamily',
  dark_mode BOOLEAN DEFAULT FALSE,
  parent_pin TEXT DEFAULT '',
  pin TEXT DEFAULT '1234',
  english_theme TEXT DEFAULT 'kitchen',
  last_push_at BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Families — one record per registered family (enables multi-device lookup by PIN)
CREATE TABLE IF NOT EXISTS families (
  family_code TEXT PRIMARY KEY,
  name TEXT DEFAULT 'Gia đình',
  pin TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clan links — connect families into a clan/genealogy tree
-- relationship: 'parent_branch' | 'child_branch' | 'sibling' | 'spouse_family'
-- status: 'pending' | 'accepted' | 'rejected'
CREATE TABLE IF NOT EXISTS clan_links (
  id TEXT NOT NULL,
  family_code_a TEXT NOT NULL REFERENCES families(family_code) ON DELETE CASCADE,
  family_code_b TEXT NOT NULL REFERENCES families(family_code) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'sibling',
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS clan_links_pair ON clan_links (
  LEAST(family_code_a, family_code_b),
  GREATEST(family_code_a, family_code_b)
);

-- Enable Realtime for all tables (chạy từng dòng)
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE quests;
ALTER PUBLICATION supabase_realtime ADD TABLE rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE health_records;
ALTER PUBLICATION supabase_realtime ADD TABLE silent_heroes;
ALTER PUBLICATION supabase_realtime ADD TABLE mail_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ancestors;
ALTER PUBLICATION supabase_realtime ADD TABLE anniversaries;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
`
