-- ============================================================
-- 003_multi_company.sql: マルチクライアント対応
-- ============================================================
-- store_info の 'default' レコードを 'company_default' に変更
UPDATE store_info SET id = 'company_default' WHERE id = 'default';

-- IDのデフォルト値を削除（新規作成時はアプリ側でUUIDを発行する）
ALTER TABLE store_info ALTER COLUMN id DROP DEFAULT;

-- 並び順カラム追加
ALTER TABLE store_info ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- prompts: company_id カラム追加
-- ────────────────────────────────────────────────────────────
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS company_id text REFERENCES store_info(id) ON DELETE CASCADE;

-- 既存プロンプトを company_default に紐付け
UPDATE prompts SET company_id = 'company_default' WHERE company_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- measurement_results: company_id カラム追加
-- ────────────────────────────────────────────────────────────
ALTER TABLE measurement_results ADD COLUMN IF NOT EXISTS company_id text;

UPDATE measurement_results SET company_id = 'company_default' WHERE company_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- api_keys: 'default' -> 'company_default'
-- ────────────────────────────────────────────────────────────
UPDATE api_keys SET id = 'company_default' WHERE id = 'default';
ALTER TABLE api_keys ALTER COLUMN id DROP DEFAULT;

-- ────────────────────────────────────────────────────────────
-- measurement_schedule: 'default' -> 'company_default'
-- ────────────────────────────────────────────────────────────
UPDATE measurement_schedule SET id = 'company_default' WHERE id = 'default';
ALTER TABLE measurement_schedule ALTER COLUMN id DROP DEFAULT;

-- ────────────────────────────────────────────────────────────
-- wordpress_config: 'default' -> 'company_default'
-- ────────────────────────────────────────────────────────────
UPDATE wordpress_config SET id = 'company_default' WHERE id = 'default';
ALTER TABLE wordpress_config ALTER COLUMN id DROP DEFAULT;

-- ────────────────────────────────────────────────────────────
-- インデックス
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prompts_company_id ON prompts(company_id);
CREATE INDEX IF NOT EXISTS idx_measurement_results_company_id ON measurement_results(company_id);
