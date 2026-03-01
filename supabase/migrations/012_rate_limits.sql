-- Migration 012: rate_limits table for DB-backed sliding-window rate limiting.
-- Replaces the in-memory Map in _shared/rateLimit.ts which is non-functional
-- across concurrent serverless Edge Function isolates.
--
-- Each row represents one IP (or key) within a 1-minute window.
-- The upsert in rateLimit.ts is atomic (no race condition) thanks to
-- INSERT ... ON CONFLICT DO UPDATE which holds a row-level lock.

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- Auto-cleanup: delete windows older than 10 minutes so the table stays tiny.
-- In production you can replace this with pg_cron if available, or rely on
-- the WHERE clause in rateLimit.ts pruning stale rows on read.
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON rate_limits (window_start);

-- No RLS needed — only accessible via service role key in Edge Functions.

-- Atomic upsert function called by rateLimit.ts.
-- Returns the new count for the (key, window) pair.
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key          TEXT,
  p_window_start TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limits (key, window_start, count)
    VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Prune windows older than 10 minutes to keep the table small.
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '10 minutes';

  RETURN v_count;
END;
$$;
