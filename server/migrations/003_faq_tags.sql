-- 003_faq_tags.sql
-- FAQ tagging system

CREATE TABLE IF NOT EXISTS faq_tags (
  name         TEXT PRIMARY KEY,
  color        TEXT NOT NULL DEFAULT '#6b7280',
  usage_count  INTEGER NOT NULL DEFAULT 0
);

-- Junction table: many-to-many between questions and tags
CREATE TABLE IF NOT EXISTS question_tags (
  question_id TEXT NOT NULL,
  tag_name    TEXT NOT NULL,
  PRIMARY KEY (question_id, tag_name),
  FOREIGN KEY (tag_name) REFERENCES faq_tags(name) ON DELETE CASCADE
);

-- Seed default tags
INSERT OR IGNORE INTO faq_tags (name, color) VALUES
  ('General',     '#6b7280'),
  ('IT',          '#3b82f6'),
  ('HR',          '#ec4899'),
  ('Finance',     '#10b981'),
  ('Academic',    '#8b5cf6'),
  ('Facilities',  '#f59e0b'),
  ('Security',    '#ef4444'),
  ('Email',       '#06b6d4'),
  ('Network',     '#6366f1'),
  ('Password',    '#f97316'),
  ('Transport',   '#84cc16'),
  ('Visa',        '#14b8a6'),
  ('Interview',   '#a855f7'),
  ('Salary',      '#22c55e'),
  ('Mental Health','#f43f5e');

-- Backfill usage counts from existing questions (questions with status='published')
UPDATE faq_tags
SET usage_count = (
  SELECT COUNT(DISTINCT qt.question_id)
  FROM question_tags qt
  JOIN questions q ON q.id = qt.question_id
  WHERE q.faq_status = 'published'
    AND qt.tag_name = faq_tags.name
);

-- Index for fast tag lookup by usage
CREATE INDEX IF NOT EXISTS idx_faq_tags_usage
  ON faq_tags(usage_count DESC);