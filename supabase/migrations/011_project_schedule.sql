create table if not exists project_tasks (
  id text primary key,
  company_id text references store_info(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'milestone',
  -- task_type: milestone / meeting / deliverable / measurement / content / report
  scheduled_date date not null,
  scheduled_time time,
  status text not null default 'pending',
  -- status: pending / in_progress / completed / cancelled
  assignee text,  -- "us" or "client"
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists project_tasks_company_id_idx on project_tasks(company_id);
create index if not exists project_tasks_scheduled_date_idx on project_tasks(scheduled_date);
