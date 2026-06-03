-- 008_faq_tags_audit.sql
-- FAQ tags system + audit logging for Phase 4 & 5.

-- Faculty-managed tags
CREATE TABLE IF NOT EXISTS faq_tags (
  id           TEXT PRIMARY KEY,
  name         TEXT UNIQUE NOT NULL,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  description  TEXT,
  created_by   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  usage_count  INTEGER NOT NULL DEFAULT 0
);

-- Junction: which tags are applied to which questions (faculty-only apply/remove)
CREATE TABLE IF NOT EXISTS faq_tag_applications (
  question_id  TEXT NOT NULL,
  tag_id       TEXT NOT NULL,
  applied_by   TEXT NOT NULL,
  applied_at   INTEGER NOT NULL,
  PRIMARY KEY (question_id, tag_id),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (tag_id)      REFERENCES faq_tags(id),
  FOREIGN KEY (applied_by)  REFERENCES users(id)
);

-- Full audit trail for all faculty actions
CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  actor_id     TEXT NOT NULL,
  actor_name   TEXT,
  details      TEXT,
  metadata     TEXT,
  created_at   INTEGER NOT NULL
);