-- ============================================================
-- mieru-ai-kigyo: Initial Schema
-- ============================================================

-- 企業情報
create table if not exists store_info (
  id text primary key default 'default',
  business_type text not null default 'other',
  name text not null default '',
  website_url text not null default '',
  description text not null default '',
  target_audience text not null default '',
  strengths text not null default '',
  services text not null default '',
  achievements text not null default '',
  positioning text not null default '',
  competitors jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- プロンプト
create table if not exists prompts (
  id text primary key,
  text text not null,
  category text not null default 'awareness',
  difficulty text not null default 'med',
  priority text not null default 'medium',
  is_winning boolean not null default false,
  pseudo_memory text not null default '',
  display_rate numeric,
  cited_sources jsonb default '[]',
  cited_competitors jsonb default '[]',
  cited_context text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 計測結果
create table if not exists measurement_results (
  id text primary key,
  prompt_id text not null references prompts(id) on delete cascade,
  platform text not null,
  response text not null default '',
  mentioned boolean not null default false,
  mention_position integer,
  sentiment text not null default 'neutral',
  positive_elements text not null default '',
  negative_elements text not null default '',
  cited_urls jsonb not null default '[]',
  cited_context text not null default '',
  cited_competitors jsonb not null default '[]',
  competitor_mentions jsonb not null default '{}',
  measured_at timestamptz not null default now()
);

-- APIキー設定（暗号化なし・アプリ内保存）
create table if not exists api_keys (
  id text primary key default 'default',
  anthropic text not null default '',
  openai text not null default '',
  gemini text not null default '',
  perplexity text not null default '',
  firecrawl text not null default '',
  updated_at timestamptz not null default now()
);

-- 計測スケジュール設定
create table if not exists measurement_schedule (
  id text primary key default 'default',
  enabled boolean not null default false,
  times jsonb not null default '["09:00","13:00","18:00"]',
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

-- WordPress設定
create table if not exists wordpress_config (
  id text primary key default 'default',
  site_url text not null default '',
  username text not null default '',
  application_password text not null default '',
  connected boolean not null default false,
  updated_at timestamptz not null default now()
);

-- RLSは全テーブルで無効（社内専用ツール・認証なし）
alter table store_info disable row level security;
alter table prompts disable row level security;
alter table measurement_results disable row level security;
alter table api_keys disable row level security;
alter table measurement_schedule disable row level security;
alter table wordpress_config disable row level security;

-- インデックス
create index if not exists idx_measurement_results_prompt_id on measurement_results(prompt_id);
create index if not exists idx_measurement_results_measured_at on measurement_results(measured_at desc);
create index if not exists idx_prompts_is_winning on prompts(is_winning);
