-- 012_analytics.sql
-- Analytics module: aggregate metric tables and KPI snapshots
-- Populated on-demand by the analytics backend; read by the AnalyticsPage frontend.

-- ── Daily FAQ submission metrics ────────────────────────────────────────────
-- One row per day: tracks community question submissions + review throughput
CREATE TABLE IF NOT EXISTS analytics_faq_daily (
  date          TEXT PRIMARY KEY,              -- 'YYYY-MM-DD'
  submitted     INTEGER NOT NULL DEFAULT 0,    -- new questions submitted
  in_review     INTEGER NOT NULL DEFAULT 0,    -- entered pending_review that day
  published     INTEGER NOT NULL DEFAULT 0,    -- published that day
  rejected      INTEGER NOT NULL DEFAULT 0,    -- rejected that day
  changes_req   INTEGER NOT NULL DEFAULT 0,    -- changes_requested that day
  avg_quality   REAL,                          -- mean AI quality score of analyzed Qs that day
  avg_queue_hrs REAL,                          -- mean hours in queue for Qs reviewed that day
  updated_at    INTEGER NOT NULL               -- unix timestamp ms
);

-- ── Monthly FAQ summary ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_faq_monthly (
  month         TEXT PRIMARY KEY,              -- 'YYYY-MM'
  submitted     INTEGER NOT NULL DEFAULT 0,
  published     INTEGER NOT NULL DEFAULT 0,
  rejected      INTEGER NOT NULL DEFAULT 0,
  changes_req   INTEGER NOT NULL DEFAULT 0,
  total_active  INTEGER NOT NULL DEFAULT 0,    -- questions with ≥1 answer
  avg_quality   REAL,
  updated_at    INTEGER NOT NULL
);

-- ── Moderation metrics ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_moderation_daily (
  date          TEXT PRIMARY KEY,
  flags_raised  INTEGER NOT NULL DEFAULT 0,
  flags_resolved INTEGER NOT NULL DEFAULT 0,
  content_removed INTEGER NOT NULL DEFAULT 0,
  users_warned  INTEGER NOT NULL DEFAULT 0,
  dismissed     INTEGER NOT NULL DEFAULT 0,
  avg_resolve_hrs REAL,                        -- mean hours to resolve a flag that day
  updated_at    INTEGER NOT NULL
);

-- ── Student SP distribution snapshots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_sp_distribution (
  snapshot_id   TEXT PRIMARY KEY,              -- 'YYYY-MM-DD' or 'YYYY-MM'
  period        TEXT NOT NULL,                 -- 'daily' or 'monthly'
  captured_at   INTEGER NOT NULL,              -- unix timestamp ms

  total_students     INTEGER NOT NULL DEFAULT 0,
  avg_sp             REAL NOT NULL DEFAULT 0,
  median_sp          REAL NOT NULL DEFAULT 0,
  min_sp             INTEGER NOT NULL DEFAULT 0,
  max_sp             INTEGER NOT NULL DEFAULT 0,
  std_dev            REAL NOT NULL DEFAULT 0,

  top_quantile       INTEGER NOT NULL DEFAULT 0,  -- SP at 90th percentile
  bottom_quantile    INTEGER NOT NULL DEFAULT 0,  -- SP at 10th percentile

  frozen_count       INTEGER NOT NULL DEFAULT 0,
  watchlist_count    INTEGER NOT NULL DEFAULT 0,
  anomaly_count      INTEGER NOT NULL DEFAULT 0,
  updated_at         INTEGER NOT NULL
);

-- ── Review throughput: weekly cohort ───────────────────────────────────────
-- Rolling 12-week table; one row per week (Mon–Sun)
CREATE TABLE IF NOT EXISTS analytics_throughput_weekly (
  week_start    TEXT PRIMARY KEY,              -- 'YYYY-MM-DD' (Monday)
  queued        INTEGER NOT NULL DEFAULT 0,
  reviewed      INTEGER NOT NULL DEFAULT 0,
  published     INTEGER NOT NULL DEFAULT 0,
  rejected      INTEGER NOT NULL DEFAULT 0,
  changes_req   INTEGER NOT NULL DEFAULT 0,
  p50_hours     REAL,                          -- median review time (hours)
  p90_hours     REAL,                          -- 90th percentile review time
  ai_used       INTEGER NOT NULL DEFAULT 0,    -- reviews that used AI analysis
  updated_at    INTEGER NOT NULL
);

-- ── KPI snapshot (latest values for dashboard cards) ───────────────────────
CREATE TABLE IF NOT EXISTS analytics_kpi (
  key           TEXT PRIMARY KEY,              -- e.g. 'total_faqs', 'open_flags', 'avg_sp'
  value         REAL NOT NULL,
  label         TEXT NOT NULL,                 -- human-readable label
  trend         REAL,                          -- % change vs prior period
  updated_at    INTEGER NOT NULL
);

-- ── Seed: pre-populate a sensible baseline for empty-state avoidance ────────
-- (real data gets recomputed whenever analytics endpoints are called)
INSERT OR IGNORE INTO analytics_kpi (key, value, label, trend, updated_at) VALUES
  ('total_faqs',        0, 'Total FAQs',          0, 0),
  ('pending_review',    0, 'Pending Review',       0, 0),
  ('published_this_month', 0, 'Published This Month', 0, 0),
  ('open_flags',        0, 'Open Moderation Flags',0, 0),
  ('avg_sp',            0, 'Average SP',           0, 0),
  ('students',          0, 'Total Students',       0, 0),
  ('reviewed_this_week', 0,'Reviews This Week',    0, 0),
  ('flagged_content',   0, 'Flagged Content',      0, 0);