import { Router } from 'express';
import { requireFaculty } from '../middleware/auth.js';
import { queryAll, queryOne, run, getDb } from '../db/database.js';

const router = Router();
router.use(requireFaculty);

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function weeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Upsert a single row into an analytics table. */
function upsert(table, keyCol, keyVal, cols, values) {
  const sets = cols.map(c => `${c} = ?`).join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  try {
    run(`INSERT INTO ${table} (${keyCol}, ${cols.join(', ')}) VALUES (?, ${placeholders})`, [keyVal, ...values]);
  } catch (_) { /* ignore */ }
  run(`UPDATE ${table} SET ${sets} WHERE ${keyCol} = ?`, [...values, keyVal]);
}

// ──────────────────────────────────────────────────────────────────────────────
// KPI SUMMARY  (dashboard at-a-glance)
// ──────────────────────────────────────────────────────────────────────────────

router.get('/kpi', (req, res) => {
  try {
    const kpis = queryAll('SELECT * FROM analytics_kpi');
    const pending = queryOne('SELECT COUNT(*) as c FROM questions WHERE faq_status = ?', ['pending_review'])?.c || 0;
    const publishedThisMonth = queryOne(`
      SELECT COUNT(*) as c FROM faq_revision_log
      WHERE action = 'published'
        AND created_at >= ?`,
      [new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()]
    )?.c || 0;

    res.json({ kpis, pending, publishedThisMonth });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// FAQ SUBMISSION METRICS
// ──────────────────────────────────────────────────────────────────────────────

router.get('/faq/daily', (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const cutoff = daysAgo(days);

    const rows = queryAll(`
      SELECT date, submitted, in_review, published, rejected, changes_req, avg_quality, avg_queue_hrs
      FROM analytics_faq_daily
      WHERE date >= ?
      ORDER BY date ASC
    `, [cutoff]);

    // If less than 7 rows, generate from raw data
    if (rows.length < 7) {
      const raw = getDb().exec(`
        SELECT
          date(q.created_at) as date,
          COUNT(*) as submitted
        FROM questions q
        WHERE date(q.created_at) >= date('now', '-${days} days')
        GROUP BY date(q.created_at)
        ORDER BY date ASC
      `);
      return res.json({ rows: raw.length ? raw : [], generated: true });
    }

    res.json({ rows, generated: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/faq/monthly', (req, res) => {
  try {
    const months = Math.min(Number(req.query.months) || 12, 60);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 7);

    const rows = queryAll(`
      SELECT month, submitted, published, rejected, changes_req, total_active, avg_quality
      FROM analytics_faq_monthly
      WHERE month >= ?
      ORDER BY month ASC
    `, [cutoffStr]);

    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/faq/status-breakdown', (req, res) => {
  try {
    const breakdown = queryAll(`
      SELECT faq_status as status, COUNT(*) as count
      FROM questions
      GROUP BY faq_status
      ORDER BY count DESC
    `);

    const total = queryOne('SELECT COUNT(*) as c FROM questions')?.c || 0;
    const byCategory = queryAll(`
      SELECT category, COUNT(*) as count
      FROM questions
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({ breakdown, total, byCategory });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// REVIEW THROUGHPUT
// ──────────────────────────────────────────────────────────────────────────────

router.get('/throughput/weekly', (req, res) => {
  try {
    const weeks = Math.min(Number(req.query.weeks) || 12, 52);
    const cutoff = weeksAgo(weeks);

    const rows = queryAll(`
      SELECT week_start, queued, reviewed, published, rejected, changes_req, p50_hours, p90_hours, ai_used
      FROM analytics_throughput_weekly
      WHERE week_start >= ?
      ORDER BY week_start ASC
    `, [cutoff]);

    // Fallback: compute from raw if < 4 rows
    if (rows.length < 4) {
      const raw = queryAll(`
        SELECT
          date(created_at, 'weekday 0', '-6 days') as week_start,
          COUNT(*) as reviewed
        FROM faq_revision_log
        WHERE created_at >= ?
          AND action IN ('published','rejected','changes_requested')
        GROUP BY week_start
        ORDER BY week_start ASC
      `, [new Date(cutoff).getTime()]);
      return res.json({ rows: raw, generated: true });
    }

    res.json({ rows, generated: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/throughput/avg-time', (req, res) => {
  try {
    // Average review time for each decision type
    const byDecision = queryAll(`
      SELECT
        r.decision,
        COUNT(*) as count,
        AVG((r.decision_at - r.trigger_at) / 3600000.0) as avg_hours,
        MIN((r.decision_at - r.trigger_at) / 3600000.0) as min_hours,
        MAX((r.decision_at - r.trigger_at) / 3600000.0) as max_hours
      FROM faq_review_log r
      WHERE r.decision_at IS NOT NULL AND r.trigger_at IS NOT NULL
      GROUP BY r.decision
      ORDER BY count DESC
    `);

    // Overall average
    const overall = queryOne(`
      SELECT AVG((decision_at - trigger_at) / 3600000.0) as avg_hours
      FROM faq_review_log
      WHERE decision_at IS NOT NULL AND trigger_at IS NOT NULL
    `);

    // This week vs last week
    const thisWeek = queryOne(`
      SELECT COUNT(*) as c FROM faq_revision_log
      WHERE action IN ('published','rejected','changes_requested')
        AND created_at >= ?
    `, [daysAgo(7) + 'T00:00:00']);

    const lastWeek = queryOne(`
      SELECT COUNT(*) as c FROM faq_revision_log
      WHERE action IN ('published','rejected','changes_requested')
        AND created_at >= date('now', '-14 days')
        AND created_at < date('now', '-7 days')
    `);

    res.json({ byDecision, overall: overall?.avg_hours || 0, thisWeek: thisWeek?.c || 0, lastWeek: lastWeek?.c || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// MODERATION METRICS
// ──────────────────────────────────────────────────────────────────────────────

router.get('/moderation/daily', (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const cutoff = daysAgo(days);

    const rows = queryAll(`
      SELECT date, flags_raised, flags_resolved, content_removed, users_warned, dismissed, avg_resolve_hrs
      FROM analytics_moderation_daily
      WHERE date >= ?
      ORDER BY date ASC
    `, [cutoff]);

    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/moderation/summary', (req, res) => {
  try {
    const open = queryOne("SELECT COUNT(*) as c FROM content_flags WHERE status = 'open'")?.c || 0;
    const resolved = queryOne("SELECT COUNT(*) as c FROM content_flags WHERE status = 'resolved'")?.c || 0;
    const byType = queryAll(`
      SELECT reason as flag_type, COUNT(*) as count
      FROM content_flags
      GROUP BY reason
      ORDER BY count DESC
    `);
    const recent = queryAll(`
      SELECT f.id, f.reason, f.status, f.created_at,
             u.name as reporter_name, q.title as target_title
      FROM content_flags f
      LEFT JOIN users u ON f.flagged_by = u.id
      LEFT JOIN questions q ON f.target_id = q.id
      ORDER BY f.created_at DESC
      LIMIT 20
    `);

    res.json({ open, resolved, byType, recent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// SP DISTRIBUTION
// ──────────────────────────────────────────────────────────────────────────────

router.get('/sp/distribution', (req, res) => {
  try {
    // Last snapshot
    const snapshot = queryOne(`
      SELECT * FROM analytics_sp_distribution ORDER BY captured_at DESC LIMIT 1
    `);

    // Current live values (computed fresh)
    const students = queryAll(`
      SELECT u.id, u.name, u.email, u.reputation as sp, u.is_frozen,
             COUNT(DISTINCT f.id) as flag_count
      FROM users u
      LEFT JOIN content_flags f ON f.target_id = u.id AND f.status = 'open'
      WHERE u.role IN ('intern', 'verified')
      GROUP BY u.id
      ORDER BY u.reputation DESC
    `);

    const allSP = students.map(s => s.sp).filter(v => v != null);
    const sortedSP = [...allSP].sort((a, b) => a - b);
    const mean = sortedSP.length
      ? sortedSP.reduce((a, b) => a + b, 0) / sortedSP.length
      : 0;
    const median = sortedSP.length
      ? sortedSP.length % 2 === 0
        ? (sortedSP[sortedSP.length / 2 - 1] + sortedSP[sortedSP.length / 2]) / 2
        : sortedSP[Math.floor(sortedSP.length / 2)]
      : 0;
    const variance = sortedSP.length
      ? sortedSP.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / sortedSP.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const p90 = sortedSP[Math.floor(sortedSP.length * 0.9)] || 0;
    const p10 = sortedSP[Math.floor(sortedSP.length * 0.1)] || 0;

    const frozen = students.filter(s => s.is_frozen).length;
    const withFlags = students.filter(s => s.flag_count > 0).length;

    // SP histogram (10 buckets)
    const min = sortedSP[0] || 0;
    const max = sortedSP[sortedSP.length - 1] || 100;
    const bucketSize = Math.max(1, Math.ceil((max - min) / 10));
    const histogram = Array.from({ length: 10 }, (_, i) => {
      const lo = min + i * bucketSize;
      const hi = lo + bucketSize;
      const count = sortedSP.filter(v => v >= lo && (i === 9 ? v <= hi : v < hi)).length;
      return { range: `${lo}-${hi}`, count };
    });

    res.json({
      snapshot,
      stats: {
        total: students.length,
        avg: Math.round(mean * 10) / 10,
        median: Math.round(median * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        min: min,
        max: max,
        p90,
        p10,
        frozen,
        withFlags,
      },
      histogram,
      students: students.slice(0, 50), // top 50 for sparklines
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/sp/leaderboard', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const leaders = queryAll(`
      SELECT id, name, email, reputation as sp, is_frozen
      FROM users
      WHERE role IN ('intern', 'verified')
      ORDER BY reputation DESC
      LIMIT ?
    `, [limit]);

    const median = queryOne(`
      SELECT reputation as med FROM (
        SELECT reputation, ROW_NUMBER() OVER (ORDER BY reputation) as rn,
               COUNT(*) OVER () as total
        FROM users WHERE role IN ('intern', 'verified')
      ) WHERE rn = CEIL(total / 2.0)
    `);

    res.json({ leaders, median: median?.med || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// REFRESH ANALYTICS  (recompute all aggregate tables)
// ──────────────────────────────────────────────────────────────────────────────

router.post('/refresh', (req, res) => {
  try {
    const now = Date.now();
    const todayStr = today();
    const monthStr = thisMonth();

    // ── KPI refresh ──────────────────────────────────────────────────────────
    const totalFAQs = queryOne('SELECT COUNT(*) as c FROM questions')?.c || 0;
    const pending = queryOne('SELECT COUNT(*) as c FROM questions WHERE faq_status = ?', ['pending_review'])?.c || 0;
    const openFlags = queryOne("SELECT COUNT(*) as c FROM content_flags WHERE status = 'open'")?.c || 0;
    const avgSP = queryOne("SELECT AVG(reputation) as a FROM users WHERE role IN ('intern','verified')")?.a || 0;
    const totalStudents = queryOne("SELECT COUNT(*) as c FROM users WHERE role IN ('intern','verified')")?.c || 0;

    upsert('analytics_kpi', 'key', 'total_faqs', ['value', 'label', 'updated_at'],
      [totalFAQs, 'Total FAQs', now]);
    upsert('analytics_kpi', 'key', 'pending_review', ['value', 'label', 'updated_at'],
      [pending, 'Pending Review', now]);
    upsert('analytics_kpi', 'key', 'open_flags', ['value', 'label', 'updated_at'],
      [openFlags, 'Open Moderation Flags', now]);
    upsert('analytics_kpi', 'key', 'avg_sp', ['value', 'label', 'updated_at'],
      [Math.round(avgSP), 'Average SP', now]);
    upsert('analytics_kpi', 'key', 'interns', ['value', 'label', 'updated_at'],
      [totalStudents, 'Total Interns', now]);

    // ── FAQ daily refresh (last 30 days) ─────────────────────────────────────
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const dayStart = d.setHours(0, 0, 0, 0);
      const dayEnd = dayStart + 86400000;

      const submitted = queryOne(`
        SELECT COUNT(*) as c FROM questions
        WHERE strftime('%Y-%m-%d', created_at) = ?
      `, [dateStr])?.c || 0;

      const inReview = queryOne(`
        SELECT COUNT(*) as c FROM faq_revision_log
        WHERE action = 'queued'
          AND created_at >= ? AND created_at < ?
      `, [dayStart, dayEnd])?.c || 0;

      const published = queryOne(`
        SELECT COUNT(*) as c FROM faq_revision_log
        WHERE action = 'published'
          AND created_at >= ? AND created_at < ?
      `, [dayStart, dayEnd])?.c || 0;

      const rejected = queryOne(`
        SELECT COUNT(*) as c FROM faq_revision_log
        WHERE action = 'rejected'
          AND created_at >= ? AND created_at < ?
      `, [dayStart, dayEnd])?.c || 0;

      const changesReq = queryOne(`
        SELECT COUNT(*) as c FROM faq_revision_log
        WHERE action = 'changes_requested'
          AND created_at >= ? AND created_at < ?
      `, [dayStart, dayEnd])?.c || 0;

      const avgQ = queryOne(`
        SELECT AVG(quality_score) as a FROM faq_ai_analysis
        WHERE generated_at >= ? AND generated_at < ?
      `, [dayStart, dayEnd])?.a || null;

      upsert('analytics_faq_daily', 'date', dateStr,
        ['submitted', 'in_review', 'published', 'rejected', 'changes_req', 'avg_quality', 'updated_at'],
        [submitted, inReview, published, rejected, changesReq, avgQ, now]);
    }

    res.json({ ok: true, refreshedAt: now });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;