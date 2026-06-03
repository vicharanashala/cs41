-- 010_sp_management.sql
-- SP Management module schema: fixes column mismatches from 004, adds freeze fields

-- ── sp_adjustments: rename student_id→user_id, amount→points_delta, drop category/ip/ref ──
ALTER TABLE sp_adjustments RENAME TO sp_adjustments_old;

CREATE TABLE sp_adjustments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  faculty_id  TEXT NOT NULL,
  points_delta INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (faculty_id) REFERENCES users(id)
);

INSERT INTO sp_adjustments (id, user_id, faculty_id, points_delta, reason, created_at)
SELECT id, student_id, faculty_id, amount, reason, created_at FROM sp_adjustments_old;

DROP TABLE sp_adjustments_old;

-- ── sp_anomaly_events: add anomaly_type, severity, description; keep score/flags for compat ──
ALTER TABLE sp_anomaly_events ADD COLUMN anomaly_type TEXT;
ALTER TABLE sp_anomaly_events ADD COLUMN severity TEXT;
ALTER TABLE sp_anomaly_events ADD COLUMN description TEXT;

-- ── users: add account freeze fields ──
ALTER TABLE users ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN frozen_by  TEXT;
ALTER TABLE users ADD COLUMN frozen_at  INTEGER;

-- ── Additional indexes ──
CREATE INDEX IF NOT EXISTS idx_users_frozen            ON users(is_frozen);
CREATE INDEX IF NOT EXISTS idx_adjustments_faculty     ON sp_adjustments(faculty_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_priority ON sp_watchlist(user_id, priority, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_user_status     ON sp_anomaly_events(user_id, status, created_at DESC);