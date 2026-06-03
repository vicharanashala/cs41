-- 001_faq_status.sql
-- Faculty Dashboard phase 1: FAQ status workflow columns

-- Questions: FAQ lifecycle status
ALTER TABLE questions ADD COLUMN faq_status TEXT NOT NULL DEFAULT 'community'
  CHECK (faq_status IN ('community','pending_review','published','rejected','changes_requested','merged','unpublished'));

-- Why the question entered review queue (null if community)
ALTER TABLE questions ADD COLUMN review_reason TEXT;

-- Faculty publication tracking
ALTER TABLE questions ADD COLUMN published_by TEXT;
ALTER TABLE questions ADD COLUMN published_at INTEGER;
ALTER TABLE questions ADD COLUMN merged_into TEXT;

-- View count for quality scoring
ALTER TABLE questions ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

-- Seed: backfill published status for questions with accepted answers
-- Any question with an accepted answer is considered "published" (existing behavior)
UPDATE questions
SET faq_status = 'published'
WHERE id IN (
  SELECT DISTINCT q.id
  FROM questions q
  JOIN answers a ON a.question_id = q.id
  WHERE a.is_accepted = 1
);

-- Answers: featured in FAQ body
ALTER TABLE answers ADD COLUMN featured_in_faq INTEGER NOT NULL DEFAULT 0;

-- Which faculty member accepted (nullable — null = intern accepted or no acceptance)
ALTER TABLE answers ADD COLUMN accepted_by TEXT;

-- Index for fast status filtering
CREATE INDEX IF NOT EXISTS idx_questions_faq_status ON questions(faq_status);

-- Index for fast merged_into lookups
CREATE INDEX IF NOT EXISTS idx_questions_merged_into ON questions(merged_into);

-- Index for fast answer filtering by question
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);

-- Index for fast featured answer lookup
CREATE INDEX IF NOT EXISTS idx_answers_featured ON answers(featured_in_faq) WHERE featured_in_faq = 1;