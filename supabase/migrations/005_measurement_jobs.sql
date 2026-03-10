create table if not exists measurement_jobs (
  id text primary key,
  company_id text not null,
  status text not null default 'running',
  total_prompts integer not null default 0,
  completed_prompts integer not null default 0,
  current_prompt_text text default '',
  started_at timestamptz default now(),
  completed_at timestamptz
);
