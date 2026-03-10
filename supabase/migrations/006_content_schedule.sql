create table if not exists content_schedule (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  scheduled_date date not null,
  suggestion_id text,
  generated_content_id text,
  publish_time time default '09:00',
  status text default 'scheduled',
  suggestion_title text,
  suggestion_type text,
  covered_prompt_texts text[],
  created_at timestamptz default now()
);

create index if not exists content_schedule_company_id_idx on content_schedule(company_id);
create index if not exists content_schedule_scheduled_date_idx on content_schedule(scheduled_date);
