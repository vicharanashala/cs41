-- 006_faq_ai_analysis.sql
-- AI-generated FAQ analysis, quality scoring, and duplicate detection cache

CREATE TABLE IF NOT EXISTS faq_ai_analysis (
  question_id     TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  generated_at    INTEGER NOT NULL,                           -- unix timestamp ms
  faq_title       TEXT NOT NULL,                              -- AI-proposed FAQ title (imperative form)
  faq_description TEXT NOT NULL,                              -- AI-proposed answer body
  category        TEXT NOT NULL,                              -- AI-proposed category
  confidence      REAL NOT NULL,                              -- 0.0-1.0 AI confidence
  quality_score   REAL NOT NULL,                              -- 0.0-1.0 computed quality score
  similar_faq_ids TEXT,                                       -- JSON: ['faq_id_1', 'faq_id_2']
  similar_scores  TEXT,                                       -- JSON: [0.91, 0.74]
  flag_reasons    TEXT,                                       -- JSON: ['low_quality_score', 'no_answers', ...]
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Index for fast quality lookup (for quality management page)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_quality
  ON faq_ai_analysis(quality_score ASC);

-- Index for fast confidence lookup (for suggestion queue)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_confidence
  ON faq_ai_analysis(confidence DESC);

-- Index for fast analysis lookup by question (already covered by PRIMARY KEY)
-- Additional index for analytics: questions needing analysis
CREATE INDEX IF NOT EXISTS idx_ai_analysis_generated
  ON faq_ai_analysis(generated_at DESC);