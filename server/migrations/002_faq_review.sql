-- 002_faq_review.sql
-- Faculty FAQ review queue audit trail

-- One row per active review queue entry; re-escalation creates a new row
CREATE TABLE IF NOT EXISTS faq_review_log (
  id              TEXT PRIMARY KEY,
  question_id     TEXT NOT NULL UNIQUE,            -- UNIQUE = one active entry per question
  student_author  TEXT NOT NULL,
  trigger_event   TEXT NOT NULL,                    -- 'upvote_threshold'|'faculty_flag'|'manual'|'re_escaled'
  trigger_at      INTEGER NOT NULL,                 -- unix timestamp ms
  trigger_upvotes INTEGER NOT NULL,                 -- snapshot of net upvotes at entry time
  reviewed_by     TEXT,
  decision        TEXT,                             -- 'published'|'rejected'|'changes_requested'|'merged'|null
  decision_at     INTEGER,
  faculty_notes   TEXT,
  ai_confidence   REAL,
  revision_count  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (question_id)    REFERENCES questions(id),
  FOREIGN KEY (student_author) REFERENCES users(id),
  FOREIGN KEY (reviewed_by)    REFERENCES users(id)
);

-- Full history of every Faculty action on a question (append-only)
CREATE TABLE IF NOT EXISTS faq_revision_log (
  id              TEXT PRIMARY KEY,
  question_id     TEXT NOT NULL,
  reviewed_by     TEXT NOT NULL,                    -- 'system' for automated entries
  action          TEXT NOT NULL,                    -- 'queued'|'published'|'rejected'|'changes_requested'|'unpublished'|'merged'|'ai_analyzed'
  notes           TEXT,                             -- Faculty notes or AI generation context
  diff_summary    TEXT,                             -- human-readable change summary
  ai_confidence   REAL,                             -- snapshot of AI confidence at time of action
  quality_score   REAL,                             -- snapshot of quality score at time of action
  created_at      INTEGER NOT NULL,                 -- unix timestamp ms
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- Index for fast queue lookup by status + time
CREATE INDEX IF NOT EXISTS idx_review_log_decision
  ON faq_review_log(decision, trigger_at);

-- Index for fast per-question history lookup
CREATE INDEX IF NOT EXISTS idx_revision_log_question
  ON faq_revision_log(question_id, created_at);

-- Index for fast queue entry by question
CREATE INDEX IF NOT EXISTS idx_review_log_question
  ON faq_review_log(question_id);