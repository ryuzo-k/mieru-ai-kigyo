-- 急上昇プロンプト検出ビュー
CREATE OR REPLACE VIEW prompt_trends AS
WITH recent AS (
  SELECT
    prompt_id,
    mentioned::int AS hit,
    measured_at,
    ROW_NUMBER() OVER (PARTITION BY prompt_id ORDER BY measured_at DESC) AS rn
  FROM measurement_results
),
last3 AS (
  SELECT prompt_id, AVG(hit)*100 AS recent_rate
  FROM recent WHERE rn <= 3
  GROUP BY prompt_id
),
prev3 AS (
  SELECT prompt_id, AVG(hit)*100 AS prev_rate
  FROM recent WHERE rn BETWEEN 4 AND 6
  GROUP BY prompt_id
)
SELECT
  p.id AS prompt_id,
  p.text AS prompt_text,
  p.is_winning,
  p.display_rate,
  COALESCE(last3.recent_rate, 0) AS recent_rate,
  COALESCE(prev3.prev_rate, 0) AS prev_rate,
  COALESCE(last3.recent_rate, 0) - COALESCE(prev3.prev_rate, 0) AS trend_delta
FROM prompts p
LEFT JOIN last3 ON p.id = last3.prompt_id
LEFT JOIN prev3 ON p.id = prev3.prompt_id;
