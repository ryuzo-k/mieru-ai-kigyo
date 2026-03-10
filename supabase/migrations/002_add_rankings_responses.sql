-- competitorRankings と rawResponses カラムを追加
alter table measurement_results
  add column if not exists competitor_rankings jsonb not null default '[]',
  add column if not exists raw_responses jsonb not null default '[]';
