import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireFaculty } from '../middleware/auth.js';
import { queryAll, queryOne, run, getDb, beginTransaction, commitTransaction, rollbackTransaction } from '../db/database.js';
import { analyzeQuestion } from '../utils/ai-engine.js';

const router = Router();
router.use(requireFaculty);

const FAQ_THRESHOLD = 10;

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/** Write a row to the audit_log table. */
function audit(action, entityType, entityId, details = null, metadata = null) {
  try {
    run(
      'INSERT INTO audit_log (id, action, entity_type, entity_id, actor_id, actor_name, details, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), action, entityType, entityId, 'faculty', null, details || null, metadata ? JSON.stringify(metadata) : null, Date.now()]
    );
  } catch (e) {
    console.error('[audit] failed:', e.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  const pending   = queryOne('SELECT COUNT(*) as c FROM questions WHERE faq_status = ?', ['pending_review'])?.c || 0;
  const published = queryOne('SELECT COUNT(*) as c FROM questions WHERE faq_status = ?', ['published'])?.c || 0;
  const rejected  = queryOne('SELECT COUNT(*) as c FROM questions WHERE faq_status = ?', ['rejected'])?.c || 0;
  const changes   = queryOne("SELECT COUNT(*) as c FROM questions WHERE faq_status = 'changes_requested'")?.c || 0;
  const total     = queryOne('SELECT COUNT(*) as c FROM questions')?.c || 0;

  // Avg time in queue
  const avgQueueHours = queryOne(`
    SELECT AVG((strftime('%s','now') - trigger_at) / 3600.0) as h
    FROM questions
    WHERE faq_status = 'pending_review' AND trigger_at IS NOT NULL
  `)?.h || 0;

  // This week's reviews
  const reviewedThisWeek = queryOne(`
    SELECT COUNT(*) as c FROM faq_revision_log
    WHERE action IN ('published','rejected','changes_requested')
      AND created_at >= strftime('%s','now','-7 days') * 1000
  `)?.c || 0;

  // AI stats
  const analyzedCount = queryOne("SELECT COUNT(*) as c FROM faq_ai_analysis")?.c || 0;
  const avgConfidence = queryOne("SELECT AVG(confidence) as avg FROM faq_ai_analysis WHERE confidence IS NOT NULL")?.avg || 0;

  // Recently analyzed
  const recentAnalyses = queryAll(`
    SELECT a.question_id, a.confidence, a.quality_score, a.generated_at, q.title
    FROM faq_ai_analysis a
    JOIN questions q ON a.question_id = q.id
    WHERE a.generated_at IS NOT NULL
    ORDER BY a.generated_at DESC
    LIMIT 5
  `);

  // Intern stats
  const totalInterns = queryOne("SELECT COUNT(*) as c FROM users WHERE role IN ('student','intern')")?.c || 0;

  // New questions from interns (recent questions submitted by intern/student users)
  const recentInternQuestions = queryAll(`
    SELECT q.id, q.title, q.category, q.faq_status, q.trigger_event, q.trigger_at, q.created_at,
           u.name as author_name, u.email as author_email,
           COALESCE(a_count.answer_count, 0) as answer_count
    FROM questions q
    JOIN users u ON q.user_id = u.id
    LEFT JOIN (SELECT question_id, COUNT(*) as answer_count FROM answers GROUP BY question_id) a_count ON q.id = a_count.question_id
    WHERE u.role IN ('intern', 'student')
    ORDER BY q.created_at DESC
    LIMIT 10
  `);

  // Recently added interns (for SP management table on dashboard)
  const recentlyAddedInterns = queryAll(`
    SELECT u.id, u.name, u.email, u.reputation, u.role, u.is_frozen, u.created_at,
           (SELECT COUNT(*) FROM sp_watchlist w WHERE w.user_id = u.id) as watchlist_entries
    FROM users u
    WHERE u.role = 'intern'
    ORDER BY u.created_at DESC
    LIMIT 20
  `);

  res.json({
    stats: {
      pending, published, rejected, changes, total,
      avgQueueHours: Math.round(avgQueueHours * 10) / 10,
      analyzedCount,
      avgConfidence: Math.round(avgConfidence),
      totalInterns,
    },
    reviewedThisWeek,
    recentAnalyses,
    recentInternQuestions,
    recentlyAddedInterns,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// QUEUE LIST  (enhanced with tags + quality scores)
// ──────────────────────────────────────────────────────────────────────────────

router.get('/queue', (req, res) => {
  const { status = 'pending_review', sort = 'trigger_at', page = 1 } = req.query;
  const limit = 20, offset = (Number(page) - 1) * limit;

  let where = "faq_status = 'pending_review'";
  if (status === 'all')        where = "faq_status IN ('pending_review','published','rejected','changes_requested','merged','unpublished')";
  else if (status === 'published')    where = "faq_status = 'published'";
  else if (status === 'rejected')     where = "faq_status = 'rejected'";
  else if (status === 'changes')      where = "faq_status = 'changes_requested'";
  else if (status === 'archived')     where = "faq_status = 'archived'";
  else if (status === 'merged')       where = "faq_status = 'merged'";
  else if (status !== 'pending_review') where = "faq_status = 'pending_review'";

  let orderBy = 'trigger_at DESC';
  if (sort === 'upvotes')    orderBy = 'trigger_upvotes DESC';
  if (sort === 'views')      orderBy = 'views DESC';
  if (sort === 'answers')    orderBy = 'answer_count DESC';
  if (sort === 'quality')    orderBy = 'created_at DESC';
  if (sort === 'created_at') orderBy = 'created_at DESC';

  const total = queryOne(`SELECT COUNT(*) as c FROM questions WHERE ${where}`)?.c || 0;

  const questions = queryAll(`
    SELECT
      q.id, q.title, q.category, q.faq_status, q.trigger_event, q.trigger_upvotes,
      q.trigger_at, q.views, q.created_at,
      u.name as author_name, u.reputation as author_reputation,
      COALESCE(a_count.answer_count, 0) as answer_count,
      COALESCE(v.upvotes, 0) as upvotes,
      COALESCE(v.downvotes, 0) as downvotes
    FROM questions q
    JOIN users u ON q.user_id = u.id
    LEFT JOIN (SELECT question_id, COUNT(*) as answer_count FROM answers GROUP BY question_id) a_count ON q.id = a_count.question_id
    LEFT JOIN (
      SELECT target_id,
             COUNT(*) as net_votes,
             SUM(CASE WHEN direction = 'up'   THEN 1 ELSE 0 END) as upvotes,
             SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) as downvotes
      FROM votes WHERE target_type = 'question' GROUP BY target_id
    ) v ON q.id = v.target_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  // Attach tags for each question
  const questionsWithTags = questions.map(q => {
    const tags = queryAll(`
      SELECT t.name, t.color
      FROM faq_tags t
      JOIN faq_tag_applications ta ON ta.tag_id = t.name
      WHERE ta.question_id = ?
    `, [q.id]);
    return { ...q, tags };
  });

  res.json({ questions: questionsWithTags, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

// ──────────────────────────────────────────────────────────────────────────────
// QUEUE STATS
// ──────────────────────────────────────────────────────────────────────────────

router.get('/queue/stats', (req, res) => {
  const pending   = queryOne("SELECT COUNT(*) as c FROM questions WHERE faq_status = 'pending_review'")?.c || 0;
  const published = queryOne("SELECT COUNT(*) as c FROM questions WHERE faq_status = 'published'")?.c || 0;
  const rejected  = queryOne("SELECT COUNT(*) as c FROM questions WHERE faq_status = 'rejected'")?.c || 0;
  const changes   = queryOne("SELECT COUNT(*) as c FROM questions WHERE faq_status = 'changes_requested'")?.c || 0;

  const avgQueueHours = queryOne(`
    SELECT AVG((strftime('%s','now') - trigger_at) / 3600.0) as h
    FROM questions WHERE faq_status = 'pending_review' AND trigger_at IS NOT NULL
  `)?.h || 0;

  const categoryBreakdown = queryAll(`
    SELECT category, COUNT(*) as count
    FROM questions WHERE faq_status = 'pending_review'
    GROUP BY category ORDER BY count DESC
  `);

  const triggerBreakdown = queryAll(`
    SELECT trigger_event as event, COUNT(*) as count
    FROM questions WHERE faq_status = 'pending_review'
    GROUP BY trigger_event ORDER BY count DESC
  `);

  const avgConfidence = queryOne(`
    SELECT AVG(confidence) as avg FROM faq_ai_analysis
  `)?.avg || 0;

  res.json({ pending, published, rejected, changes, avgQueueHours: Math.round(avgQueueHours * 10) / 10, categoryBreakdown, triggerBreakdown, avgConfidence: Math.round(avgConfidence) });
});

// ──────────────────────────────────────────────────────────────────────────────
// QUESTION DETAIL  (enhanced: full AI analysis + tags)
// ──────────────────────────────────────────────────────────────────────────────

router.get('/questions/:id', (req, res) => {
  const question = queryOne(`
    SELECT q.*, u.name as author_name, u.reputation as author_reputation, u.email as author_email
    FROM questions q JOIN users u ON q.user_id = u.id WHERE q.id = ?
  `, [req.params.id]);

  if (!question) return res.status(404).json({ error: 'Question not found' });

  const upvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', question.id, 'up'])?.c || 0;
  const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', question.id, 'down'])?.c || 0;
  const views     = question.views || 0;

  // Applied tags
  const tags = queryAll(`
    SELECT t.name, t.color, ta.applied_at, ta.applied_by
    FROM faq_tags t
    JOIN faq_tag_applications ta ON ta.tag_id = t.name
    WHERE ta.question_id = ?
  `, [question.id]);

  // AI analysis
  const aiAnalysis = queryOne('SELECT * FROM faq_ai_analysis WHERE question_id = ?', [question.id]);

  // History
  const history = queryAll(`
    SELECT r.*, u.name as reviewed_by_name
    FROM faq_revision_log r
    LEFT JOIN users u ON r.reviewed_by = u.id
    WHERE r.question_id = ? ORDER BY r.created_at ASC
  `, [question.id]);

  res.json({
    question: {
      ...question,
      tags,
      upvotes, downvotes,
      score: upvotes - downvotes,
      engagement: {
        views,
        answerCount: queryOne('SELECT COUNT(*) as c FROM answers WHERE question_id = ?', [question.id])?.c || 0,
      },
      trigger: question.trigger_event ? {
        event: question.trigger_event,
        upvotes: question.trigger_upvotes,
        at: question.trigger_at,
      } : null,
    },
    history,
    aiAnalysis,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// QUESTION ANSWERS
// ──────────────────────────────────────────────────────────────────────────────

router.get('/questions/:id/answers', (req, res) => {
  const answers = queryAll(`
    SELECT a.*, u.name as author_name, u.reputation as author_reputation,
           u.email as author_email
    FROM answers a JOIN users u ON a.user_id = u.id
    WHERE a.question_id = ?
    ORDER BY a.is_accepted DESC, a.created_at ASC
  `, [req.params.id]);

  const answersWithVotes = answers.map(a => ({
    ...a,
    upvotes:   queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['answer', a.id, 'up'])?.c || 0,
    downvotes: queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['answer', a.id, 'down'])?.c || 0,
  }));

  res.json({ answers: answersWithVotes });
});

// ──────────────────────────────────────────────────────────────────────────────
// REVIEW ACTION  (Phase 5: full suite + auto-analysis)
// ──────────────────────────────────────────────────────────────────────────────

router.post('/questions/:id/review', (req, res) => {
  const { action, notes, quality_score } = req.body;
  const VALID_ACTIONS = ['published', 'rejected', 'changes_requested', 'unpublished', 'merged', 'archived'];
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  const question = queryOne('SELECT * FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  beginTransaction();
  try {
    run("UPDATE questions SET faq_status = ? WHERE id = ?", [action, req.params.id]);

    // Log to revision history
    run(
      'INSERT INTO faq_revision_log (id, question_id, reviewed_by, action, notes, ai_confidence, quality_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, req.user.id, action, notes || null, null, quality_score || null, Date.now()]
    );

    commitTransaction();
  } catch (err) {
    rollbackTransaction();
    console.error('Review action failed:', err.message);
    return res.status(500).json({ error: 'Review action failed — please try again' });
  }

  // Auto-trigger AI analysis on status change
  let newAnalysis = null;
  try {
    newAnalysis = analyzeQuestion(req.params.id);
    if (newAnalysis) {
      upsertAIAnalysis(req.params.id, newAnalysis);
    }
  } catch (e) {
    console.error('[analyze] on review failed:', e.message);
  }

  audit(`faq.${action}`, 'question', req.params.id, notes || null, { quality_score });

  const updated = queryOne('SELECT * FROM questions WHERE id = ?', [req.params.id]);
  res.json({ question: updated, aiAnalysis: newAnalysis });
});

// ──────────────────────────────────────────────────────────────────────────────
// REVIEW HISTORY
// ──────────────────────────────────────────────────────────────────────────────

router.get('/questions/:id/history', (req, res) => {
  const history = queryAll(`
    SELECT r.*, u.name as reviewed_by_name
    FROM faq_revision_log r
    LEFT JOIN users u ON r.reviewed_by = u.id
    WHERE r.question_id = ? ORDER BY r.created_at ASC
  `, [req.params.id]);
  res.json({ history });
});

// ──────────────────────────────────────────────────────────────────────────────
// AI ANALYSIS  (trigger re-analysis)
// ──────────────────────────────────────────────────────────────────────────────

router.post('/questions/:id/analyze', (req, res) => {
  const question = queryOne('SELECT id FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  let analysis;
  try {
    analysis = analyzeQuestion(req.params.id);
    if (!analysis) return res.status(500).json({ error: 'Analysis failed' });
    upsertAIAnalysis(req.params.id, analysis);
  } catch (err) {
    console.error('[analyze] failed:', err.message);
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }

  audit('faq.analyzed', 'question', req.params.id, `AI analysis re-run. confidence=${analysis.confidence}`);

  res.json({ analysis });
});

// ──────────────────────────────────────────────────────────────────────────────
// TAGS  (Faculty-only management + application)
// ──────────────────────────────────────────────────────────────────────────────

// GET /faculty/tags — list all tags with usage counts
router.get('/tags', (req, res) => {
  const tags = queryAll(`
    SELECT t.name, t.color, t.usage_count
    FROM faq_tags t
    ORDER BY t.usage_count DESC, t.name ASC
  `);
  res.json({ tags });
});

// POST /faculty/tags — create a new tag
router.post('/tags', (req, res) => {
  const { name, color, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Tag name is required' });
  if (name.length > 40) return res.status(400).json({ error: 'Tag name must be ≤40 characters' });

  const existing = queryOne('SELECT name FROM faq_tags WHERE LOWER(name) = LOWER(?)', [name.trim()]);
  if (existing) return res.status(409).json({ error: 'A tag with this name already exists' });

  run(
    'INSERT INTO faq_tags (name, color, usage_count) VALUES (?, ?, ?)',
    [name.trim(), color || '#6366f1', 0]
  );

  audit('tag.created', 'faq_tag', name.trim(), `Tag "${name}" created`);

  const tag = queryOne('SELECT * FROM faq_tags WHERE name = ?', [name.trim()]);
  res.status(201).json({ tag });
});

// DELETE /faculty/tags/:tagId — delete a tag (removes applications)
router.delete('/tags/:tagId', (req, res) => {
  const tag = queryOne('SELECT * FROM faq_tags WHERE name = ?', [req.params.tagId]);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  // Remove all applications first (FK cascade should handle this, but be explicit)
  run('DELETE FROM faq_tag_applications WHERE tag_id = ?', [req.params.tagId]);
  run('DELETE FROM faq_tags WHERE name = ?', [req.params.tagId]);

  audit('tag.deleted', 'faq_tag', req.params.tagId, `Tag "${tag.name}" deleted`);

  res.json({ success: true });
});

// POST /faculty/tags/apply/:questionId — apply tags to a question
router.post('/tags/apply/:questionId', (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids must be an array' });
  if (tag_ids.length === 0) return res.status(400).json({ error: 'At least one tag_id is required' });

  const question = queryOne('SELECT id FROM questions WHERE id = ?', [req.params.questionId]);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  const db = getDb();
  beginTransaction();
  try {
    for (const tagId of tag_ids) {
      if (!tagId) { rollbackTransaction(); return res.status(400).json({ error: 'Invalid tag_id: null or undefined' }); }
      const tag = queryOne('SELECT name FROM faq_tags WHERE name = ?', [tagId]);
      if (!tag) { rollbackTransaction(); return res.status(400).json({ error: `Tag "${tagId}" not found` }); }

      try {
        run(
          'INSERT INTO faq_tag_applications (question_id, tag_id, applied_by, applied_at) VALUES (?, ?, ?, ?)',
          [req.params.questionId, tagId, req.user.id, Date.now()]
        );
        run('UPDATE faq_tags SET usage_count = usage_count + 1 WHERE name = ?', [tagId]);
      } catch (e) {
        if (e.message.includes('UNIQUE constraint')) {
          continue; // already applied
        }
        throw e;
      }
    }
    commitTransaction();
  } catch (err) {
    rollbackTransaction();
    return res.status(500).json({ error: 'Failed to apply tags: ' + err.message });
  }

  audit('faq.tags_applied', 'question', req.params.questionId, `Applied ${tag_ids.length} tag(s)`, { tag_ids });

  // Return updated tags
  const tags = queryAll(`
    SELECT t.name, t.color FROM faq_tags t
    JOIN faq_tag_applications ta ON ta.tag_id = t.name
    WHERE ta.question_id = ?
  `, [req.params.questionId]);

  res.json({ success: true, tags });
});

// DELETE /faculty/tags/remove/:questionId/:tagId — remove a tag from a question
router.delete('/tags/remove/:questionId/:tagId', (req, res) => {
  const app = queryOne(
    'SELECT * FROM faq_tag_applications WHERE question_id = ? AND tag_id = ?',
    [req.params.questionId, req.params.tagId]
  );
  if (!app) return res.status(404).json({ error: 'Tag not applied to this question' });

  run('DELETE FROM faq_tag_applications WHERE question_id = ? AND tag_id = ?', [req.params.questionId, req.params.tagId]);
  run('UPDATE faq_tags SET usage_count = MAX(0, usage_count - 1) WHERE name = ?', [req.params.tagId]);

  audit('faq.tag_removed', 'question', req.params.questionId, `Tag ${req.params.tagId} removed`);

  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// BULK OPERATIONS
// ──────────────────────────────────────────────────────────────────────────────

router.post('/bulk-action', (req, res) => {
  const { action, question_ids, notes } = req.body;
  const VALID_ACTIONS = ['published', 'rejected', 'archived', 'merged'];
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    return res.status(400).json({ error: 'question_ids must be a non-empty array' });
  }

  const db = getDb();
  beginTransaction();
  let processed = 0;
  let errors = [];

  try {
    for (const id of question_ids) {
      const q = queryOne('SELECT id FROM questions WHERE id = ?', [id]);
      if (!q) { errors.push({ id, error: 'Not found' }); continue; }

      run("UPDATE questions SET faq_status = ? WHERE id = ?", [action, id]);
      run(
        'INSERT INTO faq_revision_log (id, question_id, reviewed_by, action, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, req.user.id, action, notes || null, Date.now()]
      );
      processed++;
    }
    commitTransaction();
  } catch (err) {
    rollbackTransaction();
    return res.status(500).json({ error: 'Bulk action failed: ' + err.message, processed, errors });
  }

  audit(`faq.bulk.${action}`, 'question', question_ids.join(','), notes || null, { count: processed });

  res.json({ success: true, processed, errors: errors.length ? errors : undefined });
});

// ──────────────────────────────────────────────────────────────────────────────
// AUDIT LOG  (faculty-only)
// ──────────────────────────────────────────────────────────────────────────────

router.get('/audit', (req, res) => {
  const { entity_type, action, limit = 50, page = 1 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = '1=1';
  const params = [];
  if (entity_type) { where += ' AND entity_type = ?'; params.push(entity_type); }
  if (action)      { where += ' AND action LIKE ?';   params.push(`${action}%`); }

  const total = queryOne(`SELECT COUNT(*) as c FROM audit_log WHERE ${where}`, params)?.c || 0;

  const rows = queryAll(`
    SELECT * FROM audit_log WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  // Parse JSON metadata
  const parsed = rows.map(r => ({
    ...r,
    metadata: (() => { try { return JSON.parse(r.metadata || 'null'); } catch { return null; } })(),
  }));

  res.json({ entries: parsed, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

// ──────────────────────────────────────────────────────────────────────────────
// MODERATION  — content flagging queue and resolution
// ──────────────────────────────────────────────────────────────────────────────

const VALID_RESOLVE_ACTIONS = ['removed_content', 'warned_user', 'dismissed_flag', 'no_action', 'escalated'];

const REASON_LABELS = {
  spam: 'Spam',
  inappropriate: 'Inappropriate Content',
  wrong_info: 'Wrong Information',
  duplicate: 'Duplicate',
  too_vague: 'Too Vague',
  offensive: 'Offensive',
  other: 'Other',
};

// GET /faculty/moderation/queue — open flags, grouped by target, most urgent first
router.get('/moderation/queue', (req, res) => {
  const { status = 'open', target_type, page = 1 } = req.query;
  const limit = 25, offset = (Number(page) - 1) * limit;

  let where = "cf.status = 'open'";
  const params = [];
  if (status !== 'all') {
    where = "cf.status = ?";
    params.push(status);
  }
  if (target_type) {
    where += ' AND cf.target_type = ?';
    params.push(target_type);
  }

  // Count total open flags
  const total = queryOne(
    `SELECT COUNT(*) as c FROM content_flags cf WHERE ${where}`,
    params
  )?.c || 0;

  // Fetch open flags with target info and flag count per target
  const flags = queryAll(`
    SELECT
      cf.id, cf.target_type, cf.target_id, cf.reason, cf.details,
      cf.status, cf.resolved_action, cf.resolved_by, cf.resolved_at, cf.notes,
      cf.created_at,
      u_fla.name as flagged_by_name,
      q.title as question_title,
      q.faq_status as question_status,
      q.category as question_category,
      u_que.name as author_name,
      (SELECT COUNT(*) FROM content_flags cf2
       WHERE cf2.target_type = cf.target_type AND cf2.target_id = cf.target_id AND cf2.status = 'open') as open_flag_count
    FROM content_flags cf
    JOIN users u_fla ON cf.flagged_by = u_fla.id
    JOIN questions q ON cf.target_id = q.id
    JOIN users u_que ON q.user_id = u_que.id
    WHERE ${where}
    ORDER BY cf.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const parsed = flags.map(f => ({
    ...f,
    reason_label: REASON_LABELS[f.reason] || f.reason,
    resolved_at: f.resolved_at ? new Date(f.resolved_at).toISOString() : null,
    created_at: f.created_at ? new Date(f.created_at).toISOString() : null,
  }));

  res.json({ flags: parsed, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

// GET /faculty/moderation/stats — moderation overview stats
router.get('/moderation/stats', (req, res) => {
  const open       = queryOne("SELECT COUNT(*) as c FROM content_flags WHERE status = 'open'")?.c || 0;
  const reviewed   = queryOne("SELECT COUNT(*) as c FROM content_flags WHERE status = 'reviewed'")?.c || 0;
  const dismissed  = queryOne("SELECT COUNT(*) as c FROM content_flags WHERE status = 'dismissed'")?.c || 0;

  // Breakdown by reason
  const byReason = queryAll(`
    SELECT reason, COUNT(*) as count, GROUP_CONCAT(DISTINCT status) as statuses
    FROM content_flags
    GROUP BY reason
    ORDER BY count DESC
  `);

  // Breakdown by target_type
  const byTarget = queryAll(`
    SELECT target_type, COUNT(*) as count
    FROM content_flags
    WHERE status = 'open'
    GROUP BY target_type
    ORDER BY count DESC
  `);

  // Recently resolved (last 7 days)
  const resolved7d = queryOne(`
    SELECT COUNT(*) as c FROM content_flags
    WHERE status IN ('reviewed','dismissed')
      AND resolved_at >= ?
  `, [Date.now() - 7 * 24 * 3600 * 1000])?.c || 0;

  // Content with multiple open flags (high priority)
  const highPriority = queryAll(`
    SELECT target_type, target_id, COUNT(*) as flag_count, q.title as question_title
    FROM content_flags cf
    JOIN questions q ON cf.target_id = q.id
    WHERE cf.status = 'open'
    GROUP BY cf.target_type, cf.target_id
    HAVING flag_count >= 2
    ORDER BY flag_count DESC
    LIMIT 10
  `);

  res.json({
    open, reviewed, dismissed, resolved7d,
    byReason: byReason.map(r => ({ ...r, label: REASON_LABELS[r.reason] || r.reason })),
    byTarget,
    highPriority,
  });
});

// GET /faculty/moderation/:id — single flag detail with all flags on same target
router.get('/moderation/:id', (req, res) => {
  const flag = queryOne(`
    SELECT cf.*, u_fla.name as flagged_by_name, q.title as question_title,
           q.faq_status as question_status, u_que.name as author_name
    FROM content_flags cf
    JOIN users u_fla ON cf.flagged_by = u_fla.id
    JOIN questions q ON cf.target_id = q.id
    JOIN users u_que ON q.user_id = u_que.id
    WHERE cf.id = ?
  `, [req.params.id]);

  if (!flag) return res.status(404).json({ error: 'Flag not found' });

  // All other open flags on the same target
  const relatedFlags = queryAll(`
    SELECT cf.id, cf.reason, cf.details, cf.created_at, u.name as flagged_by_name
    FROM content_flags cf
    JOIN users u ON cf.flagged_by = u.id
    WHERE cf.target_type = ? AND cf.target_id = ? AND cf.id != ? AND cf.status = 'open'
    ORDER BY cf.created_at DESC
  `, [flag.target_type, flag.target_id, req.params.id]);

  res.json({
    flag: {
      ...flag,
      reason_label: REASON_LABELS[flag.reason] || flag.reason,
      created_at: flag.created_at ? new Date(flag.created_at).toISOString() : null,
      resolved_at: flag.resolved_at ? new Date(flag.resolved_at).toISOString() : null,
    },
    relatedFlags,
  });
});

// POST /faculty/moderation/:id/resolve — resolve a single flag
router.post('/moderation/:id/resolve', (req, res) => {
  const { action, notes } = req.body;
  if (!action || !VALID_RESOLVE_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_RESOLVE_ACTIONS.join(', ')}` });
  }

  const flag = queryOne('SELECT * FROM content_flags WHERE id = ?', [req.params.id]);
  if (!flag) return res.status(404).json({ error: 'Flag not found' });
  if (flag.status !== 'open') return res.status(409).json({ error: 'Flag is already resolved' });

  const nowMs = Date.now();
  const newStatus = action === 'dismissed_flag' ? 'dismissed' : 'reviewed';

  run(
    'UPDATE content_flags SET status = ?, resolved_action = ?, resolved_by = ?, resolved_at = ?, notes = ? WHERE id = ?',
    [newStatus, action, req.user.id, nowMs, notes || null, req.params.id]
  );

  audit(`flag.${action}`, 'content_flag', req.params.id, notes || null, {
    target_type: flag.target_type,
    target_id: flag.target_id,
    reason: flag.reason,
  });

  const updated = queryOne('SELECT * FROM content_flags WHERE id = ?', [req.params.id]);
  res.json({ flag: updated, message: `Flag ${action.replace('_', ' ')}.` });
});

// POST /faculty/moderation/bulk-dismiss — dismiss multiple flags
router.post('/moderation/bulk-dismiss', (req, res) => {
  const { flag_ids, notes } = req.body;
  if (!Array.isArray(flag_ids) || flag_ids.length === 0) {
    return res.status(400).json({ error: 'flag_ids must be a non-empty array' });
  }

  const nowMs = Date.now();
  const placeholders = flag_ids.map(() => '?').join(',');
  const params = [req.user.id, nowMs, notes || null, ...flag_ids];

  run(
    `UPDATE content_flags SET status = 'dismissed', resolved_action = 'dismissed_flag', resolved_by = ?, resolved_at = ?, notes = ? WHERE id IN (${placeholders}) AND status = 'open'`,
    params
  );

  audit('flag.bulk_dismissed', 'content_flag', flag_ids.join(','), notes || null, { count: flag_ids.length });

  res.json({ success: true, processed: flag_ids.length });
});

// GET /faculty/moderation/flagged-content — list all content with open flags (distinct targets)
router.get('/moderation/flagged-content', (req, res) => {
  const { page = 1 } = req.query;
  const limit = 25, offset = (Number(page) - 1) * limit;

  const total = queryOne(`
    SELECT COUNT(DISTINCT target_type || ':' || target_id) as c
    FROM content_flags WHERE status = 'open'
  `)?.c || 0;

  const items = queryAll(`
    SELECT
      cf.target_type, cf.target_id,
      q.title as question_title, q.faq_status, q.category,
      u.name as author_name,
      COUNT(*) as flag_count,
      json_group_array(cf.reason) as reasons,
      MIN(cf.created_at) as first_flagged_at,
      MAX(cf.created_at) as last_flagged_at
    FROM content_flags cf
    JOIN questions q ON cf.target_id = q.id
    JOIN users u ON q.user_id = u.id
    WHERE cf.status = 'open'
    GROUP BY cf.target_type, cf.target_id
    ORDER BY flag_count DESC, last_flagged_at DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  const parsed = items.map(i => ({
    ...i,
    reasons: [...new Set(JSON.parse(i.reasons || '[]'))].map(r => REASON_LABELS[r] || r),
    first_flagged_at: i.first_flagged_at ? new Date(i.first_flagged_at).toISOString() : null,
    last_flagged_at: i.last_flagged_at ? new Date(i.last_flagged_at).toISOString() : null,
  }));

  res.json({ items: parsed, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

// ──────────────────────────────────────────────────────────────────────────────
// AUTO-PROMOTION  (from votes)
// ──────────────────────────────────────────────────────────────────────────────

export function checkAutoPromote(questionId) {
  const question = queryOne('SELECT * FROM questions WHERE id = ?', [questionId]);
  if (!question) return false;
  if (question.faq_status !== 'community') return false;

  const upvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', questionId, 'up'])?.c || 0;
  const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', questionId, 'down'])?.c || 0;
  const netVotes  = upvotes - downvotes;

  if (netVotes >= FAQ_THRESHOLD) {
    const nowMs = Date.now();
    run("UPDATE questions SET faq_status=?, trigger_event='upvote_threshold', trigger_upvotes=?, trigger_at=? WHERE id=? AND faq_status='community'",
      ['pending_review', netVotes, nowMs, questionId]);

    try {
      run('INSERT INTO faq_revision_log (id, question_id, reviewed_by, action, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), questionId, 'system', 'queued', `Auto-promoted: ${netVotes} net upvotes (threshold: ${FAQ_THRESHOLD})`, nowMs]);

      // Auto-analyze on promotion
      const analysis = analyzeQuestion(questionId);
      if (analysis) upsertAIAnalysis(questionId, analysis);
    } catch (e) {
      console.error('Failed to log auto-promotion:', e.message);
    }

    return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// AI ANALYSIS UPSERT HELPER
// ──────────────────────────────────────────────────────────────────────────────

function upsertAIAnalysis(questionId, analysis) {
  const {
    quality: { score: quality_score },
    similar_faqs,
    moderation,
    confidence,
  } = analysis;

  // Fetch question data for the required title/description/category columns
  const question = queryOne('SELECT title, description, category FROM questions WHERE id = ?', [questionId]);
  const faqTitle       = question?.title       || '';
  const faqDescription = question?.description || '';
  const category       = question?.category    || '';

  const similarFaqIds = (similar_faqs || []).map(s => s.id);
  const similarScores = (similar_faqs || []).map(s => s.similarity);
  const flagReasons   = (moderation  || []).map(f => f.flag);

  const existing = queryOne('SELECT question_id FROM faq_ai_analysis WHERE question_id = ?', [questionId]);

  if (existing) {
    run(
      `UPDATE faq_ai_analysis SET
         generated_at=?, confidence=?, quality_score=?,
         faq_title=?, faq_description=?, category=?,
         similar_faq_ids=?, similar_scores=?, flag_reasons=?
       WHERE question_id=?`,
      [Date.now(), confidence, quality_score,
       faqTitle, faqDescription, category,
       JSON.stringify(similarFaqIds), JSON.stringify(similarScores), JSON.stringify(flagReasons),
       questionId]
    );
  } else {
    run(
      `INSERT INTO faq_ai_analysis
         (question_id, generated_at, confidence, quality_score,
          faq_title, faq_description, category,
          similar_faq_ids, similar_scores, flag_reasons)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [questionId, Date.now(), confidence, quality_score,
       faqTitle, faqDescription, category,
       JSON.stringify(similarFaqIds), JSON.stringify(similarScores), JSON.stringify(flagReasons)]
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// STUDENT SP MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

const SP_ACTIONS = {
  ask_question:          { label: 'Asked Question',         points: 2  },
  answer_question:        { label: 'Answered Question',       points: 5  },
  answer_accepted:        { label: 'Answer Accepted',         points: 15 },
  vote_received:          { label: 'Received Upvote',         points: 10 },
  vote_given:             { label: 'Gave Upvote',             points: -1 },
  answer_selected_best:   { label: 'Best Answer Selected',    points: 10 },
  question_published:     { label: 'Question Published',      points: 3  },
  flag_accepted:          { label: 'Valid Flag Review',       points: 5  },
  sp_purchase:            { label: 'SP Purchase',             points: 0  },
  sp_adjustment:          { label: 'Manual Adjustment',       points: 0  },
  account_frozen:         { label: 'Account Frozen',          points: -50},
  account_unfrozen:       { label: 'Account Unfrozen',        points: 0  },
};

// ── GET /faculty/interns/overview ────────────────────────────────────────────
router.get('/interns/overview', (req, res) => {
  const total = queryOne("SELECT COUNT(*) as c FROM users WHERE role IN ('student','intern')")?.c || 0;
  const active7d = queryOne(
    `SELECT COUNT(DISTINCT user_id) as c FROM sp_ledger WHERE created_at >= ?`,
    [Date.now() - 7 * 24 * 3600 * 1000]
  )?.c || 0;
  const frozenCount = queryOne('SELECT COUNT(*) as c FROM users WHERE is_frozen = 1 AND role IN (\'student\',\'intern\')')?.c || 0;
  const onWatchlist = queryOne('SELECT COUNT(*) as c FROM sp_watchlist')?.c || 0;
  const openAnomalies = queryOne("SELECT COUNT(*) as c FROM sp_anomaly_events WHERE status = 'open'")?.c || 0;

  // Role breakdown counts
  const internCount  = queryOne("SELECT COUNT(*) as c FROM users WHERE role = 'intern'")?.c || 0;
  const studentCount = queryOne("SELECT COUNT(*) as c FROM users WHERE role = 'student'")?.c || 0;

  // SP distribution buckets (intern + student)
  const distribution = queryAll(`
    SELECT
      CASE
        WHEN reputation < 0   THEN 'negative'
        WHEN reputation = 0   THEN 'zero'
        WHEN reputation < 50  THEN '1-49'
        WHEN reputation < 100 THEN '50-99'
        WHEN reputation < 250 THEN '100-249'
        WHEN reputation < 500 THEN '250-499'
        ELSE '500+'
      END as bucket,
      COUNT(*) as count
    FROM users WHERE role IN ('student','intern')
    GROUP BY bucket
    ORDER BY
      CASE bucket
        WHEN 'negative' THEN 1 WHEN 'zero' THEN 2 WHEN '1-49' THEN 3
        WHEN '50-99' THEN 4 WHEN '100-249' THEN 5 WHEN '250-499' THEN 6
        ELSE 7 END
  `);

  // Top 10 SP earners
  const topEarners = queryAll(`
    SELECT u.id, u.name, u.email, u.reputation, u.is_frozen, u.role, u.created_at
    FROM users u WHERE u.role IN ('student','intern') AND u.reputation > 0
    ORDER BY u.reputation DESC LIMIT 10
  `);

  // Bottom 5 (lowest SP)
  const bottomEarners = queryAll(`
    SELECT u.id, u.name, u.email, u.reputation, u.is_frozen, u.role, u.created_at
    FROM users u WHERE u.role IN ('student','intern')
    ORDER BY u.reputation ASC LIMIT 5
  `);

  res.json({
    totalInterns: internCount,
    activeLast7Days: active7d,
    frozenCount,
    onWatchlist,
    openAnomalies,
    distribution,
    topEarners: topEarners.map(u => ({ ...u, created_at: u.created_at ? new Date(u.created_at).toISOString() : null })),
    bottomEarners: bottomEarners.map(u => ({ ...u, created_at: u.created_at ? new Date(u.created_at).toISOString() : null })),
  });
});

// ── GET /faculty/interns ──────────────────────────────────────────────────────
router.get('/interns', (req, res) => {
  const { search, sort_by = 'reputation', order = 'desc', page = 1, sp_min, sp_max, is_frozen, on_watchlist } = req.query;
  const limit = 25, offset = (Number(page) - 1) * limit;

  const conditions = ['u.role = ?'];
  const params = ['intern'];

  if (search) {
    conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (sp_min !== undefined) { conditions.push('u.reputation >= ?'); params.push(Number(sp_min)); }
  if (sp_max !== undefined) { conditions.push('u.reputation <= ?'); params.push(Number(sp_max)); }
  if (is_frozen !== undefined) { conditions.push('u.is_frozen = ?'); params.push(is_frozen === 'true' ? 1 : 0); }
  if (on_watchlist === 'true') {
    conditions.push('EXISTS (SELECT 1 FROM sp_watchlist w WHERE w.user_id = u.id)');
  }

  const where = conditions.join(' AND ');
  const validSorts = ['reputation', 'name', 'created_at'];
  const sortCol = validSorts.includes(sort_by) ? sort_by : 'reputation';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  const total = queryOne(`SELECT COUNT(*) as c FROM users u WHERE ${where}`, params)?.c || 0;

  const interns = queryAll(`
    SELECT u.id, u.name, u.email, u.role, u.reputation, u.is_frozen,
           u.frozen_by, u.frozen_at, u.created_at,
           (SELECT COUNT(*) FROM sp_watchlist w WHERE w.user_id = u.id) as watchlist_entries,
           (SELECT COUNT(*) FROM sp_anomaly_events a WHERE a.user_id = u.id AND a.status = 'open') as open_anomalies
    FROM users u
    WHERE ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  res.json({
    interns: interns.map(s => ({
      ...s,
      frozen_at: s.frozen_at ? new Date(s.frozen_at).toISOString() : null,
      created_at: s.created_at ? new Date(s.created_at).toISOString() : null,
    })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

// ── GET /faculty/students/:id ─────────────────────────────────────────────────

// ── GET /faculty/students/watchlist ───────────────────────────────────────────
router.get('/interns/watchlist', (req, res) => {
  const { page = 1 } = req.query;
  const limit = 25, offset = (Number(page) - 1) * limit;
  const total = queryOne('SELECT COUNT(*) as c FROM sp_watchlist')?.c || 0;
  const entries = queryAll(`
    SELECT sw.user_id, sw.priority, sw.notes, sw.added_by, sw.added_at,
           u.name as student_name, u.email as student_email, u.reputation,
           (SELECT COUNT(*) FROM sp_anomaly_events a WHERE a.user_id = u.id AND a.status = 'open') as open_anomalies
    FROM sp_watchlist sw
    JOIN users u ON sw.user_id = u.id
    ORDER BY sw.priority DESC, sw.added_at DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  res.json({
    entries: entries.map(e => ({ ...e, added_at: e.added_at ? new Date(e.added_at).toISOString() : null })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

// ── GET /faculty/students/anomalies ───────────────────────────────────────────
router.get('/interns/anomalies', (req, res) => {
  const { status = 'open', severity, page = 1 } = req.query;
  const limit = 25, offset = (Number(page) - 1) * limit;

  const conditions = [];
  const params = [];
  if (status !== 'all') { conditions.push('sae.status = ?'); params.push(status); }
  if (severity) { conditions.push('sae.severity = ?'); params.push(severity); }

  const where = conditions.length ? conditions.join(' AND ') : '1=1';
  const total = queryOne(`SELECT COUNT(*) as c FROM sp_anomaly_events sae WHERE ${where}`, params)?.c || 0;

  const events = queryAll(`
    SELECT sae.id, sae.user_id, sae.anomaly_type, sae.severity, sae.status,
           sae.description, sae.resolved_by, sae.resolved_at, sae.created_at,
           u.name as student_name, u.email as student_email, u.reputation as current_sp
    FROM sp_anomaly_events sae
    JOIN users u ON sae.user_id = u.id
    WHERE ${where}
    ORDER BY
      CASE sae.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      sae.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  res.json({
    events: events.map(e => ({ ...e, created_at: e.created_at ? new Date(e.created_at).toISOString() : null, resolved_at: e.resolved_at ? new Date(e.resolved_at).toISOString() : null })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

// ── GET /faculty/students/stats ───────────────────────────────────────────────
// NOTE: This route MUST be defined before /interns/:id to prevent Express from
// matching /interns/stats as /interns/:id (treating 'stats' as the :id param).
router.get('/interns/stats', (req, res) => {
  const { user_id, days = 30 } = req.query;
  const since = Date.now() - Number(days) * 24 * 3600 * 1000;

  const baseWhere = user_id ? 'sl.user_id = ? AND' : '';
  const baseParams = user_id ? [user_id] : [];

  // SP net change over period
  const netChange = queryOne(
    `SELECT COALESCE(SUM(points), 0) as net FROM sp_ledger sl WHERE ${baseWhere} sl.created_at >= ?`,
    [...baseParams, since]
  )?.net || 0;

  // Daily SP delta for trend chart
  const dailyDelta = queryAll(`
    SELECT
      DATE(sl.created_at / 1000, 'unixepoch') as day,
      SUM(sl.points) as total_delta,
      COUNT(*) as transaction_count
    FROM sp_ledger sl
    WHERE ${baseWhere} sl.created_at >= ?
    GROUP BY day
    ORDER BY day ASC
  `, [...baseParams, since]);

  // Breakdown by action type
  const byAction = queryAll(`
    SELECT sl.action_type, SUM(sl.points) as total_delta, COUNT(*) as count
    FROM sp_ledger sl
    WHERE ${baseWhere} sl.created_at >= ?
    GROUP BY sl.action_type
    ORDER BY total_delta DESC
  `, [...baseParams, since]);

  // Top reference IDs (most active questions/answers)
  const topRefs = queryAll(`
    SELECT sl.reference_type, sl.reference_id, COUNT(*) as count, SUM(sl.points) as total_sp
    FROM sp_ledger sl
    WHERE ${baseWhere} sl.created_at >= ? AND sl.reference_id IS NOT NULL
    GROUP BY sl.reference_type, sl.reference_id
    ORDER BY total_sp DESC LIMIT 10
  `, [...baseParams, since]);

  // Anomaly spike detection: days where net change is > 3 std dev from mean
  const spikes = queryAll(`
    SELECT DATE(sl.created_at / 1000, 'unixepoch') as day, SUM(sl.points) as total
    FROM sp_ledger sl
    WHERE ${baseWhere} sl.created_at >= ?
    GROUP BY day
    HAVING total > 50 OR total < -30
    ORDER BY day DESC
  `, [...baseParams, since]);

  res.json({
    netChange, dailyDelta, byAction, topRefs, spikes,
    actionLabels: SP_ACTIONS,
  });
});

// ── GET /faculty/interns/:id/stats ─────────────────────────────────────────────
router.get('/interns/:id/stats', (req, res) => {
  const { days = 30 } = req.query;
  const since = Date.now() - Number(days) * 24 * 3600 * 1000;

  const student = queryOne('SELECT id, name, reputation, is_frozen FROM users WHERE id = ? AND role IN ("student","intern")', [req.params.id]);
  if (!student) return res.status(404).json({ error: 'Intern not found' });

  const netChange = queryOne(
    'SELECT COALESCE(SUM(points), 0) as net FROM sp_ledger WHERE user_id = ? AND created_at >= ?',
    [req.params.id, since]
  )?.net || 0;

  const dailyDelta = queryAll(`
    SELECT DATE(created_at / 1000, 'unixepoch') as day, SUM(points) as total_delta, COUNT(*) as transaction_count
    FROM sp_ledger WHERE user_id = ? AND created_at >= ?
    GROUP BY day ORDER BY day ASC
  `, [req.params.id, since]);

  const byAction = queryAll(`
    SELECT action_type, SUM(points) as total_delta, COUNT(*) as count
    FROM sp_ledger WHERE user_id = ? AND created_at >= ?
    GROUP BY action_type ORDER BY total_delta DESC
  `, [req.params.id, since]);

  const recentLedger = queryAll(`
    SELECT id, action_type, points, balance_after, description, created_at
    FROM sp_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `, [req.params.id]);

  res.json({ ...student, netChange, dailyDelta, byAction, recentLedger, actionLabels: SP_ACTIONS });
});

router.get('/interns/:id', (req, res) => {
  const student = queryOne(`
    SELECT u.id, u.name, u.email, u.reputation, u.is_frozen,
           u.frozen_by, u.frozen_at, u.created_at,
           (SELECT COUNT(*) FROM sp_watchlist w WHERE w.user_id = u.id) as watchlist_entries,
           (SELECT COUNT(*) FROM sp_anomaly_events a WHERE a.user_id = u.id AND a.status = 'open') as open_anomalies
    FROM users u WHERE u.id = ? AND u.role IN ('student','intern')
  `, [req.params.id]);

  if (!student) return res.status(404).json({ error: 'Intern not found' });

  const recentLedger = queryAll(`
    SELECT sl.id, sl.action_type, sl.points, sl.balance_after, sl.reference_id,
           sl.reference_type, sl.description, sl.created_at
    FROM sp_ledger sl WHERE sl.user_id = ?
    ORDER BY sl.created_at DESC LIMIT 20
  `, [req.params.id]);

  const recentAdjustments = queryAll(`
    SELECT sa.id, sa.points_delta, sa.reason, sa.faculty_id, sa.created_at,
           u.name as faculty_name
    FROM sp_adjustments sa
    JOIN users u ON sa.faculty_id = u.id
    WHERE sa.user_id = ?
    ORDER BY sa.created_at DESC LIMIT 10
  `, [req.params.id]);

  const openAnomalies = queryAll(`
    SELECT id, anomaly_type, severity, status, description, created_at, resolved_at
    FROM sp_anomaly_events
    WHERE user_id = ? AND status = 'open'
    ORDER BY severity DESC, created_at DESC
  `, [req.params.id]);

  res.json({
    student: {
      ...student,
      frozen_at: student.frozen_at ? new Date(student.frozen_at).toISOString() : null,
      created_at: student.created_at ? new Date(student.created_at).toISOString() : null,
    },
    recentLedger: recentLedger.map(r => ({ ...r, created_at: r.created_at ? new Date(r.created_at).toISOString() : null })),
    recentAdjustments: recentAdjustments.map(a => ({ ...a, created_at: a.created_at ? new Date(a.created_at).toISOString() : null })),
    openAnomalies: openAnomalies.map(a => ({ ...a, created_at: a.created_at ? new Date(a.created_at).toISOString() : null, resolved_at: a.resolved_at ? new Date(a.resolved_at).toISOString() : null })),
  });
});

// ── POST /faculty/students/:id/adjust ─────────────────────────────────────────
router.post('/interns/:id/adjust', (req, res) => {
  const { points_delta, reason } = req.body;
  if (points_delta === undefined || !reason) {
    return res.status(400).json({ error: 'points_delta and reason are required' });
  }
  const delta = Number(points_delta);
  if (isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: 'points_delta must be a non-zero number' });
  }
  if (Math.abs(delta) > 1000) {
    return res.status(400).json({ error: 'Adjustment magnitude cannot exceed 1000 SP' });
  }

  const student = queryOne('SELECT id, reputation, is_frozen FROM users WHERE id = ? AND role IN ("student","intern")', [req.params.id]);
  if (!student) return res.status(404).json({ error: 'Intern not found' });
  if (student.is_frozen) return res.status(409).json({ error: 'Cannot adjust SP for a frozen account' });

  const newBalance = student.reputation + delta;
  const nowMs = Date.now();
  const ledgerId = uuidv4();
  const anomalyId = uuidv4();

  run('UPDATE users SET reputation = ? WHERE id = ?', [newBalance, req.params.id]);
  run(
    `INSERT INTO sp_ledger (id, user_id, action_type, points, balance_after, reference_id, reference_type, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ledgerId, req.params.id, 'sp_adjustment', delta, newBalance, null, null, `Manual adjustment: ${reason}`, nowMs]
  );
  run(
    'INSERT INTO sp_adjustments (id, user_id, faculty_id, points_delta, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), req.params.id, req.user.id, delta, reason, nowMs]
  );
  // anomaly_score: 0.5 for manual faculty adjustments (low-risk). ledger_entry_id references
  // the ledger entry above. flags='manual' marks this as faculty-initiated.
  run(
    'INSERT INTO sp_anomaly_events (id, user_id, ledger_entry_id, anomaly_score, flags, anomaly_type, severity, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [anomalyId, req.params.id, ledgerId, 0.5, 'manual', 'manual_adjustment', delta < 0 ? 'high' : 'medium', 'resolved', `Faculty ${delta > 0 ? 'added' : 'deducted'} ${Math.abs(delta)} SP: ${reason}`, nowMs]
  );

  audit(`sp.adjust`, 'user', req.params.id, `delta=${delta}, reason=${reason}`, { points_delta: delta, new_balance: newBalance });

  const updated = queryOne('SELECT id, reputation FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true, student: updated, message: `SP ${delta > 0 ? 'added' : 'deducted'}: ${Math.abs(delta)} points` });
});

// ── POST /faculty/students/:id/freeze ─────────────────────────────────────────
router.post('/interns/:id/freeze', (req, res) => {
  const student = queryOne('SELECT id, name, is_frozen FROM users WHERE id = ? AND role IN ("student","intern")', [req.params.id]);
  if (!student) return res.status(404).json({ error: 'Intern not found' });
  if (student.is_frozen) return res.status(409).json({ error: 'Account is already frozen' });

  const nowMs = Date.now();
  const currentBalance = queryOne('SELECT reputation FROM users WHERE id = ?', [req.params.id])?.reputation || 0;
  run('UPDATE users SET is_frozen = 1, frozen_by = ?, frozen_at = ? WHERE id = ?', [req.user.id, nowMs, req.params.id]);

  run(
    `INSERT INTO sp_ledger (id, user_id, action_type, points, balance_after, reference_id, reference_type, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), req.params.id, 'account_frozen', -50, currentBalance, null, null, 'Account frozen by faculty', nowMs]
  );

  audit(`sp.freeze`, 'user', req.params.id, null, { frozen_by: req.user.id });

  res.json({ success: true, message: `${student.name}'s account has been frozen` });
});

// ── POST /faculty/students/:id/unfreeze ───────────────────────────────────────
router.post('/interns/:id/unfreeze', (req, res) => {
  const student = queryOne('SELECT id, name, is_frozen FROM users WHERE id = ? AND role IN ("student","intern")', [req.params.id]);
  if (!student) return res.status(404).json({ error: 'Intern not found' });
  if (!student.is_frozen) return res.status(409).json({ error: 'Account is not frozen' });

  const currentBalance = queryOne('SELECT reputation FROM users WHERE id = ?', [req.params.id])?.reputation || 0;
  run('UPDATE users SET is_frozen = 0, frozen_by = NULL, frozen_at = NULL WHERE id = ?', [req.params.id]);

  run(
    `INSERT INTO sp_ledger (id, user_id, action_type, points, balance_after, reference_id, reference_type, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), req.params.id, 'account_unfrozen', 0, currentBalance, null, null, 'Account unfrozen by faculty', Date.now()]
  );

  audit(`sp.unfreeze`, 'user', req.params.id, null, {});

  res.json({ success: true, message: `${student.name}'s account has been unfrozen` });
});

// ── GET /faculty/students/:id/ledger ──────────────────────────────────────────
router.get('/interns/:id/ledger', (req, res) => {
  const { page = 1, action_type, from_date, to_date } = req.query;
  const limit = 50, offset = (Number(page) - 1) * limit;

  const conditions = ['sl.user_id = ?'];
  const params = [req.params.id];
  if (action_type) { conditions.push('sl.action_type = ?'); params.push(action_type); }
  if (from_date) { conditions.push('sl.created_at >= ?'); params.push(new Date(from_date).getTime()); }
  if (to_date) { conditions.push('sl.created_at <= ?'); params.push(new Date(to_date).getTime()); }

  const where = conditions.join(' AND ');
  const total = queryOne(`SELECT COUNT(*) as c FROM sp_ledger sl WHERE ${where}`, params)?.c || 0;
  const entries = queryAll(`
    SELECT sl.id, sl.action_type, sl.points, sl.balance_after, sl.reference_id,
           sl.reference_type, sl.description, sl.created_at
    FROM sp_ledger sl WHERE ${where}
    ORDER BY sl.created_at DESC LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const runningTotal = queryOne(
    'SELECT SUM(points) as total FROM sp_ledger WHERE user_id = ?',
    [req.params.id]
  )?.total || 0;

  res.json({
    entries: entries.map(e => ({ ...e, created_at: e.created_at ? new Date(e.created_at).toISOString() : null })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
    runningTotal,
    actionLabels: SP_ACTIONS,
  });
});

// ── GET /faculty/students/:id/adjustments ─────────────────────────────────────
router.get('/interns/:id/adjustments', (req, res) => {
  const { page = 1 } = req.query;
  const limit = 50, offset = (Number(page) - 1) * limit;
  const total = queryOne('SELECT COUNT(*) as c FROM sp_adjustments WHERE user_id = ?', [req.params.id])?.c || 0;
  const adjustments = queryAll(`
    SELECT sa.id, sa.points_delta, sa.reason, sa.faculty_id, sa.created_at,
           u.name as faculty_name
    FROM sp_adjustments sa
    JOIN users u ON sa.faculty_id = u.id
    WHERE sa.user_id = ?
    ORDER BY sa.created_at DESC
    LIMIT ? OFFSET ?
  `, [req.params.id, limit, offset]);

  res.json({
    adjustments: adjustments.map(a => ({ ...a, created_at: a.created_at ? new Date(a.created_at).toISOString() : null })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});


// ── POST /faculty/students/watchlist ──────────────────────────────────────────
router.post('/interns/watchlist', (req, res) => {
  const { user_id, priority = 'normal', notes, reason = 'manual' } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const student = queryOne('SELECT id, name FROM users WHERE id = ? AND role IN ("student","intern")', [user_id]);
  if (!student) return res.status(404).json({ error: 'Intern not found' });

  // sp_watchlist has user_id as PRIMARY KEY — no separate 'id' column
  const existing = queryOne('SELECT user_id FROM sp_watchlist WHERE user_id = ?', [user_id]);
  if (existing) return res.status(409).json({ error: 'Intern is already on the watchlist' });

  const nowMs = Date.now();
  run(
    'INSERT INTO sp_watchlist (user_id, added_by, reason, priority, notes, added_at) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, req.user.id, reason, priority, notes || null, nowMs]
  );

  audit('sp.watchlist_add', 'user', user_id, notes || null, { priority });

  res.status(201).json({ success: true, user_id, message: `${student.name} added to watchlist` });
});

// ── DELETE /faculty/students/watchlist/:userId ────────────────────────────────
router.delete('/interns/watchlist/:userId', (req, res) => {
  // sp_watchlist has user_id as PRIMARY KEY — no separate 'id' column
  const entry = queryOne('SELECT user_id FROM sp_watchlist WHERE user_id = ?', [req.params.userId]);
  if (!entry) return res.status(404).json({ error: 'Watchlist entry not found' });

  run('DELETE FROM sp_watchlist WHERE user_id = ?', [req.params.userId]);

  audit('sp.watchlist_remove', 'user', req.params.userId, null, {});

  res.json({ success: true, message: 'Removed from watchlist' });
});

// ── POST /faculty/students/anomalies/:id/resolve ──────────────────────────────
router.post('/interns/anomalies/:id/resolve', (req, res) => {
  const { status, notes } = req.body;
  if (!status || !['resolved', 'dismissed', 'investigating'].includes(status)) {
    return res.status(400).json({ error: 'status must be one of: resolved, dismissed, investigating' });
  }

  const event = queryOne('SELECT id, user_id, status FROM sp_anomaly_events WHERE id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ error: 'Anomaly event not found' });

  const nowMs = Date.now();
  run('UPDATE sp_anomaly_events SET status = ?, resolved_by = ?, resolved_at = ?, resolution_notes = ? WHERE id = ?',
    [status, req.user.id, nowMs, notes || null, req.params.id]);

  audit(`sp.anomaly.${status}`, 'sp_anomaly_event', req.params.id, notes || null, { user_id: event.user_id });

  const updated = queryOne('SELECT * FROM sp_anomaly_events WHERE id = ?', [req.params.id]);
  res.json({ success: true, event: { ...updated, created_at: updated?.created_at ? new Date(updated.created_at).toISOString() : null, resolved_at: updated?.resolved_at ? new Date(updated.resolved_at).toISOString() : null } });
});

export default router;