-- 009_moderation.sql
-- Content moderation: extended flag tracking + moderation action field

-- Track what the faculty member actually did when resolving a flag
-- (supplemental to the existing CHECK constraint on status)
ALTER TABLE content_flags ADD COLUMN resolved_action TEXT
  CHECK (resolved_action IN ('removed_content','warned_user','dismissed_flag','no_action','escalated'));

-- Index for fast moderation queue: open flags grouped by target
-- (existing idx_content_flags_status covers open flags by time)
CREATE INDEX IF NOT EXISTS idx_moderation_open_target
  ON content_flags(target_type, target_id)
  WHERE status = 'open';

-- Audit trail extension: moderation actions stored in audit_log
-- (audit_log already created by 008_faq_tags_audit.sql)
-- No new tables needed; moderation actions use the same audit() helper as other faculty ops.