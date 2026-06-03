-- 007_faculty_queue.sql
-- Auto-promote community FAQ candidates to pending_review when threshold is hit.
-- Also add trigger_snapshot columns to questions for the review queue.

-- Track what triggered the pending_review transition (for the review log)
ALTER TABLE questions ADD COLUMN trigger_event TEXT;
ALTER TABLE questions ADD COLUMN trigger_upvotes INTEGER;
ALTER TABLE questions ADD COLUMN trigger_at INTEGER;

-- When a question's net upvotes >= FAQ_PROMOTION_THRESHOLD, auto-promote to pending_review
-- This is a simpler alternative to the vote trigger: we also call this from the vote handler.
-- The threshold constant must match the application (default: 10 net upvotes).