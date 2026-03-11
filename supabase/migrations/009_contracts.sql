create table if not exists contracts (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  filename text not null,
  pdf_url text,
  summary jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists contracts_company_id_idx on contracts(company_id);
