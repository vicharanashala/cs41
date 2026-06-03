-- 004_sp_enrichment.sql
-- Student SP ledger enrichment, anomaly detection, watchlist, and leaderboard snapshots
-- Uses companion tables to avoid ALTER TABLE on sp_ledger (avoids table rewrite)

-- SP ledger companion: anomaly enrichment for each ledger entry
-- Avoids ALTER TABLE sp_ledger on existing deployments
CREATE TABLE IF NOT EXISTS sp_ledger_enrichment (
  ledger_entry_id TEXT PRIMARY KEY,                 -- FK to sp_ledger.id
  anomaly_score   REAL,                             -- 0.0-1.0, null = not yet analyzed
  anomaly_flags   TEXT,                             -- JSON: ['rapid_succession', ...]
  reviewed        INTEGER NOT NULL DEFAULT 0,       -- 0=unreviewed, 1=reviewed, 2=dismissed
  reviewed_by     TEXT,
  reviewed_at     INTEGER,
  FOREIGN KEY (ledger_entry_id) REFERENCES sp_ledger(id) ON DELETE CASCADE
);

-- Anomaly events: high-risk SP patterns flagged for Faculty review
CREATE TABLE IF NOT EXISTS sp_anomaly_events (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  ledger_entry_id TEXT,                             -- lead entry that triggered this
  anomaly_score   REAL NOT NULL,                    -- 0.0-1.0
  flags           TEXT NOT NULL,                    -- JSON: ['rapid_succession', 'mutual_upvote_ring', ...]
  context         TEXT,                             -- JSON: { recentEventsCount, avgHourlyRate, ... }
  status          TEXT NOT NULL DEFAULT 'open',     -- 'open'|'under_investigation'|'resolved'|'dismissed'
  assigned_to     TEXT,
  resolution      TEXT,                             -- 'confirmed_fraud'|'false_positive'|'rule_violation'|'cleared'
  resolved_by     TEXT,
  resolved_at     INTEGER,
  resolution_notes TEXT,
  created_at      INTEGER NOT NULL,                 -- unix timestamp ms
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Faculty watchlist: accounts under active monitoring
CREATE TABLE IF NOT EXISTS sp_watchlist (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  added_by        TEXT NOT NULL,
  reason          TEXT NOT NULL,                    -- 'anomaly'|'manual'|'reported'
  trigger_event_id TEXT,                            -- sp_anomaly_events.id that triggered this, if any
  priority        TEXT NOT NULL DEFAULT 'normal',   -- 'low'|'normal'|'high'|'critical'
  notes           TEXT,
  added_at        INTEGER NOT NULL,                 -- unix timestamp ms
  expires_at      INTEGER,                          -- null = permanent; unix timestamp for temp watch
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Manual SP adjustments: append-only log of Faculty-administered SP changes
CREATE TABLE IF NOT EXISTS sp_adjustments (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL,
  faculty_id      TEXT NOT NULL,
  amount          INTEGER NOT NULL,                 -- positive = award, negative = deduct
  reason          TEXT NOT NULL,
  category        TEXT NOT NULL,                    -- 'penalty'|'reward'|'correction'|'welcome_bonus'
  ref_id          TEXT,                             -- link to sp_anomaly_events.id that triggered this, if any
  ip_address      TEXT,
  created_at      INTEGER NOT NULL,                 -- unix timestamp ms
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (faculty_id) REFERENCES users(id)
);

-- Leaderboard snapshots for rank-change analytics
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  snapshot_id  TEXT PRIMARY KEY,
  snapshot_at  INTEGER NOT NULL,                    -- unix timestamp ms
  top_50       TEXT NOT NULL                        -- JSON: [{rank, user_id, reputation}, ...]
);

-- Index for fast anomaly lookup by status + score
CREATE INDEX IF NOT EXISTS idx_anomaly_status_score
  ON sp_anomaly_events(status, anomaly_score DESC);

-- Index for fast anomaly lookup by user
CREATE INDEX IF NOT EXISTS idx_anomaly_user
  ON sp_anomaly_events(user_id, created_at DESC);

-- Index for fast watchlist lookup by priority
CREATE INDEX IF NOT EXISTS idx_watchlist_priority
  ON sp_watchlist(priority, added_at DESC);

-- Index for fast adjustment lookup by student
CREATE INDEX IF NOT EXISTS idx_adjustments_student
  ON sp_adjustments(student_id, created_at DESC);

-- Index for fast snapshot lookup (latest first)
CREATE INDEX IF NOT EXISTS idx_snapshots_time
  ON leaderboard_snapshots(snapshot_at DESC);