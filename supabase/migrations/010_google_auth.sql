alter table api_keys add column if not exists google_access_token text;
alter table api_keys add column if not exists google_refresh_token text;
alter table api_keys add column if not exists google_token_expiry timestamptz;
alter table api_keys add column if not exists google_email text;
