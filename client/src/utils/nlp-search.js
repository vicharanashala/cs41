// ─── NLP Search Engine — BM25 + RAG Retrieval Pipeline ────────────────────
// Full retrieval-augmented search for the Vicharanashala FAQ corpus.
// Pipeline: Tokenise → Stem → Synonym-expand → BM25 → Chunk-level retrieval
//           → Re-rank (phrase, proximity, fuzzy, question-type) → Deduplicate → Score
// Pure JS, zero dependencies, runs entirely client-side.
// ────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// STOP WORDS — filtered before indexing and querying
// ═══════════════════════════════════════════════════════════════════════════
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she',
  'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
  'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that',
  'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can',
  'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're', 've',
  'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven',
  'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn',
  'weren', 'won', 'wouldn', 'also', 'get', 'got', 'like', 'would', 'could',
  'shall', 'may', 'might', 'must', 'need', 'let', 'us', 'go', 'going',
  'went', 'come', 'came', 'make', 'made', 'take', 'took', 'give', 'gave',
  'tell', 'told', 'say', 'said', 'know', 'knew', 'think', 'thought', 'see',
  'saw', 'want', 'use', 'used', 'find', 'found', 'please', 'thank', 'thanks',
  'hi', 'hello', 'hey', 'ok', 'okay', 'yes', 'yeah', 'ya', 'yep', 'nope',
]);


// ═══════════════════════════════════════════════════════════════════════════
// SYNONYM GROUPS — domain-specific semantic equivalences
// ═══════════════════════════════════════════════════════════════════════════
const SYNONYM_GROUPS = [
  ['stipend', 'salary', 'pay', 'paid', 'payment', 'money', 'compensation', 'wage'],
  ['noc', 'no objection', 'no objection certificate', 'permission letter'],
  ['certificate', 'cert', 'completion certificate', 'credential'],
  ['attendance', 'present', 'absent', 'attend', 'participation'],
  ['zoom', 'meeting', 'session', 'call', 'video call', 'live session'],
  ['mentor', 'guide', 'supervisor', 'advisor', 'teacher', 'instructor'],
  ['vibe', 'lms', 'learning management', 'learning platform', 'course platform'],
  ['rosetta', 'journal', 'daily journal', 'reflection', 'diary', 'daily log'],
  ['start', 'begin', 'commence', 'join', 'onboard'],
  ['end', 'finish', 'complete', 'conclude', 'deadline', 'last date'],
  ['exam', 'examination', 'test', 'semester exam'],
  ['leave', 'break', 'absence', 'time off', 'gap'],
  ['laptop', 'computer', 'pc', 'system', 'device'],
  ['project', 'assignment', 'task', 'work', 'contribution'],
  ['eligible', 'eligibility', 'qualify', 'can join', 'can apply'],
  ['alumni', 'graduated', 'graduate', 'passed out'],
  ['hod', 'head of department', 'principal', 'dean', 'director'],
  ['sign', 'signature', 'signed', 'signing'],
  ['stamp', 'seal', 'rubber stamp', 'institutional seal'],
  ['duration', 'length', 'period', 'time', 'how long', 'timeframe'],
  ['team', 'group', 'partner', 'teammate', 'collaboration'],
  ['vins', 'online programme', 'vicharanashala internship'],
  ['vise', 'offline programme', 'in-person', 'lab visit'],
  ['internship', 'intern', 'programme', 'program'],
  ['camera', 'webcam', 'video', 'cam'],
  ['recording', 'recorded', 'record', 'replay'],
  ['offer letter', 'selection letter', 'acceptance'],
  ['chatgpt', 'ai tools', 'artificial intelligence', 'llm', 'gpt'],
  ['bronze', 'phase 1', 'training phase', 'first phase'],
  ['silver', 'phase 2', 'project phase', 'second phase'],
  ['gold', 'phase 3', 'third phase'],
  ['platinum', 'phase 4', 'fourth phase'],
  ['selected', 'selection', 'result', 'result panel', 'accepted'],
  ['free', 'no charge', 'no cost', 'no fee'],
  ['discord', 'slack', 'communication', 'channel', 'chat'],
  ['github', 'git', 'repository', 'repo', 'code'],
  ['switch', 'change', 'transfer', 'move', 'shift'],
  ['format', 'template', 'structure', 'layout', 'form'],
  ['upload', 'submit', 'send', 'attach', 'provide'],
  ['download', 'save', 'export', 'get', 'obtain'],
  ['poll', 'quiz', 'quizzes', 'assessment', 'test'],
  ['progress', 'status', 'tracking', 'advancement'],
  ['invite', 'invitation', 'link', 'access', 'enrol'],
  ['flag', 'report', 'issue', 'bug', 'problem', 'error'],
  ['stuck', 'frozen', 'hanging', 'not working', 'broken'],
  ['quiet helper', 'monitoring', 'proctoring', 'surveillance'],
  ['whatsapp', 'telegram', 'unofficial group'],
  ['penalty', 'penalise', 'deduction', 'score reduction'],
  ['proctored', 'proctoring', 'supervised', 'monitored'],
  ['consent', 'permission', 'agreement', 'allow'],
  ['yaksha', 'chatbot', 'bot', 'assistant', 'ai assistant'],
  ['summership', 'summer internship', 'summer programme', 'summer program'],
  ['hours', 'time commitment', 'work hours', 'daily hours', 'schedule'],
  ['iit ropar', 'iit', 'ropar', 'vicharanashala', 'vicharanashala lab'],
  ['linear progression', 'sequential', 'ordered', 'in sequence'],
  ['access restricted', 'locked', 'blocked', 'cannot access'],
  ['self-declaration', 'self declaration', 'tentative', 'temporary'],
  ['withdrawal', 'withdrawn', 'revoked', 'cancelled'],
  ['kickoff', 'orientation', 'onboarding', 'day 1', 'first day'],
  ['email', 'mail', 'gmail', 'inbox', 'message'],
];

// ─── Build fast lookup: word → set of synonyms ────────────────────────────
const _synonymMap = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const others = new Set(group.filter(w => w !== word));
    if (_synonymMap.has(word)) {
      for (const o of others) _synonymMap.get(word).add(o);
    } else {
      _synonymMap.set(word, others);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// PORTER STEMMER (simplified but effective)
// Handles: -ing, -ed, -s, -tion, -ment, -ness, -ive, -ous, -ly, -ful, etc.
// ═══════════════════════════════════════════════════════════════════════════
function stem(word) {
  if (word.length < 4) return word;
  let w = word;

  // Step 1a: plurals
  if (w.endsWith('sses'))      w = w.slice(0, -2);
  else if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('ss'))   { /* keep */ }
  else if (w.endsWith('s') && w.length > 3) w = w.slice(0, -1);

  // Step 1b: past tense and progressive
  const hasVowel = (s) => /[aeiouy]/.test(s);

  if (w.endsWith('eed') && w.length > 4) {
    w = w.slice(0, -1);
  } else if (w.endsWith('edly') && hasVowel(w.slice(0, -4))) {
    w = w.slice(0, -4);
  } else if (w.endsWith('ingly') && hasVowel(w.slice(0, -5))) {
    w = w.slice(0, -5);
  } else if (w.endsWith('ing') && hasVowel(w.slice(0, -3)) && w.length > 5) {
    w = w.slice(0, -3);
    // Handle doubling: e.g. running → runn → run
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2] &&
        'bdfgmnprt'.includes(w[w.length - 1])) {
      w = w.slice(0, -1);
    }
  } else if (w.endsWith('ed') && hasVowel(w.slice(0, -2)) && w.length > 4) {
    w = w.slice(0, -2);
    // Handle doubling
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2] &&
        'bdfgmnprt'.includes(w[w.length - 1])) {
      w = w.slice(0, -1);
    }
  }

  // Step 2: suffix normalisation (longest match first)
  const suffixMap = [
    ['ational', 'ate'], ['tional', 'tion'], ['isation', 'ize'],
    ['ization', 'ize'], ['fulness', 'ful'], ['ousness', 'ous'],
    ['iveness', 'ive'], ['enci', 'ence'], ['anci', 'ance'],
    ['ation', 'ate'], ['ator', 'ate'], ['izer', 'ize'],
    ['alism', 'al'], ['aliti', 'al'], ['iviti', 'ive'],
    ['biliti', 'ble'], ['ously', 'ous'], ['ively', 'ive'],
    ['ment', ''], ['ness', ''], ['ally', 'al'],
    ['ity', ''], ['ful', ''], ['ous', ''],
    ['ive', ''], ['tion', ''], ['sion', ''],
  ];

  for (const [suffix, replacement] of suffixMap) {
    if (w.endsWith(suffix) && (w.length - suffix.length) >= 3) {
      w = w.slice(0, -suffix.length) + replacement;
      break;
    }
  }

  // Step 3: final cleanup — remove trailing -ly
  if (w.endsWith('ly') && w.length > 4 && hasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
  }

  return w;
}


// ═══════════════════════════════════════════════════════════════════════════
// TOKENISER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tokenise text into normalised words (lowercase, no stop words, no punct).
 * Preserves domain terms like "phase 1", "no objection", etc.
 */
export function tokenise(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s'#@-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^[-']+|[-']+$/g, ''))
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Tokenise and stem every token.
 */
export function tokeniseAndStem(text) {
  return tokenise(text).map(stem);
}

/**
 * Build bigrams from tokens for phrase-level matching.
 */
function bigrams(tokens) {
  const bg = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bg.push(tokens[i] + '_' + tokens[i + 1]);
  }
  return bg;
}


// ═══════════════════════════════════════════════════════════════════════════
// LEVENSHTEIN DISTANCE — fuzzy matching for typo tolerance
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute edit distance between two strings.
 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two-row optimisation to save memory
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  let curr = new Array(a.length + 1);

  for (let i = 1; i <= b.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length];
}

/**
 * Fuzzy match score: 1 = exact, 0 = no match.
 * Allows edit distance of max 30% of word length.
 */
function fuzzyScore(a, b) {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;

  const maxDist = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.3));
  const dist = levenshtein(a, b);

  if (dist > maxDist) return 0;
  return 1 - (dist / Math.max(a.length, b.length));
}


// ═══════════════════════════════════════════════════════════════════════════
// SYNONYM EXPANSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Expand query tokens with synonyms.
 * Original tokens → weight 1.0, synonym expansions → weight 0.6.
 * Returns Map<token, weight>.
 */
function expandWithSynonyms(tokens) {
  const expanded = new Map();

  for (const t of tokens) {
    expanded.set(t, 1.0);

    // Check single-word synonyms
    if (_synonymMap.has(t)) {
      for (const syn of _synonymMap.get(t)) {
        const synTokens = tokeniseAndStem(syn);
        for (const st of synTokens) {
          if (!expanded.has(st)) expanded.set(st, 0.6);
        }
      }
    }
  }

  // Check multi-word synonym matches (e.g. "no objection" in query)
  const rawText = tokens.join(' ');
  for (const group of SYNONYM_GROUPS) {
    for (const phrase of group) {
      if (phrase.includes(' ') && rawText.includes(phrase.replace(/\s+/g, ' '))) {
        for (const syn of group) {
          const synTokens = tokeniseAndStem(syn);
          for (const st of synTokens) {
            if (!expanded.has(st)) expanded.set(st, 0.6);
          }
        }
        break;
      }
    }
  }

  return expanded;
}


// ═══════════════════════════════════════════════════════════════════════════
// QUESTION-TYPE DETECTION — Enhancement #2
// Detects the question word (who/what/when/where/why/how/can/is/do)
// ═══════════════════════════════════════════════════════════════════════════

const QUESTION_WORDS = new Set([
  'who', 'what', 'when', 'where', 'why', 'how', 'can', 'is', 'do',
]);

/**
 * Detect the question type from a list of raw (unstemmed) tokens.
 * Returns the question word if found at the start, otherwise null.
 */
function detectQuestionType(tokens) {
  if (!tokens || tokens.length === 0) return null;
  // We check the raw text's first word (before stop-word removal)
  // So we accept the tokens as-is and look for a question word
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (QUESTION_WORDS.has(lower)) return lower;
  }
  return null;
}

/**
 * Tokenise text keeping question words (stop words are usually stripped).
 * Used specifically for question-type detection.
 */
function tokeniseKeepQuestionWords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s'#@-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^[-']+|[-']+$/g, ''))
    .filter(w => w.length >= 2);
}


// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT CHUNKING — breaks FAQ into sentence-level chunks for RAG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split text into individual sentences.
 * Handles abbreviations, numbered lists, special chars.
 */
function splitSentences(text) {
  if (!text) return [];
  // Split on sentence-ending punctuation, but not on abbreviations or numbers
  return text
    .replace(/\\n/g, '. ')  // handle escaped newlines from JSON
    .replace(/\n/g, '. ')
    .split(/(?<=[.!?])\s+|(?<=\d)\.\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

/**
 * Create chunks from a FAQ.
 * Each FAQ produces:
 *   - 1 question chunk (high weight — 2.0)
 *   - 1 answer-first-sentence chunk (weight 1.5)
 *   - 1 full-answer chunk (for phrase matching, weight 1.0)
 *   - N remaining sentence chunks from the answer (weight 0.8)
 *   - 1 context chunk (weight 0.3)
 */
function chunkFAQ(faq) {
  const qText = faq.q || faq.title || '';
  const aText = faq.a || faq.description || faq.content || '';
  const category = faq.category || '';
  const section = faq.section || '';

  const chunks = [];

  // Question chunk — boosted weight (Enhancement #1: 1.5 → 2.0)
  chunks.push({
    id: faq.id + '#q',
    faqId: faq.id,
    type: 'question',
    text: qText,
    weight: 2.0,  // question chunks score higher
    faq,
  });

  // Full answer chunk — good for phrase/exact matching
  chunks.push({
    id: faq.id + '#a',
    faqId: faq.id,
    type: 'answer',
    text: aText,
    weight: 1.0,
    faq,
  });

  // Individual sentence chunks from the answer
  const sentences = splitSentences(aText);

  // Enhancement #1: First sentence of the answer gets its own boosted chunk
  if (sentences.length > 0) {
    chunks.push({
      id: faq.id + '#a1st',
      faqId: faq.id,
      type: 'answer_first',
      text: sentences[0],
      weight: 1.5,  // first sentence is often the most informative
      faq,
    });
  }

  // Remaining sentences get weight 0.8 (Enhancement #1: down from 1.0)
  sentences.forEach((sentence, idx) => {
    chunks.push({
      id: faq.id + '#s' + idx,
      faqId: faq.id,
      type: 'sentence',
      text: sentence,
      weight: idx === 0 ? 0.8 : 0.8,  // all sentence chunks at 0.8
      faq,
    });
  });

  // Category/section context chunk (low weight, helps with category queries)
  if (category || section) {
    chunks.push({
      id: faq.id + '#ctx',
      faqId: faq.id,
      type: 'context',
      text: `${section} ${category}`,
      weight: 0.3,
      faq,
    });
  }

  return chunks;
}


// ═══════════════════════════════════════════════════════════════════════════
// LRU QUERY CACHE — Enhancement #5
// Simple LRU cache to avoid redundant search computations
// ═══════════════════════════════════════════════════════════════════════════

class LRUCache {
  constructor(max = 50) {
    this.max = max;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const v = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, v);
    return v;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.max) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  clear() {
    this.cache.clear();
  }
}

const _queryCache = new LRUCache(50);


// ═══════════════════════════════════════════════════════════════════════════
// BM25 INDEX — Okapi BM25 scoring replaces TF-IDF
// Parameters: k1 = 1.5 (term frequency saturation), b = 0.75 (length norm)
// ═══════════════════════════════════════════════════════════════════════════

class BM25Index {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.chunks = [];       // indexed chunks with precomputed data
    this.idf = {};          // term → IDF
    this.avgdl = 0;         // average document length across corpus
    this.docCount = 0;
    this.allTerms = new Set();  // vocabulary for fuzzy matching
    this.icfMultiplier = {};    // Enhancement #3: term → ICF multiplier
  }

  /**
   * Build the BM25 index from an array of chunks.
   * Each chunk: { id, faqId, type, text, weight, faq }
   */
  build(chunks) {
    this.docCount = chunks.length;
    const df = {};    // document frequency per term
    let totalLength = 0;

    // First pass: tokenise all chunks, compute TF and DF
    this.chunks = chunks.map(chunk => {
      const raw = tokenise(chunk.text);
      const stemmed = raw.map(stem);
      const bg = bigrams(stemmed);
      const allTerms = [...stemmed, ...bg];

      // Term frequency (raw count, not normalised — BM25 handles it)
      const tf = {};
      for (const t of allTerms) {
        tf[t] = (tf[t] || 0) + 1;
      }

      // Track document frequency (term appears in how many chunks)
      const seen = new Set(allTerms);
      for (const t of seen) {
        df[t] = (df[t] || 0) + 1;
        this.allTerms.add(t);
      }

      totalLength += allTerms.length;

      return {
        ...chunk,
        tokens: raw,
        stemmed,
        bigrams: bg,
        tf,
        dl: allTerms.length,  // document length
      };
    });

    // Average document length
    this.avgdl = totalLength / (this.docCount || 1);

    // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
    // Using the improved BM25 IDF formula
    this.idf = {};
    for (const term in df) {
      this.idf[term] = Math.log(
        1 + (this.docCount - df[term] + 0.5) / (df[term] + 0.5)
      );
    }

    // ── Enhancement #3: TF-ICF (Inverse Category Frequency) ──
    // Compute how many distinct categories each term appears in
    this._buildICF();
  }

  /**
   * Build ICF (Inverse Category Frequency) multipliers.
   * Terms in only 1-2 categories → 1.3x boost (discriminative).
   * Terms in 5+ categories → 0.7x penalty (too generic).
   */
  _buildICF() {
    const termCategoryCount = {};  // term → Set<category>

    for (const chunk of this.chunks) {
      const category = chunk.faq?.category || '_default';
      const seen = new Set([...(chunk.stemmed || []), ...(chunk.bigrams || [])]);
      for (const t of seen) {
        if (!termCategoryCount[t]) termCategoryCount[t] = new Set();
        termCategoryCount[t].add(category);
      }
    }

    this.icfMultiplier = {};
    for (const term in termCategoryCount) {
      const catCount = termCategoryCount[term].size;
      if (catCount <= 2) {
        this.icfMultiplier[term] = 1.3;  // discriminative — boost
      } else if (catCount >= 5) {
        this.icfMultiplier[term] = 0.7;  // too generic — penalty
      } else {
        this.icfMultiplier[term] = 1.0;  // neutral
      }
    }
  }

  /**
   * Score a single chunk against a query using BM25 + ICF.
   * @param {object} chunk - indexed chunk
   * @param {Map} queryTerms - Map<stemmed_term, weight>
   * @returns {number} BM25 score
   */
  scoreChunk(chunk, queryTerms) {
    let score = 0;
    const { tf, dl } = chunk;

    for (const [term, queryWeight] of queryTerms) {
      const termFreq = tf[term] || 0;
      if (termFreq === 0) continue;

      const idf = this.idf[term] || 0;
      // BM25 formula: IDF × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × dl/avgdl))
      const numerator = termFreq * (this.k1 + 1);
      const denominator = termFreq + this.k1 * (1 - this.b + this.b * dl / this.avgdl);

      // Enhancement #3: apply ICF multiplier
      const icf = this.icfMultiplier[term] || 1.0;

      score += idf * (numerator / denominator) * queryWeight * chunk.weight * icf;
    }

    return score;
  }

  /**
   * Retrieve top-K chunks for a query using BM25.
   * Stage 1 of the retrieval pipeline.
   */
  retrieve(query, topK = 20) {
    const rawTokens = tokenise(query);
    const stemmedTokens = rawTokens.map(stem);
    const queryBigrams = bigrams(stemmedTokens);

    // Expand with synonyms
    const expanded = expandWithSynonyms(stemmedTokens);

    // Also check raw tokens for synonym expansion (catches unstemmed matches)
    const expandedRaw = expandWithSynonyms(rawTokens);
    for (const [k, v] of expandedRaw) {
      const sk = stem(k);
      if (!expanded.has(sk)) expanded.set(sk, v * 0.5);
    }

    // Add bigrams to query with weight
    for (const bg of queryBigrams) {
      if (!expanded.has(bg)) expanded.set(bg, 1.2);
    }

    // Also keep the raw tokens (before stop-word removal) for question-type detection
    const fullRawTokens = tokeniseKeepQuestionWords(query);

    // Score all chunks
    const scored = [];
    for (const chunk of this.chunks) {
      const bm25Score = this.scoreChunk(chunk, expanded);
      if (bm25Score > 0) {
        scored.push({ chunk, score: bm25Score, queryTokens: stemmedTokens, rawTokens, fullRawTokens });
      }
    }

    // Sort by score, return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// RE-RANKING — Stage 2: enhance BM25 scores with advanced signals
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Re-rank a set of BM25 results using:
 *  1. Exact phrase match boost
 *  2. Synonym overlap boost
 *  3. Proximity scoring (how close query terms appear)
 *  4. Fuzzy matching for typo tolerance
 *  5. Word overlap ratio
 *  6. Question-type alignment (Enhancement #2)
 */
function rerank(results) {
  return results.map(({ chunk, score, queryTokens, rawTokens, fullRawTokens }) => {
    let adjustedScore = score;
    const docText = (chunk.stemmed || []).join(' ');
    const docRaw = (chunk.tokens || []).join(' ');

    // ── 1. Exact phrase match ──
    const queryPhrase = rawTokens.join(' ');
    const stemmedPhrase = queryTokens.join(' ');
    if (docRaw.includes(queryPhrase)) {
      adjustedScore *= 2.0;   // strong boost for exact match
    } else if (docText.includes(stemmedPhrase)) {
      adjustedScore *= 1.5;   // moderate boost for stemmed match
    }

    // ── 2. Proximity scoring ──
    // Reward chunks where query terms appear close together
    if (queryTokens.length > 1 && chunk.stemmed && chunk.stemmed.length > 0) {
      const positions = [];
      for (const qt of queryTokens) {
        const idx = chunk.stemmed.indexOf(qt);
        if (idx >= 0) positions.push(idx);
      }
      if (positions.length >= 2) {
        positions.sort((a, b) => a - b);
        const span = positions[positions.length - 1] - positions[0];
        // Perfect proximity = all terms adjacent
        const idealSpan = positions.length - 1;
        const proximityBoost = idealSpan / Math.max(span, 1);
        adjustedScore *= (1 + proximityBoost * 0.3);
      }
    }

    // ── 3. Fuzzy matching boost ──
    let fuzzyBoost = 0;
    for (const qt of queryTokens) {
      for (const dt of (chunk.stemmed || [])) {
        const fs = fuzzyScore(qt, dt);
        if (fs > 0 && fs < 1) {
          fuzzyBoost += fs * 0.05;
        }
      }
    }
    adjustedScore += Math.min(fuzzyBoost, 0.5);

    // ── 4. Word overlap ratio ──
    const matchedCount = queryTokens.filter(t =>
      (chunk.stemmed || []).includes(t)
    ).length;
    const overlapRatio = matchedCount / (queryTokens.length || 1);
    adjustedScore *= (1 + overlapRatio * 0.2);

    // ── 5. Question-type boost ──
    // Questions match user intent better than answer sentences
    if (chunk.type === 'question') {
      adjustedScore *= 1.2;
    }

    // ── 6. Question-type alignment (Enhancement #2) ──
    // Boost when query and FAQ question start with the same question word
    const queryTypeTokens = fullRawTokens || rawTokens;
    const queryType = detectQuestionType(queryTypeTokens);
    if (queryType && chunk.type === 'question') {
      // Get raw tokens of the FAQ question text (including question words)
      const faqQuestionTokens = tokeniseKeepQuestionWords(chunk.text);
      const faqType = detectQuestionType(faqQuestionTokens);
      if (queryType === faqType) {
        adjustedScore *= 1.3; // same question type
      }
    }

    // Collect highlight tokens
    const highlights = rawTokens.filter(token =>
      (chunk.stemmed || []).includes(stem(token))
    );

    return {
      chunk,
      score: adjustedScore,
      highlights,
      matchedTerms: matchedCount,
      totalTerms: queryTokens.length,
    };
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// DEDUPLICATION — Stage 3: merge chunks from same FAQ, keep best score
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deduplicate results by FAQ ID.
 * When multiple chunks from the same FAQ match, keep the best score
 * and merge highlights and chunk references.
 */
function deduplicateByFAQ(rankedResults) {
  const faqMap = new Map();

  for (const result of rankedResults) {
    const faqId = result.chunk.faqId;

    if (!faqMap.has(faqId)) {
      faqMap.set(faqId, {
        faq: result.chunk.faq,
        score: result.score,
        highlights: [...result.highlights],
        matchedTerms: result.matchedTerms,
        totalTerms: result.totalTerms,
        chunks: [{ chunkId: result.chunk.id, type: result.chunk.type, score: result.score }],
      });
    } else {
      const existing = faqMap.get(faqId);
      // Take the better score, but add a small bonus for multi-chunk matches
      const multiChunkBonus = 0.1 * Math.min(existing.chunks.length, 3);
      existing.score = Math.max(existing.score, result.score) + multiChunkBonus;
      // Merge highlights
      for (const h of result.highlights) {
        if (!existing.highlights.includes(h)) existing.highlights.push(h);
      }
      existing.matchedTerms = Math.max(existing.matchedTerms, result.matchedTerms);
      existing.chunks.push({
        chunkId: result.chunk.id,
        type: result.chunk.type,
        score: result.score,
      });
    }
  }

  return Array.from(faqMap.values()).sort((a, b) => b.score - a.score);
}


// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING — Enhancement #4: Adaptive thresholds by query length
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert raw BM25 score to confidence level.
 * Thresholds calibrated for our corpus size (~127 docs, ~500+ chunks).
 * Enhancement #4: Short queries have lower thresholds since they naturally
 * produce lower BM25 scores.
 *
 * @param {number} score - raw BM25 score after re-ranking
 * @param {number} queryLength - number of query tokens (default 3)
 */
function scoreToConfidence(score, queryLength = 3) {
  // Short queries (1-2 words) have lower thresholds
  const factor = queryLength <= 2 ? 0.6 : queryLength <= 4 ? 0.8 : 1.0;

  if (score >= 4.0 * factor)  return { level: 'high',   label: 'High match',     color: '#00ff88' };
  if (score >= 2.0 * factor)  return { level: 'medium', label: 'Good match',     color: '#00d4ff' };
  if (score >= 0.8 * factor)  return { level: 'low',    label: 'Partial match',  color: '#fbbf24' };
  return                        { level: 'weak',   label: 'Possible match', color: '#ff6b6b' };
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENGINE STATE
// ═══════════════════════════════════════════════════════════════════════════

let _bm25Index = null;
let _indexedFAQs = null;
let _allChunks = [];


// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build or rebuild the FAQ search index (BM25 + RAG chunking).
 * Pass all FAQ documents (official + community).
 * Each doc should have: { id, q, a, category, section, ... }
 *
 * @param {Array} faqs - array of FAQ objects
 * @returns {BM25Index} the built index
 */
export function buildFAQIndex(faqs) {
  // Generate chunks from all FAQs
  _allChunks = [];
  for (const faq of faqs) {
    const chunks = chunkFAQ(faq);
    _allChunks.push(...chunks);
  }

  // Build BM25 index over all chunks (includes ICF computation)
  _bm25Index = new BM25Index(1.5, 0.75);
  _bm25Index.build(_allChunks);
  _indexedFAQs = faqs;

  // Enhancement #5: Clear query cache when index is rebuilt
  _queryCache.clear();

  return _bm25Index;
}


/**
 * Search FAQs using the full BM25 + RAG retrieval pipeline.
 *
 * Pipeline:
 *   1. BM25 retrieval of top-20 chunks
 *   2. Re-rank with phrase match, proximity, fuzzy, question-type alignment
 *   3. Deduplicate — merge chunks per FAQ, keep best
 *
 * @param {string} query - natural language query
 * @param {object} opts - { topK, category }
 * @returns {Array<{faq, score, confidence, highlights, chunks}>}
 */
export function searchFAQs(query, { topK = 5, category = null } = {}) {
  if (!_bm25Index || !query?.trim()) return [];

  // Enhancement #5: Check LRU cache first
  const cacheKey = `${query}|${topK}|${category}`;
  const cached = _queryCache.get(cacheKey);
  if (cached) return cached;

  // Stage 1: BM25 retrieval (wide net)
  const bm25Results = _bm25Index.retrieve(query, Math.max(topK * 4, 20));

  // Stage 2: Re-rank with enhanced scoring
  const reranked = rerank(bm25Results);

  // Stage 3: Deduplicate by FAQ
  let deduplicated = deduplicateByFAQ(reranked);

  // Apply category filter if specified
  if (category && category !== 'All') {
    const filtered = deduplicated.filter(r => r.faq.category === category);
    // If too few results with category filter, include some cross-category
    if (filtered.length < 2) {
      const cross = deduplicated
        .filter(r => r.faq.category !== category)
        .slice(0, 3);
      deduplicated = [...filtered, ...cross];
    } else {
      deduplicated = filtered;
    }
  }

  // Enhancement #4: Compute query length for adaptive confidence thresholds
  const queryTokens = tokenise(query);
  const queryLength = queryTokens.length;

  const results = deduplicated.slice(0, topK).map(r => ({
    faq: r.faq,
    score: r.score,
    confidence: scoreToConfidence(r.score, queryLength),
    highlights: r.highlights,
    chunks: r.chunks,
    matchedTerms: r.matchedTerms,
    totalTerms: r.totalTerms,
  }));

  // Enhancement #5: Store in LRU cache
  _queryCache.set(cacheKey, results);

  return results;
}


/**
 * Get "Did you mean?" suggestions for typos.
 * Compares query words against all indexed terms and suggests corrections.
 *
 * @param {string} query - user's query with potential typos
 * @returns {Array<{original, suggested, score}>}
 */
export function getSuggestions(query) {
  if (!_bm25Index) return [];

  const tokens = tokenise(query);
  const suggestions = [];

  for (const token of tokens) {
    const st = stem(token);
    let bestMatch = null;
    let bestScore = 0;

    // Check against all known terms in the index
    for (const term of _bm25Index.allTerms) {
      if (term.includes('_')) continue; // skip bigrams
      const fs = fuzzyScore(st, term);
      if (fs > bestScore && fs < 1 && fs > 0.6) {
        bestScore = fs;
        bestMatch = term;
      }
    }

    // Also check synonym keys for better suggestions
    for (const synKey of _synonymMap.keys()) {
      if (synKey.includes(' ')) continue; // skip phrases
      const fs = fuzzyScore(token, synKey);
      if (fs > bestScore && fs < 1 && fs > 0.6) {
        bestScore = fs;
        bestMatch = synKey;
      }
    }

    if (bestMatch && bestMatch !== st && bestMatch !== token) {
      suggestions.push({ original: token, suggested: bestMatch, score: bestScore });
    }
  }

  return suggestions;
}


/**
 * Get related FAQs for a given FAQ (by content similarity).
 * Uses the FAQ's question text + category as query.
 *
 * @param {string} faqId - ID of the FAQ to find relatives for
 * @param {number} topK - how many related FAQs to return
 * @returns {Array<{faq, score}>}
 */
export function getRelatedFAQs(faqId, topK = 3) {
  if (!_bm25Index || !_indexedFAQs) return [];

  const faq = _indexedFAQs.find(f => f.id === faqId);
  if (!faq) return [];

  const queryText = [
    faq.q || faq.title || '',
    faq.category || '',
    faq.section || '',
  ].join(' ');

  const results = searchFAQs(queryText, { topK: topK + 1 });

  // Exclude the FAQ itself
  return results
    .filter(r => r.faq.id !== faqId)
    .slice(0, topK)
    .map(r => ({ faq: r.faq, score: r.score }));
}


/**
 * RAG: Retrieve raw chunks for response synthesis.
 * Returns the best matching sentence-level chunks without deduplication,
 * suitable for feeding into a language model for answer generation.
 *
 * @param {string} query - natural language query
 * @param {number} topK - number of chunks to retrieve
 * @returns {Array<{chunk, score, faqId, text, type}>}
 */
export function retrieveChunks(query, topK = 5) {
  if (!_bm25Index || !query?.trim()) return [];

  // Stage 1: BM25 retrieval
  const bm25Results = _bm25Index.retrieve(query, topK * 3);

  // Stage 2: Re-rank
  const reranked = rerank(bm25Results);

  // Return raw chunks (no dedup) for RAG synthesis
  return reranked.slice(0, topK).map(r => ({
    chunk: r.chunk,
    score: r.score,
    faqId: r.chunk.faqId,
    text: r.chunk.text,
    type: r.chunk.type,
    faq: r.chunk.faq,
    highlights: r.highlights,
  }));
}


// ═══════════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION — Enhancement #6
// Checks if a new FAQ title/description is a duplicate of existing FAQs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if a given title (+ optional description) is a duplicate of an
 * existing FAQ in the index.
 *
 * @param {string} title - the FAQ title/question to check
 * @param {string} description - optional description/answer text
 * @returns {{ isDuplicate: boolean, matches: Array<{faq, similarity}>, threshold: number }}
 */
export function detectDuplicate(title, description = '') {
  const query = title + ' ' + description;
  const results = searchFAQs(query, { topK: 3 });
  const threshold = 3.0;
  const duplicates = results.filter(r => r.score >= threshold);
  return {
    isDuplicate: duplicates.length > 0,
    matches: duplicates.map(r => ({
      faq: r.faq,
      similarity: Math.min(r.score / 5.0, 1.0),
    })),
    threshold,
  };
}
