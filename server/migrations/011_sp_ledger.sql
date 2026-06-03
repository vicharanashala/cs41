-- 011_sp_ledger.sql
-- Creates the core sp_ledger table required by all SP Management endpoints.
-- Referenced (as FK source) by sp_ledger_enrichment from migration 004.

CREATE TABLE IF NOT EXISTS sp_ledger (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  action_type      TEXT NOT NULL,
  points           INTEGER NOT NULL,
  balance_after    INTEGER NOT NULL,
  reference_id     TEXT,
  reference_type   TEXT,
  description      TEXT,
  created_at       INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sp_ledger_user_created ON sp_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sp_ledger_action       ON sp_ledger(action_type);