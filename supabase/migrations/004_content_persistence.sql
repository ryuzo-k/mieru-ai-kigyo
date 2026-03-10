-- コンテンツ提案結果を保存するテーブル
create table if not exists content_suggestions (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  type text not null,
  type_label text not null,
  title text not null,
  angle text not null default '',
  coverage_type text not null default 'multi',
  covered_prompt_ids jsonb not null default '[]',
  covered_prompt_texts jsonb not null default '[]',
  why_now text not null default '',
  estimated_impact text not null default 'medium',
  key_requirements jsonb not null default '[]',
  created_at timestamptz default now()
);

-- 生成されたコンテンツを保存するテーブル
create table if not exists generated_contents (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  suggestion_id text,
  type text not null,
  type_label text not null,
  title text not null,
  content text not null,
  prompt_ids jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ウェブサイト分析結果を保存するテーブル
create table if not exists website_analyses (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  url text not null,
  analysis jsonb not null default '{}',
  created_at timestamptz default now()
);
