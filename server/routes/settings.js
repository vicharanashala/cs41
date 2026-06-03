import { Router } from 'express';
import { requireFaculty } from '../middleware/auth.js';
import { queryAll, queryOne, run, getDb } from '../db/database.js';

const router = Router();
router.use(requireFaculty);

// ──────────────────────────────────────────────────────────────────────────────
// DEFAULT SETTINGS
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  // Review thresholds
  auto_promote_threshold: 10,
  min_sp_to_submit: 0,
  min_sp_to_answer: 0,
  min_sp_to_vote: 0,
  max_questions_per_day: 5,

  // Review workflow
  review_assignment: 'round_robin',   // round_robin | load_balanced | random
  auto_assign_interval_hours: 24,
  require_ai_analysis: true,
  require_2nd_review: false,
  max_reviews_per_reviewer_per_day: 20,

  // Moderation
  auto_resolve_flag_threshold: 3,
  flag_dismiss_cooldown_hours: 72,
  content_flag_review_hours: 48,
  max_flags_per_content: 5,

  // Notifications
  notify_on_submit: true,
  notify_on_review_complete: true,
  notify_on_flag: true,
  notify_on_sp_change: true,
  notify_on_admin_action: true,

  // SP / reputation
  sp_upvote_gain: 10,
  sp_downvote_loss: 2,
  sp_accepted_answer: 15,
  sp_published_faq: 20,
  sp_rejection_penalty: 5,

  // Quality
  min_quality_score_publish: 60,
  ai_confidence_threshold: 70,
};

// ──────────────────────────────────────────────────────────────────────────────
// INIT DEFAULTS (idempotent — run on first request if no settings exist)
// ──────────────────────────────────────────────────────────────────────────────

function ensureDefaults() {
  const existing = queryOne('SELECT COUNT(*) as c FROM settings');
  if (!existing || existing.c === 0) {
    const keys = Object.keys(DEFAULTS);
    const placeholders = keys.map(() => '(?, ?)').join(', ');
    const values = keys.flatMap(k => [k, DEFAULTS[k]]);
    run(`INSERT OR IGNORE INTO settings (key, value) VALUES ${placeholders}`, values);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET all settings
// ──────────────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    ensureDefaults();
    const rows = queryAll('SELECT key, value FROM settings');
    const settings = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    res.json({ settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH one or more settings
// ──────────────────────────────────────────────────────────────────────────────

router.patch('/', (req, res) => {
  try {
    ensureDefaults();
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Body must be a JSON object of setting key-value pairs.' });
    }

    const errors = [];
    const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));

    for (const [key, rawVal] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.has(key)) {
        errors.push(`Unknown setting: ${key}`);
        continue;
      }

      // Type validation
      const def = DEFAULTS[key];
      const validated = validate(key, rawVal, def);
      if (validated.error) {
        errors.push(`${key}: ${validated.error}`);
        continue;
      }

      const strVal = String(validated.value);
      const existing = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
      if (existing) {
        run('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', [strVal, Date.now(), key]);
      } else {
        run('INSERT INTO settings (key, value, created_at) VALUES (?, ?, ?)', [key, strVal, Date.now()]);
      }
    }

    // Return updated full settings
    const rows = queryAll('SELECT key, value FROM settings');
    const settings = {};
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }

    res.json({ settings, errors: errors.length ? errors : undefined });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// VALIDATION helpers
// ──────────────────────────────────────────────────────────────────────────────

function validate(key, value, defaultVal) {
  const t = typeof defaultVal;
  if (t === 'number') {
    const n = Number(value);
    if (isNaN(n)) return { error: `must be a number, got: ${value}` };
    if (n < 0) return { error: 'cannot be negative' };
    // Per-key ranges
    if (key === 'auto_promote_threshold' && (n < 1 || n > 100)) return { error: 'must be between 1 and 100' };
    if (key === 'min_sp_to_submit' && n > 1000) return { error: 'must be ≤ 1000' };
    if (key === 'min_sp_to_answer' && n > 1000) return { error: 'must be ≤ 1000' };
    if (key === 'min_sp_to_vote' && n > 1000) return { error: 'must be ≤ 1000' };
    if (key === 'max_questions_per_day' && (n < 1 || n > 100)) return { error: 'must be between 1 and 100' };
    if (key === 'auto_assign_interval_hours' && (n < 1 || n > 168)) return { error: 'must be between 1 and 168' };
    if (key === 'auto_resolve_flag_threshold' && (n < 1 || n > 20)) return { error: 'must be between 1 and 20' };
    if (key === 'flag_dismiss_cooldown_hours' && (n < 1 || n > 720)) return { error: 'must be between 1 and 720' };
    if (key === 'content_flag_review_hours' && (n < 1 || n > 720)) return { error: 'must be between 1 and 720' };
    if (key === 'max_flags_per_content' && (n < 1 || n > 50)) return { error: 'must be between 1 and 50' };
    if (key === 'max_reviews_per_reviewer_per_day' && (n < 1 || n > 100)) return { error: 'must be between 1 and 100' };
    if (key === 'sp_upvote_gain' && (n < 0 || n > 100)) return { error: 'must be between 0 and 100' };
    if (key === 'sp_downvote_loss' && (n < 0 || n > 50)) return { error: 'must be between 0 and 50' };
    if (key === 'sp_accepted_answer' && (n < 0 || n > 100)) return { error: 'must be between 0 and 100' };
    if (key === 'sp_published_faq' && (n < 0 || n > 100)) return { error: 'must be between 0 and 100' };
    if (key === 'sp_rejection_penalty' && (n < 0 || n > 50)) return { error: 'must be between 0 and 50' };
    if (key === 'min_quality_score_publish' && (n < 0 || n > 100)) return { error: 'must be between 0 and 100' };
    if (key === 'ai_confidence_threshold' && (n < 0 || n > 100)) return { error: 'must be between 0 and 100' };
    return { value: n };
  }

  if (t === 'boolean') {
    if (value === 'true' || value === true) return { value: true };
    if (value === 'false' || value === false) return { value: false };
    return { error: 'must be true or false' };
  }

  if (t === 'string') {
    const str = String(value);
    if (key === 'review_assignment') {
      if (!['round_robin', 'load_balanced', 'random'].includes(str)) {
        return { error: "must be 'round_robin', 'load_balanced', or 'random'" };
      }
    }
    return { value: str };
  }

  return { value };
}

// ──────────────────────────────────────────────────────────────────────────────
// RESET to defaults
// ──────────────────────────────────────────────────────────────────────────────

router.post('/reset', (req, res) => {
  try {
    const ALLOWED_KEYS = Object.keys(DEFAULTS);
    for (const [key, val] of Object.entries(DEFAULTS)) {
      const strVal = String(val);
      const existing = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
      if (existing) {
        run('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', [strVal, Date.now(), key]);
      } else {
        run('INSERT INTO settings (key, value, created_at) VALUES (?, ?, ?)', [key, strVal, Date.now()]);
      }
    }
    res.json({ ok: true, message: 'All settings reset to defaults.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// FACULTY ROLE MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

router.get('/faculty', (req, res) => {
  try {
    const faculty = queryAll(`
      SELECT id, name, email, role, is_verified, reputation, created_at
      FROM users
      WHERE role IN ('faculty', 'admin')
      ORDER BY name ASC
    `);
    const total = queryOne("SELECT COUNT(*) as c FROM users WHERE role IN ('intern', 'verified')")?.c || 0;
    res.json({ faculty, totalInterns: total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/faculty/:id/role', (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['intern', 'verified', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ error: "Role must be: intern, verified, faculty, or admin" });
    }

    const user = queryOne('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const PREVENT = { admin: ['admin'], faculty: ['admin'] };
    if (PREVENT[user.role]?.includes(role)) {
      return res.status(403).json({ error: 'That demotion is not allowed.' });
    }

    run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;