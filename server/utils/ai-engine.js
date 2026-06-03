/**
 * AI Analysis Engine — Quality scoring, duplicate detection,
 * similar FAQ recommendations, moderation flags, confidence score.
 *
 * Fully deterministic / rule-based. No external AI API required.
 * Runs synchronously on the server; call after question enters pending_review.
 */

import { queryAll, queryOne } from '../db/database.js';

// ── Tokenisation ────────────────────────────────────────────────────────────

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

// Jaccard similarity between two token sets
function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Quality Scoring ─────────────────────────────────────────────────────────

/**
 * Returns a quality score 0–100 and a breakdown of contributing factors.
 */
function scoreQuality({ title, description, answers, upvotes, downvotes, views, tags }) {
  let score = 50; // baseline
  const factors = [];

  // Title length (ideal: 40–120 chars)
  if (title.length >= 40 && title.length <= 120) {
    score += 10;
    factors.push({ factor: 'title_length', delta: 10, note: 'Good title length (40–120 chars)' });
  } else if (title.length < 40) {
    const delta = Math.max(-15, -5 * Math.floor((40 - title.length) / 10));
    score += delta;
    factors.push({ factor: 'title_length', delta, note: 'Title too short' });
  } else {
    const delta = Math.max(-5, -2 * Math.floor((title.length - 120) / 40));
    score += delta;
    factors.push({ factor: 'title_length', delta, note: 'Title very long' });
  }

  // Description length (ideal: ≥200 chars)
  const descLen = (description || '').trim().length;
  if (descLen >= 500) {
    score += 10;
    factors.push({ factor: 'description_length', delta: 10, note: 'Excellent description depth' });
  } else if (descLen >= 200) {
    score += 5;
    factors.push({ factor: 'description_length', delta: 5, note: 'Adequate description length' });
  } else if (descLen < 50) {
    const delta = -10;
    score += delta;
    factors.push({ factor: 'description_length', delta, note: 'Description too brief' });
  }

  // Has structured content (##, **, bullet points)
  const hasStructure = /#{1,3}|'''|^\s*[-*•]|\*\*.+?\*\*/m.test(description);
  if (hasStructure) {
    score += 5;
    factors.push({ factor: 'has_structure', delta: 5, note: 'Good formatting and structure' });
  }

  // Answer quality: more answers = better (capped at 5)
  const numAnswers = (answers || []).length;
  if (numAnswers >= 3) {
    score += 10;
    factors.push({ factor: 'answer_count', delta: 10, note: `Rich answers (${numAnswers} answers)` });
  } else if (numAnswers === 2) {
    score += 5;
    factors.push({ factor: 'answer_count', delta: 5, note: 'Good answer coverage (2 answers)' });
  } else if (numAnswers === 1) {
    score += 2;
    factors.push({ factor: 'answer_count', delta: 2, note: 'Single answer present' });
  } else {
    const delta = -5;
    score += delta;
    factors.push({ factor: 'answer_count', delta, note: 'No answers yet' });
  }

  // Has an accepted answer
  const hasAccepted = answers?.some(a => a.is_accepted === 1);
  if (hasAccepted) {
    score += 10;
    factors.push({ factor: 'has_accepted_answer', delta: 10, note: 'Has accepted answer' });
  }

  // Vote ratio (upvotes / total votes, when there are votes)
  const totalVotes = (upvotes || 0) + (downvotes || 0);
  if (totalVotes >= 5) {
    const upRatio = upvotes / totalVotes;
    if (upRatio >= 0.8) {
      score += 8;
      factors.push({ factor: 'vote_ratio', delta: 8, note: `Strong approval (${Math.round(upRatio * 100)}% upvotes)` });
    } else if (upRatio >= 0.6) {
      score += 4;
      factors.push({ factor: 'vote_ratio', delta: 4, note: `Good approval (${Math.round(upRatio * 100)}% upvotes)` });
    } else if (upRatio < 0.4) {
      const delta = -5;
      score += delta;
      factors.push({ factor: 'vote_ratio', delta, note: `Low approval ratio (${Math.round(upRatio * 100)}% upvotes)` });
    }
  }

  // Has tags
  const tagArr = Array.isArray(tags) ? tags : (typeof tags === 'string' ? JSON.parse(tags || '[]') : []);
  if (tagArr.length >= 2) {
    score += 5;
    factors.push({ factor: 'has_tags', delta: 5, note: `${tagArr.length} tags applied` });
  }

  // View count (questions with views are real engagement)
  if ((views || 0) >= 100) {
    score += 5;
    factors.push({ factor: 'high_views', delta: 5, note: 'High view count indicates broad interest' });
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
    summary: score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 45 ? 'fair' : 'poor',
  };
}

// ── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Find potential duplicates among published FAQs.
 * Returns top matches with similarity score 0–100.
 */
function detectDuplicates(questionId, title, description) {
  const published = queryAll(`
    SELECT id, title, description, category
    FROM questions
    WHERE faq_status = 'published' AND id != ?
    LIMIT 50
  `, [questionId]);

  const qSet = tokenSet(title + ' ' + description);
  const scored = published.map(p => {
    const pSet = tokenSet(p.title + ' ' + p.description);
    const similarity = Math.round(jaccard(qSet, pSet) * 100);
    return { ...p, similarity };
  });

  return scored
    .filter(p => p.similarity >= 30)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map(({ id, title: t, similarity }) => ({ id, title: t, similarity }));
}

// ── Similar FAQ Recommendations ─────────────────────────────────────────────

/**
 * Return top-3 similar published FAQs for cross-referencing.
 * Always excludes the question itself; includes category boost.
 */
function findSimilar(questionId, title, description, category) {
  const candidates = queryAll(`
    SELECT id, title, description, category
    FROM questions
    WHERE faq_status = 'published' AND id != ?
    LIMIT 30
  `, [questionId]);

  const qSet = tokenSet(title + ' ' + description);
  const qTags = tokenSet(title + ' ' + description);

  const scored = candidates.map(c => {
    const cSet = tokenSet(c.title + ' ' + c.description);
    let sim = jaccard(qSet, cSet);
    // Category boost (+15pp if same category)
    if (c.category === category) sim = Math.min(1, sim + 0.15);
    return { ...c, similarity: Math.round(sim * 100) };
  });

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

// ── Moderation Flags ────────────────────────────────────────────────────────

/**
 * Return an array of moderation flag objects for the question/answers.
 */
function checkModeration({ title, description, answers, upvotes, downvotes }) {
  const flags = [];

  // Spam indicators in title/description
  const spamPatterns = [
    { pattern: /buy now|click here|limited offer|act now|free money/i,       label: 'Potential promotional/spam language' },
    { pattern: /guaranteed|100%|no experience needed/i,                      label: 'Potentially misleading claim' },
    { pattern: /(https?:\/\/[^\s]+){3,}/i,                                    label: 'Multiple URLs — possible spam' },
    { pattern: /\$\$\$/i,                                                       label: 'Excessive monetary symbols' },
  ];
  for (const { pattern, label } of spamPatterns) {
    if (pattern.test(title) || pattern.test(description)) {
      flags.push({ severity: 'warning', flag: label, location: 'title/description' });
    }
  }

  // Short title
  if (title.trim().length < 20) {
    flags.push({ severity: 'warning', flag: 'Title is very short — may lack specificity', location: 'title' });
  }

  // No answers when upvotes are high
  const totalVotes = (upvotes || 0) + (downvotes || 0);
  if (totalVotes >= 10 && (!answers || answers.length === 0)) {
    flags.push({ severity: 'warning', flag: 'High votes but no answers — needs community input first', location: 'question' });
  }

  // Very low approval ratio
  if (totalVotes >= 5) {
    const ratio = (upvotes || 0) / totalVotes;
    if (ratio < 0.3) {
      flags.push({ severity: 'error', flag: 'Low approval ratio — community has concerns', location: 'votes' });
    }
  }

  // Duplicate answers (exact or near-duplicate content)
  if (answers && answers.length >= 2) {
    for (let i = 0; i < answers.length; i++) {
      for (let j = i + 1; j < answers.length; j++) {
        const aText = (answers[i].content || '').trim().toLowerCase();
        const bText = (answers[j].content || '').trim().toLowerCase();
        if (aText === bText && aText.length > 50) {
          flags.push({ severity: 'warning', flag: 'Near-identical duplicate answers detected', location: `answers[${i}] vs answers[${j}]` });
        }
      }
    }
  }

  // Profanity check (basic list)
  const profanity = /fuck|shit|ass\b|bitch|asshole|damn|bastard/i;
  if (profanity.test(title) || profanity.test(description)) {
    flags.push({ severity: 'error', flag: 'Profanity detected in title or description', location: 'title/description' });
  }
  if (answers?.some(a => profanity.test(a.content || ''))) {
    flags.push({ severity: 'warning', flag: 'Profanity detected in one or more answers', location: 'answers' });
  }

  // Very short description
  if ((description || '').trim().length < 30) {
    flags.push({ severity: 'info', flag: 'Description is too brief to be useful', location: 'description' });
  }

  return flags;
}

// ── Confidence Score ─────────────────────────────────────────────────────────

/**
 * Returns a confidence score 0–100 for the overall analysis reliability.
 * Higher when there are more signals (votes, answers, views).
 */
function computeConfidence({ upvotes, downvotes, views, answerCount, descriptionLength }) {
  const totalVotes = (upvotes || 0) + (downvotes || 0);
  const voteScore = Math.min(1, totalVotes / 20);            // max out at 20 votes
  const viewScore = Math.min(1, (views || 0) / 200);          // max out at 200 views
  const answerScore = Math.min(1, answerCount / 4);           // max out at 4 answers
  const contentScore = Math.min(1, descriptionLength / 400);  // max out at 400 chars

  // Weighted average — votes and content length matter most for reliability
  const confidence = (
    voteScore    * 0.35 +
    viewScore    * 0.15 +
    answerScore  * 0.25 +
    contentScore * 0.25
  );

  return Math.round(confidence * 100);
}

// ── Main Analyze Function ────────────────────────────────────────────────────

/**
 * Full AI analysis for a question.
 * Returns a complete analysis object — call this when a question enters
 * pending_review and on every subsequent faculty review.
 */
export function analyzeQuestion(questionId) {
  const question = queryOne(
    'SELECT q.*, u.name as author_name FROM questions q JOIN users u ON q.user_id = u.id WHERE q.id = ?',
    [questionId]
  );
  if (!question) return null;

  const answers = queryAll(`
    SELECT a.*, u.name as author_name
    FROM answers a JOIN users u ON a.user_id = u.id
    WHERE a.question_id = ?
    ORDER BY a.is_accepted DESC, a.created_at ASC
  `, [questionId]);

  const upvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', questionId, 'up'])?.c || 0;
  const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', questionId, 'down'])?.c || 0;
  const views     = question.views || 0;

  const tags = (() => { try { return JSON.parse(question.tags || '[]'); } catch { return []; } })();

  const analysis = {
    question_id: questionId,
    analyzed_at: Date.now(),

    quality: scoreQuality({
      title:       question.title,
      description: question.description,
      answers,
      upvotes,
      downvotes,
      views,
      tags,
    }),

    duplicates: detectDuplicates(questionId, question.title, question.description),

    similar_faqs: findSimilar(questionId, question.title, question.description, question.category),

    moderation: checkModeration({
      title:       question.title,
      description: question.description,
      answers,
      upvotes,
      downvotes,
    }),

    confidence: computeConfidence({
      upvotes:          upvotes,
      downvotes:        downvotes,
      views,
      answerCount:      answers.length,
      descriptionLength: (question.description || '').length,
    }),
  };

  return analysis;
}

/**
 * Compact quality summary (used for list views).
 * Returns just the quality score + confidence for a question.
 */
export function quickQualityScore(questionId) {
  const question = queryOne('SELECT * FROM questions WHERE id = ?', [questionId]);
  if (!question) return null;

  const upvotes   = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', questionId, 'up'])?.c || 0;
  const downvotes = queryOne('SELECT COUNT(*) as c FROM votes WHERE target_type=? AND target_id=? AND direction=?', ['question', questionId, 'down'])?.c || 0;
  const answerCount = queryOne('SELECT COUNT(*) as c FROM answers WHERE question_id = ?', [questionId])?.c || 0;

  const tags = (() => { try { return JSON.parse(question.tags || '[]'); } catch { return []; } })();

  const { score, summary } = scoreQuality({
    title:       question.title,
    description: question.description,
    answers:     [], // not fetched for list view
    upvotes,
    downvotes,
    views:       question.views || 0,
    tags,
  });

  const confidence = computeConfidence({
    upvotes:          upvotes,
    downvotes:        downvotes,
    views:            question.views || 0,
    answerCount,
    descriptionLength: (question.description || '').length,
  });

  return { score, summary, confidence, upvotes, downvotes, answerCount };
}