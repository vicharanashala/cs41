-- Migration 013: Platform Settings
-- Stores key-value platform configuration, thresholds, and preferences.

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  created_at  INTEGER DEFAULT (unixepoch() * 1000),
  updated_at  INTEGER DEFAULT (unixepoch() * 1000)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);