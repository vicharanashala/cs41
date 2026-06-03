-- 005_content_flags.sql
-- Content flagging and moderation system

CREATE TABLE IF NOT EXISTS content_flags (
  id          TEXT PRIMARY KEY,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('question','answer','faq')),
  target_id   TEXT NOT NULL,
  flagged_by  TEXT NOT NULL,
  reason      TEXT NOT NULL
    CHECK (reason IN ('spam','inappropriate','wrong_info','duplicate',
                      'too_vague','offensive','other')),
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewed','dismissed')),
  resolved_by TEXT,
  resolved_at INTEGER,
  notes       TEXT,
  created_at  INTEGER NOT NULL,                     -- unix timestamp ms
  FOREIGN KEY (flagged_by)  REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Prevent duplicate flags from same user on same content
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_flags_unique
  ON content_flags(target_type, target_id, flagged_by);

-- Index for fast queue lookup by status + time
CREATE INDEX IF NOT EXISTS idx_content_flags_status
  ON content_flags(status, created_at DESC);

-- Index for fast lookup by target
CREATE INDEX IF NOT EXISTS idx_content_flags_target
  ON content_flags(target_type, target_id);