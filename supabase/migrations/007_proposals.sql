-- 007_proposals.sql: 提案資料テーブル

create table if not exists proposals (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  target_company_name text not null,
  target_company_url text,
  meeting_notes text,
  slides jsonb not null default '[]',
  created_at timestamptz default now()
);

create index if not exists proposals_company_id_idx on proposals(company_id);
create index if not exists proposals_created_at_idx on proposals(created_at desc);
