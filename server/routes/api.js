import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run, getDb, saveDb } from '../db/database.js';
import { authenticate, optionalAuth, JWT_SECRET } from '../middleware/auth.js';
import { checkAutoPromote } from './faculty.js';

const router = Router();

// Vote transaction helper — BEGIN IMMEDIATE locks the DB row and prevents double-votes.
// Returns { upvotes, downvotes } counts after the transaction commits.
function voteTransaction(userId, targetType, targetId, direction, authorId) {
  const db = getDb();
  db.run('BEGIN IMMEDIATE');
  try {
    const existing = queryOne(
      'SELECT * FROM votes WHERE user_id=? AND target_type=? AND target_id=?',
      [userId, targetType, targetId]
    );
    const deltaMap = { up: { same: -10, flip: 12 }, down: { same: 2, flip: -12 } };
    if (existing) {
      if (existing.direction === direction) {
        db.run('DELETE FROM votes WHERE id = ?', [existing.id]);
        db.run('UPDATE users SET reputation = reputation + ? WHERE id = ?', [deltaMap[direction].same, authorId]);
      } else {
        db.run('UPDATE votes SET direction = ? WHERE id = ?', [direction, existing.id]);
        db.run('UPDATE users SET reputation = reputation + ? WHERE id = ?', [deltaMap[direction].flip, authorId]);
      }
    } else {
      db.run('INSERT INTO votes (id, user_id, target_type, target_id, direction) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), userId, targetType, targetId, direction]);
      db.run('UPDATE users SET reputation = reputation + ? WHERE id = ?',
        [direction === 'up' ? 10 : -2, authorId]);
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
  const upvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', [targetType, targetId, 'up'])?.c || 0;
  const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', [targetType, targetId, 'down'])?.c || 0;
  return { upvotes, downvotes };
}

// ── AUTH ─────────────────────────────────────────────────────────────────────

router.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  run('INSERT INTO users (id, name, email, password_hash, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, email, hash, 'intern', 0]);

  const token = jwt.sign({ id, name, email, role: 'intern', is_verified: 0 }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user: { id, name, email, role: 'intern', is_verified: 0, reputation: 0 }, token });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  console.log('====================');
  console.log('LOGIN EMAIL:', email);
  console.log('USER FROM DB:', user);
  console.log('ROLE FROM DB:', user?.role);
  console.log('VERIFIED FROM DB:', user?.is_verified);
  console.log('====================');
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password_hash);
  console.log('VALID:', valid);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, is_verified: user.is_verified }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, is_verified: user.is_verified, reputation: user.reputation }, token });
});

router.get('/auth/me', authenticate, (req, res) => {
  const user = queryOne('SELECT id, name, email, role, is_verified, reputation, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ── PUBLIC FAQ SUBMISSION ───────────────────────────────────────────────────
// No auth required — submissions enter pending_review and appear in faculty queue

router.post('/faqs/submit', async (req, res) => {
  const { title, description, category, tags, submitterName, submitterEmail } = req.body;

  // Validation
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Title, description, and category are required.' });
  }
  if (title.trim().length < 15) {
    return res.status(400).json({ error: 'Title must be at least 15 characters.' });
  }
  if (description.trim().length < 30) {
    return res.status(400).json({ error: 'Description must be at least 30 characters.' });
  }

  const VALID_CATEGORIES = [
    'Interview Prep', 'Application Tips', 'Company Research',
    'Salary Negotiation', 'Visa & Relocation', 'Mental Health', 'General Advice',
  ];
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  const nowMs = Date.now();

  // Use anonymous user so we still have a valid FK
  let anonUser = queryOne('SELECT id FROM users WHERE email = ?', ['anonymous@crowd.faq']);
  if (!anonUser) {
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const hash = await bcrypt.hash('anonymous-no-login', 10);
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    run(
      'INSERT INTO users (id, name, email, password_hash, role, is_verified, reputation) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, 'Anonymous', 'anonymous@crowd.faq', hash, 'intern', 1, 0]
    );
    anonUser = { id };
  }

  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  const tagList = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 5) : [];

  run(
    'INSERT INTO questions (id, user_id, title, description, category, tags, views, faq_status, trigger_event, trigger_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, anonUser.id, title.trim(), description.trim(), category, JSON.stringify(tagList), 0, 'pending_review', 'public_submit', nowMs]
  );

  // Log to revision history
  run(
    'INSERT INTO faq_revision_log (id, question_id, reviewed_by, action, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'system', 'queued', 'Public submission — entered review queue.', nowMs]
  );

  const question = queryOne('SELECT * FROM questions WHERE id = ?', [id]);
  res.status(201).json({
    question,
    message: 'Your question has been submitted and is pending review. Our faculty will evaluate it shortly.',
  });
});

// ── CONTENT FLAGGING ───────────────────────────────────────────────────────
// No auth required — any visitor can report content. Auth is optional (flags as user if logged in).

router.post('/flags', optionalAuth, (req, res) => {
  const { target_type, target_id, reason, details } = req.body;

  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'target_type, target_id, and reason are required.' });
  }
  const VALID_TYPES = ['question', 'answer', 'faq'];
  if (!VALID_TYPES.includes(target_type)) {
    return res.status(400).json({ error: `target_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const VALID_REASONS = ['spam', 'inappropriate', 'wrong_info', 'duplicate', 'too_vague', 'offensive', 'other'];
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }

  // Verify target exists
  const target = queryOne('SELECT id FROM questions WHERE id = ?', [target_id]);
  if (!target) {
    return res.status(404).json({ error: 'Target content not found.' });
  }

  const nowMs = Date.now();

  // Resolve flagging user — use 'anonymous@crowd.faq' if not authenticated
  const flaggedBy = req.user?.id || (() => {
    const anon = queryOne('SELECT id FROM users WHERE email = ?', ['anonymous@crowd.faq']);
    return anon ? anon.id : 'anonymous';
  })();

  const id = uuidv4();
  run(
    'INSERT OR IGNORE INTO content_flags (id, target_type, target_id, flagged_by, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, target_type, target_id, flaggedBy, reason, details || null, 'open', nowMs]
  );

  res.status(201).json({
    flag_id: id,
    message: 'Thank you for your report. Our faculty team will review it shortly.',
  });
});

// ── ANONYMOUS COMMUNITY QUESTIONS ──────────────────────────────────────────
// Post and fetch community Q&A without authentication

router.get('/community/questions', (req, res) => {
  const { category, sort = 'newest' } = req.query;

  let where = '1=1';
  const params = [];
  if (category) { where += ' AND q.category = ?'; params.push(category); }

  let orderBy = 'q.created_at DESC';
  if (sort === 'votes') orderBy = '(COALESCE(v.upvotes,0)-COALESCE(v.downvotes,0)) DESC, q.created_at DESC';

  const questions = queryAll(`
    SELECT q.*,
           COALESCE(a_count.answer_count, 0) as answer_count,
           COALESCE(v.upvotes, 0) as upvotes,
           COALESCE(v.downvotes, 0) as downvotes,
           CASE WHEN COALESCE(a_count.answer_count, 0) > 0 THEN 1 ELSE 0 END as has_answers
    FROM questions q
    LEFT JOIN (SELECT question_id, COUNT(*) as answer_count FROM answers GROUP BY question_id) a_count ON q.id = a_count.question_id
    LEFT JOIN (
      SELECT target_id,
             SUM(CASE WHEN direction = 'up'   THEN 1 ELSE 0 END) as upvotes,
             SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) as downvotes
      FROM votes WHERE target_type = 'question' GROUP BY target_id
    ) v ON q.id = v.target_id
    WHERE ${where}
    ORDER BY ${orderBy}
  `, params);

  res.json({ questions: questions.map(q => ({ ...q, score: (q.upvotes || 0) - (q.downvotes || 0) })) });
});

router.post('/community/questions', async (req, res) => {
  const { title, category } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category are required' });
  }

  // Use a generic "anonymous" user so we still have a valid FK
  let anonUser = queryOne('SELECT id FROM users WHERE email = ?', ['anonymous@crowd.faq']);
  if (!anonUser) {
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const hash = await bcrypt.hash('anonymous-no-login', 10);
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    run('INSERT INTO users (id, name, email, password_hash, role, is_verified, reputation) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, 'Anonymous', 'anonymous@crowd.faq', hash, 'intern', 1, 0]);
    anonUser = { id };
  }

  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  run('INSERT INTO questions (id, user_id, title, description, category, tags) VALUES (?, ?, ?, ?, ?, ?)',
    [id, anonUser.id, title, '', category, '[]']);

  // Award SP for asking
  run('UPDATE users SET reputation = reputation + 5 WHERE id = ?', [anonUser.id]);

  const question = queryOne('SELECT * FROM questions WHERE id = ?', [id]);
  res.status(201).json({ question: { ...question, answer_count: 0, upvotes: 0, downvotes: 0, score: 0 } });
});

router.get('/community/questions/:id/answers', (req, res) => {
  const answers = queryAll(`
    SELECT a.*, u.name as author_name
    FROM answers a
    JOIN users u ON a.user_id = u.id
    WHERE a.question_id = ?
    ORDER BY a.is_accepted DESC, a.created_at ASC
  `, [req.params.id]);

  const answersWithVotes = answers.map(a => {
    const upvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['answer', a.id, 'up'])?.c || 0;
    const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['answer', a.id, 'down'])?.c || 0;
    return { ...a, upvotes, downvotes, score: upvotes - downvotes };
  });

  res.json({ answers: answersWithVotes });
});

router.post('/community/questions/:id/answers', async (req, res) => {
  const { content, isOfficial } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const question = queryOne('SELECT id FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  // Use anonymous user
  let anonUser = queryOne('SELECT id FROM users WHERE email = ?', ['anonymous@crowd.faq']);
  if (!anonUser) {
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const hash = await bcrypt.hash('anonymous-no-login', 10);
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    run('INSERT INTO users (id, name, email, password_hash, role, is_verified, reputation) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, 'Anonymous', 'anonymous@crowd.faq', hash, 'intern', 1, 0]);
    anonUser = { id };
  }

  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  run('INSERT INTO answers (id, question_id, user_id, content) VALUES (?, ?, ?, ?)',
    [id, req.params.id, anonUser.id, content]);

  // Award SP for answering
  run('UPDATE users SET reputation = reputation + 10 WHERE id = ?', [anonUser.id]);

  const answer = queryOne('SELECT a.*, u.name as author_name FROM answers a JOIN users u ON a.user_id = u.id WHERE a.id = ?', [id]);
  res.status(201).json({ answer: { ...answer, upvotes: 0, downvotes: 0, score: 0, isOfficial: !!isOfficial } });
});

router.post('/community/questions/:questionId/vote', (req, res) => {
  const { direction, isQuestion, targetId: bodyTargetId } = req.body;
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'Direction must be up or down' });

  const targetType = isQuestion ? 'question' : 'answer';
  // For question votes: URL param is the target. For answer votes: body sends the answer's ID.
  const targetId   = isQuestion ? req.params.questionId : (bodyTargetId || req.params.questionId);

  // Look up existing vote against the correct target ID
  const existing = queryOne('SELECT * FROM votes WHERE user_id=? AND target_type=? AND target_id=?',
    ['anonymous', targetType, targetId]);

  // Persist: insert new vote, update direction on change, or delete on same-direction toggle
  if (!existing) {
    run('INSERT INTO votes (id, user_id, target_type, target_id, direction) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'anonymous', targetType, targetId, direction]);
  } else if (existing.direction !== direction) {
    run('UPDATE votes SET direction = ? WHERE id = ?', [direction, existing.id]);
  } else {
    run('DELETE FROM votes WHERE id = ?', [existing.id]);
  }

  // Auto-promote check (questions only)
  const qData = queryOne(`
    SELECT q.id, COALESCE(v_up.c, 0) as upvotes, COALESCE(a_cnt.c, 0) as answers
    FROM questions q
    LEFT JOIN (SELECT target_id, COUNT(*) as c FROM votes WHERE target_type='question' AND direction='up' GROUP BY target_id) v_up ON q.id = v_up.target_id
    LEFT JOIN (SELECT question_id, COUNT(*) as c FROM answers GROUP BY question_id) a_cnt ON q.id = a_cnt.question_id
    WHERE q.id = ? AND q.is_faq = 0
  `, [req.params.questionId]);

  if (qData && qData.upvotes >= 10 && qData.answers > 0) {
    run('UPDATE questions SET is_faq = 1, promoted_at = datetime(\'now\') WHERE id = ?', [req.params.questionId]);
  }

  // Count against the correct target ID
  const ups   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', [targetType, targetId, 'up'])?.c || 0;
  const downs = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', [targetType, targetId, 'down'])?.c || 0;
  res.json({ upvotes: ups, downvotes: downs, score: ups - downs });
});

// ── CATEGORIES ───────────────────────────────────────────────────────────────

router.get('/categories', (req, res) => {
  const categories = [
    { id: 'interview-prep',    label: 'Interview Prep',     icon: '💬', color: '#00d4ff' },
    { id: 'application-tips',  label: 'Application Tips',   icon: '📝', color: '#a855f7' },
    { id: 'company-research',  label: 'Company Research',   icon: '🏢', color: '#00ff88' },
    { id: 'salary-negotiation',label: 'Salary Negotiation', icon: '💰', color: '#fbbf24' },
    { id: 'visa-relocation',   label: 'Visa & Relocation',  icon: '✈️', color: '#f97316' },
    { id: 'mental-health',     label: 'Mental Health',      icon: '🧠', color: '#ec4899' },
    { id: 'general-advice',    label: 'General Advice',     icon: '💡', color: '#6366f1' },
  ];
  const counts = queryAll('SELECT category, COUNT(*) as count FROM questions GROUP BY category');
  const countMap = Object.fromEntries(counts.map(r => [r.category, r.count]));
  res.json({ categories: categories.map(c => ({ ...c, count: countMap[c.label] || 0 })) });
});

// ── QUESTIONS ────────────────────────────────────────────────────────────────

router.get('/questions', optionalAuth, (req, res) => {
  const { category, sort = 'newest', search, page = 1, status } = req.query;
  const limit = 10;
  const offset = (Number(page) - 1) * limit;

  // Derive faq_status: use real column if it exists, else infer from is_faq
  const faqStatusExpr = `CASE WHEN q.is_faq = 1 THEN 'published' ELSE 'draft' END`;

  let where = '1=1';
  const params = [];
  if (category) { where += ' AND q.category = ?'; params.push(category); }
  if (search)   { where += ' AND (q.title LIKE ? OR q.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  // ?status= all | faq | pending | draft | published | archived
  // Omitting status = backward-compat (show draft + published, hide archived)
  if (!status || status === 'all') {
    // show everything — no extra filter
  } else if (status === 'faq' || status === 'published') {
    where += ' AND q.is_faq = 1';
  } else if (status === 'pending' || status === 'draft') {
    where += ' AND q.is_faq = 0';
  } else if (status === 'archived') {
    where += ' AND q.is_faq = -1'; // archived uses is_faq = -1 (future)
  }

  let orderBy = 'q.created_at DESC';
  if (sort === 'votes')      orderBy = '(COALESCE(v.upvotes,0)-COALESCE(v.downvotes,0)) DESC, q.created_at DESC';
  if (sort === 'trending')   orderBy = 'q.views DESC, q.created_at DESC';
  // 'unanswered' handled below via having clause

  const unansweredJoin = sort === 'unanswered'
    ? 'LEFT JOIN answers a_count ON q.id = a_count.question_id GROUP BY q.id HAVING COUNT(a_count.id) = 0'
    : 'GROUP BY q.id';

  const countWhere = params.length ? `WHERE ${where}` : '';
  const countParams = [...params];
  const total = queryOne(
    `SELECT COUNT(*) as count FROM questions q ${unansweredJoin} ${countWhere}`,
    countParams
  )?.count || 0;

  const questions = queryAll(`
    SELECT q.*,
           u.name as author_name, u.reputation as author_reputation,
           COALESCE(a_count.answer_count, 0) as answer_count,
           COALESCE(v.upvotes, 0) as upvotes, COALESCE(v.downvotes, 0) as downvotes,
           ${faqStatusExpr} as faq_status
    FROM questions q
    JOIN users u ON q.user_id = u.id
    LEFT JOIN (SELECT question_id, COUNT(*) as answer_count FROM answers GROUP BY question_id) a_count ON q.id = a_count.question_id
    LEFT JOIN (
      SELECT target_id,
             SUM(CASE WHEN direction = 'up'   THEN 1 ELSE 0 END) as upvotes,
             SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) as downvotes
      FROM votes WHERE target_type = 'question' GROUP BY target_id
    ) v ON q.id = v.target_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  let userVotes = {};
  if (req.user && questions.length > 0) {
    const placeholders = questions.map(() => '?').join(',');
    const voteRows = queryAll(
      `SELECT target_id, direction FROM votes WHERE user_id = ? AND target_type = 'question' AND target_id IN (${placeholders})`,
      [req.user.id, ...questions.map(q => q.id)]
    );
    userVotes = Object.fromEntries(voteRows.map(v => [v.target_id, v.direction]));
  }

  const result = questions.map(q => ({
    ...q,
    tags: JSON.parse(q.tags || '[]'),
    userVote: userVotes[q.id] || null,
    score: (q.upvotes || 0) - (q.downvotes || 0),
  }));

  res.json({ questions: result, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

router.get('/questions/:id', optionalAuth, (req, res) => {
  const question = queryOne(`
    SELECT q.*, u.name as author_name, u.reputation as author_reputation
    FROM questions q JOIN users u ON q.user_id = u.id WHERE q.id = ?
  `, [req.params.id]);

  if (!question) return res.status(404).json({ error: 'Question not found' });

  // Increment views
  run('UPDATE questions SET views = views + 1 WHERE id = ?', [question.id]);

  const answers = queryAll(`
    SELECT a.*, u.name as author_name, u.reputation as author_reputation
    FROM answers a JOIN users u ON a.user_id = u.id
    WHERE a.question_id = ? ORDER BY a.is_accepted DESC, created_at ASC
  `, [question.id]);

  let questionVote = null;
  if (req.user) {
    questionVote = queryOne('SELECT direction FROM votes WHERE user_id=? AND target_type=? AND target_id=?',
      [req.user.id, 'question', question.id])?.direction || null;
  }

  const questionUpvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', question.id, 'up'])?.c || 0;
  const questionDownvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', question.id, 'down'])?.c || 0;

  let answerVotes = {};
  if (answers.length > 0 && req.user) {
    const placeholders = answers.map(() => '?').join(',');
    const av = queryAll(`SELECT target_id, direction FROM votes WHERE user_id=? AND target_type='answer' AND target_id IN (${placeholders})`,
      [req.user.id, ...answers.map(a => a.id)]);
    answerVotes = Object.fromEntries(av.map(v => [v.target_id, v.direction]));
  }

  res.json({
    question: {
      ...question,
      faq_status: question.is_faq === 1 ? 'published' : 'draft',
      tags: JSON.parse(question.tags || '[]'),
      userVote: questionVote,
      score: questionUpvotes - questionDownvotes,
      upvotes: questionUpvotes,
      downvotes: questionDownvotes,
    },
    answers: answers.map(a => ({
      ...a,
      userVote: answerVotes[a.id] || null,
      score: (queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['answer', a.id, 'up'])?.c || 0) -
             (queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['answer', a.id, 'down'])?.c || 0),
    })),
  });
});

router.post('/questions', authenticate, (req, res) => {
  // Phase 5: Only faculty can create FAQs directly. Students must use the community flow.
  if (req.user.role !== 'faculty') {
    return res.status(403).json({ error: 'Students must submit questions via the community page. Visit /community to ask a question.' });
  }

  const { title, category, description, tags } = req.body;
  if (!title || !category || !description) return res.status(400).json({ error: 'Title, category, and description are required' });
  if (title.length < 15) return res.status(400).json({ error: 'Title must be at least 15 characters' });
  if (description.length < 50) return res.status(400).json({ error: 'Description must be at least 50 characters' });

  const id = uuidv4();
  run('INSERT INTO questions (id, user_id, title, description, category, tags) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.user.id, title, description, category, JSON.stringify(tags || [])]);

  // Faculty-created questions go directly to pending_review
  run("UPDATE questions SET faq_status='pending_review', trigger_event='faculty_flag', trigger_at=? WHERE id=?",
    [Date.now(), id]);

  const question = queryOne('SELECT q.*, u.name as author_name FROM questions q JOIN users u ON q.user_id = u.id WHERE q.id = ?', [id]);
  res.status(201).json({ question });
});

router.post('/questions/:id/vote', authenticate, (req, res) => {
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'Direction must be up or down' });

  const question = queryOne('SELECT id, user_id FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  if (question.user_id === req.user.id) return res.status(403).json({ error: 'Cannot vote your own question' });

  try {
    const { upvotes, downvotes } = voteTransaction(req.user.id, 'question', question.id, direction, question.user_id);
    // Auto-promote to pending_review if FAQ threshold is reached
    checkAutoPromote(question.id);
    res.json({ upvotes, downvotes, score: upvotes - downvotes });
  } catch (err) {
    console.error('Vote transaction failed:', err.message);
    res.status(500).json({ error: 'Vote failed — please try again' });
  }
});

// ── ANSWERS ─────────────────────────────────────────────────────────────────

router.post('/questions/:id/answers', authenticate, (req, res) => {
  const { content } = req.body;
  if (!content || content.length < 20) return res.status(400).json({ error: 'Answer must be at least 20 characters' });
  const question = queryOne('SELECT id FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  const id = uuidv4();
  run('INSERT INTO answers (id, question_id, user_id, content) VALUES (?, ?, ?, ?)',
    [id, req.params.id, req.user.id, content]);

  const answer = queryOne('SELECT a.*, u.name as author_name FROM answers a JOIN users u ON a.user_id = u.id WHERE a.id = ?', [id]);
  res.status(201).json({ answer });
});

router.post('/answers/:id/vote', authenticate, (req, res) => {
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'Direction must be up or down' });

  const answer = queryOne('SELECT id, user_id FROM answers WHERE id = ?', [req.params.id]);
  if (!answer) return res.status(404).json({ error: 'Answer not found' });
  if (answer.user_id === req.user.id) return res.status(403).json({ error: 'Cannot vote your own answer' });

  try {
    const { upvotes, downvotes } = voteTransaction(req.user.id, 'answer', answer.id, direction, answer.user_id);
    res.json({ upvotes, downvotes, score: upvotes - downvotes });
  } catch (err) {
    console.error('Vote transaction failed:', err.message);
    res.status(500).json({ error: 'Vote failed — please try again' });
  }
});

router.post('/answers/:id/accept', authenticate, (req, res) => {
  const answer = queryOne(`
    SELECT a.*, q.user_id as question_author
    FROM answers a JOIN questions q ON a.question_id = q.id WHERE a.id = ?
  `, [req.params.id]);

  if (!answer) return res.status(404).json({ error: 'Answer not found' });
  if (answer.question_author !== req.user.id) return res.status(403).json({ error: 'Only the question author can accept an answer' });

  run('UPDATE answers SET is_accepted = 0 WHERE question_id = ?', [answer.question_id]);
  run('UPDATE answers SET is_accepted = 1 WHERE id = ?', [answer.id]);
  run('UPDATE users SET reputation = reputation + 15 WHERE id = ?', [answer.user_id]);

  const updated = queryOne('SELECT a.*, u.name as author_name FROM answers a JOIN users u ON a.user_id = u.id WHERE a.id = ?', [answer.id]);
  res.json({ answer: updated });
});

// ── COMMUNITY FAQS (for Yaksha brain) ─────────────────────────────────────────

router.get('/community/faqs', (req, res) => {
  // Top-voted answered community questions - used to train Yaksha assistant
  const faqs = queryAll(`
    SELECT q.id, q.title, q.description, q.category, q.created_at,
           COALESCE(a_count.answer_count, 0) as answer_count,
           COALESCE(v.upvotes, 0) as upvotes
    FROM questions q
    LEFT JOIN (SELECT question_id, COUNT(*) as answer_count FROM answers GROUP BY question_id) a_count ON q.id = a_count.question_id
    LEFT JOIN (
      SELECT target_id,
             SUM(CASE WHEN direction = 'up'   THEN 1 ELSE 0 END) as upvotes,
             SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) as downvotes
      FROM votes WHERE target_type = 'question' GROUP BY target_id
    ) v ON q.id = v.target_id
    WHERE COALESCE(a_count.answer_count, 0) > 0
    ORDER BY upvotes DESC, q.created_at DESC
    LIMIT 50
  `);

  // Attach the top answer for each question
  const result = faqs.map(q => {
    const topAnswer = queryOne(`
      SELECT a.content, u.name as author_name, a.is_accepted
      FROM answers a
      JOIN users u ON a.user_id = u.id
      WHERE a.question_id = ?
      ORDER BY a.is_accepted DESC, a.created_at ASC
      LIMIT 1
    `, [q.id]);
    return { ...q, top_answer: topAnswer || null };
  });

  res.json({ faqs: result });
});

// ── FAQ PROMOTION ──────────────────────────────────────────────────────────────

router.post('/community/questions/:id/promote', (req, res) => {
  const question = queryOne('SELECT * FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  // Check score >= 10 and at least 1 answer
  const upvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', req.params.id, 'up'])?.c || 0;
  const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', req.params.id, 'down'])?.c || 0;
  const score = upvotes - downvotes;
  const answerCount = queryOne('SELECT COUNT(*) as c FROM answers WHERE question_id = ?', [req.params.id])?.c || 0;

  if (score < 10) return res.status(400).json({ error: 'Question must have a score of at least 10 to be promoted' });
  if (answerCount < 1) return res.status(400).json({ error: 'Question must have at least 1 answer to be promoted' });

  run('UPDATE questions SET is_faq = 1, promoted_at = datetime(\'now\') WHERE id = ?', [req.params.id]);

  const updated = queryOne('SELECT * FROM questions WHERE id = ?', [req.params.id]);
  res.json({ question: { ...updated, score, upvotes, downvotes, answer_count: answerCount } });
});

router.get('/community/promoted', (req, res) => {
  const questions = queryAll(`
    SELECT q.*,
           COALESCE(a_count.answer_count, 0) as answer_count,
           COALESCE(v.upvotes, 0) as upvotes,
           COALESCE(v.downvotes, 0) as downvotes
    FROM questions q
    LEFT JOIN (SELECT question_id, COUNT(*) as answer_count FROM answers GROUP BY question_id) a_count ON q.id = a_count.question_id
    LEFT JOIN (
      SELECT target_id,
             SUM(CASE WHEN direction = 'up'   THEN 1 ELSE 0 END) as upvotes,
             SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) as downvotes
      FROM votes WHERE target_type = 'question' GROUP BY target_id
    ) v ON q.id = v.target_id
    WHERE q.is_faq = 1
    ORDER BY q.promoted_at DESC
  `);

  res.json({ questions: questions.map(q => ({ ...q, score: (q.upvotes || 0) - (q.downvotes || 0) })) });
});

// ── LEADERBOARD ────────────────────────────────────────────────────────────────

router.get('/leaderboard', (req, res) => {
  const users = queryAll(`
    SELECT u.id, u.name, u.reputation,
           COALESCE(qc.c, 0) as question_count,
           COALESCE(ac.c, 0) as answer_count
    FROM users u
    LEFT JOIN (SELECT user_id, COUNT(*) as c FROM questions GROUP BY user_id) qc ON u.id = qc.user_id
    LEFT JOIN (SELECT user_id, COUNT(*) as c FROM answers GROUP BY user_id) ac ON u.id = ac.user_id
    WHERE u.email != 'anonymous@crowd.faq'
    ORDER BY u.reputation DESC
    LIMIT 20
  `);

  const leaderboard = users.map((u, i) => {
    let badge = '';
    if (u.reputation >= 200) badge = 'Gold';
    else if (u.reputation >= 100) badge = 'Silver';
    else if (u.reputation >= 50) badge = 'Bronze';

    return {
      rank: i + 1,
      name: u.name,
      sp: u.reputation,
      badge,
      questionCount: u.question_count,
      answerCount: u.answer_count,
    };
  });

  res.json({ leaderboard });
});

// ── STATS ───────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const totalQuestions  = queryOne('SELECT COUNT(*) as c FROM questions')?.c || 0;
  const totalAnswers    = queryOne('SELECT COUNT(*) as c FROM answers')?.c || 0;
  const answeredQuestions = queryOne('SELECT COUNT(DISTINCT question_id) as c FROM answers')?.c || 0;
  const answeredPct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const totalUsers    = queryOne('SELECT COUNT(*) as c FROM users WHERE email != ?', ['anonymous@crowd.faq'])?.c || 0;
  const topContributors = queryAll('SELECT id, name, reputation FROM users WHERE email != ? ORDER BY reputation DESC LIMIT 5', ['anonymous@crowd.faq']);

  // Category distribution (% of answered questions per category)
  const categoryRows = queryAll(`
    SELECT q.category,
           COUNT(DISTINCT q.id) as q_count,
           COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered
    FROM questions q
    LEFT JOIN answers a ON q.id = a.question_id
    GROUP BY q.category
    HAVING q_count > 0
  `);
  const catTotal = categoryRows.reduce((s, r) => s + r.q_count, 0);
  const categoryDistribution = categoryRows.map(r => ({
    name:  r.category || 'General',
    value: catTotal > 0 ? Math.round((r.q_count / catTotal) * 100) : 0,
    answered: r.answered,
  }));

  // Weekly activity - last 7 days of question/answer posts
  const weeklyActivity = queryAll(`
    SELECT
      strftime('%w', created_at) as dow,
      COUNT(DISTINCT CASE WHEN type = 'question' THEN id END) as questions,
      COUNT(DISTINCT CASE WHEN type = 'answer'   THEN id END) as answers
    FROM (
      SELECT id, created_at, 'question' as type FROM questions
      UNION ALL
      SELECT id, created_at, 'answer'   as type FROM answers
    )
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY dow
    ORDER BY dow
  `).map(row => ({
    day:     ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][parseInt(row.dow)],
    questions: row.questions || 0,
    answers:   row.answers   || 0,
  }));

  // Trending topics - top voted unanswered questions (community hotspots)
  const trendingTopics = queryAll(`
    SELECT q.title as name, COUNT(DISTINCT v.id) as count
    FROM questions q
    LEFT JOIN votes v ON v.target_type = 'question' AND v.target_id = q.id
    GROUP BY q.id
    ORDER BY count DESC
    LIMIT 8
  `).map((t, i) => ({
    name:   t.name.slice(0, 40),
    count:  t.count || 0,
    growth: `+${Math.floor(Math.random() * 20 + 5)}%`, // placeholder - real growth calc needs time-series
  }));

  // Top voted community questions for insights
  const topCommunity = queryAll(`
    SELECT q.id, q.title, q.category, COUNT(DISTINCT v.id) as votes,
           COUNT(DISTINCT a.id) as answer_count
    FROM questions q
    LEFT JOIN votes v ON v.target_type = 'question' AND v.target_id = q.id
    LEFT JOIN answers a ON a.question_id = q.id
    GROUP BY q.id
    ORDER BY votes DESC
    LIMIT 10
  `);

  // Heatmap data - votes by hour and day (last 30 days)
  const heatmapData = queryAll(`
    SELECT
      strftime('%w', v.created_at) as dow,
      strftime('%H', v.created_at) as hour,
      COUNT(*) as count
    FROM votes v
    WHERE v.created_at >= datetime('now', '-30 days')
    GROUP BY dow, hour
  `);
  // Build heatmap grid [hour x day-of-week]
  const hours = ['6am','9am','12pm','3pm','6pm','9pm','11pm'];
  const heatmapGrid = hours.map(h => {
    const row = { hour: h };
    for (let d = 0; d < 7; d++) {
      const key = ['mon','tue','wed','thu','fri','sat','sun'][d];
      row[key] = heatmapData
        .filter(r => r.hour === h.replace(/am|pm/, '').padStart(2,'0') && parseInt(r.dow) === d)
        .reduce((s, r) => s + r.count, 0);
    }
    return row;
  });

  res.json({
    totalQuestions, totalAnswers, totalUsers,
    answeredPct, topContributors,
    categoryDistribution,
    weeklyActivity:   weeklyActivity.length ? weeklyActivity : [{ day:'Mon',questions:2,answers:8 },{day:'Tue',questions:3,answers:12},{day:'Wed',questions:4,answers:10},{day:'Thu',questions:2,answers:9},{day:'Fri',questions:5,answers:15},{day:'Sat',questions:1,answers:5},{day:'Sun',questions:1,answers:4 }],
    trendingTopics:   trendingTopics.length ? trendingTopics : [{ name:'NOC Requirements',count:234,growth:'+12%' },{ name:'Attendance Rules',count:189,growth:'+8%' },{ name:'Certificate Process',count:167,growth:'+15%' },{ name:'ViBe Platform',count:143,growth:'+5%' }],
    heatmapData:      heatmapGrid,
    topCommunity,
  });
});

// AI analysis trigger endpoint — accessible to faculty for on-demand re-analysis
router.get('/questions/:id/analyze', authenticate, async (req, res) => {
  if (req.user.role !== 'faculty') return res.status(403).json({ error: 'Faculty only' });
  const question = queryOne('SELECT id FROM questions WHERE id = ?', [req.params.id]);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  try {
    const { analyzeQuestion } = await import('../utils/ai-engine.js');
    const analysis = analyzeQuestion(req.params.id);
    if (!analysis) return res.status(500).json({ error: 'Analysis failed' });
    res.json({ analysis });
  } catch (err) {
    console.error('[analyze] failed:', err.message);
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

export default router;