// ─── Yaksha Brain v3 ──────────────────────────────────────────────────────
// Intelligence core for the Yaksha AI chatbot.
// Implements: Intent classification, conversation context memory,
// RAG-based response synthesis, related question engine,
// smart disambiguation, and personality system.
// ────────────────────────────────────────────────────────────────────────────

import { searchFAQs, getRelatedFAQs, getSuggestions, retrieveChunks } from './nlp-search.js';
import { trackSearchQuery } from '../pages/InsightsPage.jsx';
import { searchAIFaqs } from './ai-engine.js';

// ─── Intent Classification ────────────────────────────────────────────────
// Classify every user message BEFORE doing FAQ search.
// This prevents "hey" from returning a random FAQ answer.

const INTENT_PATTERNS = {
  greeting: {
    exact: new Set(['hi', 'hey', 'hello', 'hii', 'hiii', 'yo', 'hola', 'namaste', 'namaskar',
      'good morning', 'good afternoon', 'good evening', 'good night', 'gm', 'sup', 'wassup',
      'whats up', "what's up", 'howdy', 'helo', 'hellow', 'helloo', 'heyo', 'hey there',
      'hi there', 'hello there', 'hey yaksha', 'hi yaksha', 'hello yaksha']),
    patterns: [/^(hey|hi|hello|yo|hola|namaste)\b/i, /^good\s*(morning|afternoon|evening|night)/i,
      /^(sup|wassup|whats\s*up)/i],
  },
  farewell: {
    exact: new Set(['bye', 'goodbye', 'good bye', 'see you', 'see ya', 'later', 'cya',
      'take care', 'bye bye', 'byebye', 'gtg', 'gotta go', 'signing off', 'peace',
      'bye yaksha', 'goodbye yaksha']),
    patterns: [/^(bye|goodbye|see\s*y)/i, /^(take\s*care|gotta\s*go|signing\s*off)/i],
  },
  gratitude: {
    exact: new Set(['thanks', 'thank you', 'thankyou', 'thx', 'ty', 'thnx', 'thanx',
      'thanks a lot', 'thank you so much', 'thanks much', 'much appreciated',
      'appreciated', 'helpful', 'that helps', 'that helped', 'great answer',
      'perfect', 'awesome', 'nice', 'cool', 'great', 'wonderful', 'amazing',
      'thanks yaksha', 'thank you yaksha']),
    patterns: [/^(thanks|thank\s*you|thx|ty|thnx)/i, /^(much\s*)?appreciated/i,
      /that\s*(helps?|helped|was\s*helpful)/i, /^(great|perfect|awesome|nice|cool|wonderful|amazing)\s*$/i],
  },
  affirmation: {
    exact: new Set(['yes', 'yeah', 'yep', 'yup', 'ya', 'yea', 'sure', 'ok', 'okay',
      'got it', 'understood', 'makes sense', 'i see', 'alright', 'right',
      'correct', 'exactly', 'precisely', 'indeed', 'absolutely', 'definitely',
      'oh ok', 'oh okay', 'ohk', 'k', 'kk', 'okie', 'okk', 'hmm ok']),
    patterns: [/^(yes|yeah|yep|yup|sure|ok|okay|got\s*it|understood)\s*$/i,
      /^(makes?\s*sense|i\s*see|alright)\s*$/i],
  },
  negation: {
    exact: new Set(['no', 'nope', 'nah', 'not really', 'wrong', 'incorrect',
      'not what i meant', 'thats not it', "that's not it", 'wrong answer',
      'not helpful', 'that doesnt help', "that doesn't help", 'no thats wrong',
      'try again', 'not this']),
    patterns: [/^(no|nope|nah)\s*$/i, /not\s*(what\s*i\s*(meant|asked)|helpful|right|correct)/i,
      /wrong\s*(answer)?/i, /try\s*again/i],
  },
  clarification: {
    exact: new Set(['what do you mean', 'explain', 'elaborate', 'tell me more',
      'more details', 'can you explain', 'explain more', 'go on', 'continue',
      'more info', 'more information', 'in detail', 'detailed answer',
      'expand on that', 'what else', 'and then', 'anything else']),
    patterns: [/^(what\s*do\s*you\s*mean|explain|elaborate|tell\s*me\s*more)/i,
      /^(more\s*(details?|info|information)|can\s*you\s*explain)/i,
      /^(expand\s*on\s*that|go\s*on|continue)/i,
      /^(what\s*else|anything\s*else|and\s*then)/i],
  },
  escalation: {
    exact: new Set(['#escalate', 'escalate', 'talk to human', 'human', 'real person',
      'contact support', 'help me', 'i need help', 'speak to someone',
      'connect me', 'reach out']),
    patterns: [/#escalate/i, /talk\s*to\s*(a\s*)?(human|person|someone)/i,
      /real\s*person/i, /connect\s*me\s*(to|with)/i, /speak\s*to\s*(a\s*)?someone/i],
  },
  meta: {
    exact: new Set(['who are you', 'what are you', 'what can you do', 'help',
      'your name', "what's your name", 'what is your name', 'about you',
      'tell me about yourself', 'introduce yourself', 'capabilities',
      'what do you know', 'how do you work', 'are you ai', 'are you a bot',
      'are you real', 'yaksha']),
    patterns: [/^(who|what)\s*(are|is)\s*(you|yaksha)/i, /^(help|about\s*you)\s*$/i,
      /what\s*can\s*you\s*do/i, /your\s*name/i, /introduce\s*yourself/i,
      /^(are\s*you\s*(ai|a\s*bot|real|human))/i],
  },
  slash_command: {
    exact: new Set([]),
    patterns: [/^\/(noc|timing|certificate|team|vibe|rosetta|work|about|attendance|phase1)/i],
  },
};

/**
 * Classify the intent of a user message.
 * Returns { intent: string, confidence: number }
 */
export function classifyIntent(message) {
  const normalized = message.toLowerCase().trim().replace(/[^\w\s#\/'-]/g, '');

  // Check exact matches first (highest confidence)
  for (const [intent, { exact }] of Object.entries(INTENT_PATTERNS)) {
    if (exact.has(normalized)) {
      return { intent, confidence: 1.0 };
    }
  }

  // Check pattern matches
  for (const [intent, { patterns }] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return { intent, confidence: 0.9 };
      }
    }
  }

  // Check for mixed intent: greeting + question
  // e.g., "hey, what is the NOC format?"
  const greetingPrefix = /^(hey|hi|hello|yo|namaste)[,!.\s]*/i;
  if (greetingPrefix.test(normalized) && normalized.length > 15) {
    return { intent: 'faq_query', confidence: 0.8, strippedQuery: normalized.replace(greetingPrefix, '').trim() };
  }

  // Default: treat as FAQ query
  return { intent: 'faq_query', confidence: 0.7 };
}

// ─── Slash Command Handler ────────────────────────────────────────────────

const SLASH_COMMANDS = {
  '/noc':         { category: 'NOC',            label: 'NOC (No Objection Certificate)' },
  '/timing':      { category: 'Timing',         label: 'Timing & Dates' },
  '/certificate': { category: 'Certificate',    label: 'Certificate & Selection' },
  '/team':        { category: 'Team Formation',  label: 'Team Formation' },
  '/vibe':        { category: 'ViBe',           label: 'ViBe Platform' },
  '/rosetta':     { category: 'Rosetta',        label: 'Rosetta Journal' },
  '/work':        { category: 'Work',           label: 'Work & Mentorship' },
  '/about':       { category: 'About',          label: 'About the Internship' },
  '/attendance':  { category: 'Attendance',     label: 'Attendance & Conduct' },
  '/phase1':      { category: 'Phase 1',        label: 'Phase 1 Coursework' },
};

export function handleSlashCommand(command) {
  const cmd = command.toLowerCase().trim().split(/\s/)[0];
  const config = SLASH_COMMANDS[cmd];
  if (!config) return null;

  const results = searchFAQs('', { topK: 5, category: config.category });
  // If search with empty query doesn't work, search with category name
  const fallbackResults = results.length > 0 ? results : searchFAQs(config.label, { topK: 5 });

  return {
    text: `Here are the top FAQs about **${config.label}**:`,
    category: config.category,
    results: fallbackResults,
  };
}

// ─── Conversation Context Memory ──────────────────────────────────────────

export class ConversationMemory {
  constructor(maxHistory = 10) {
    this.history = [];          // [{ role: 'user'|'ai', text, timestamp, intent, matchedFaq }]
    this.maxHistory = maxHistory;
    this.topicsDiscussed = new Set();     // Category set
    this.faqsShown = new Set();           // FAQ IDs already shown
    this.lastMatchedFaq = null;           // Last FAQ that was matched
    this.lastIntent = null;
    this.sessionId = Date.now().toString(36);
  }

  addUserMessage(text, intent) {
    this.history.push({ role: 'user', text, intent, timestamp: Date.now() });
    this.lastIntent = intent;
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  addAIMessage(text, matchedFaq, category) {
    this.history.push({ role: 'ai', text, matchedFaq, timestamp: Date.now() });
    if (matchedFaq) {
      this.lastMatchedFaq = matchedFaq;
      this.faqsShown.add(matchedFaq.id);
    }
    if (category) this.topicsDiscussed.add(category);
  }

  getLastUserMessage() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === 'user') return this.history[i];
    }
    return null;
  }

  getLastAIMessage() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === 'ai') return this.history[i];
    }
    return null;
  }

  getContext() {
    return {
      recentTopics: [...this.topicsDiscussed],
      shownFaqIds: [...this.faqsShown],
      lastFaq: this.lastMatchedFaq,
      messageCount: this.history.length,
      lastIntent: this.lastIntent,
    };
  }

  // Save to sessionStorage for persistence across chat open/close
  save() {
    try {
      sessionStorage.setItem('yaksha_memory', JSON.stringify({
        history: this.history.slice(-this.maxHistory),
        topicsDiscussed: [...this.topicsDiscussed],
        faqsShown: [...this.faqsShown],
        lastMatchedFaq: this.lastMatchedFaq,
        sessionId: this.sessionId,
      }));
    } catch (e) { /* sessionStorage unavailable */ }
  }

  // Restore from sessionStorage
  restore() {
    try {
      const saved = sessionStorage.getItem('yaksha_memory');
      if (!saved) return false;
      const data = JSON.parse(saved);
      this.history = data.history || [];
      this.topicsDiscussed = new Set(data.topicsDiscussed || []);
      this.faqsShown = new Set(data.faqsShown || []);
      this.lastMatchedFaq = data.lastMatchedFaq || null;
      this.sessionId = data.sessionId || this.sessionId;
      return this.history.length > 0;
    } catch (e) { return false; }
  }

  clear() {
    this.history = [];
    this.topicsDiscussed.clear();
    this.faqsShown.clear();
    this.lastMatchedFaq = null;
    this.lastIntent = null;
    try { sessionStorage.removeItem('yaksha_memory'); } catch(e) {}
  }
}

// ─── Response Generator ───────────────────────────────────────────────────
// RAG-based response synthesis: retrieves relevant chunks and synthesizes
// context-aware responses with personality.

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12)  return 'Good morning';
  if (hour < 17)  return 'Good afternoon';
  if (hour < 21)  return 'Good evening';
  return 'Hey there, night owl';
}

const GREETING_RESPONSES = [
  () => `${getTimeGreeting()}! 👋 I'm Yaksha, your Vicharanashala FAQ assistant. I have ${127} FAQs at my fingertips — ask me anything about the internship!`,
  () => `${getTimeGreeting()}! 🙏 Welcome! I'm here to help with any questions about the Vicharanashala internship — NOC, timing, certificates, ViBe, teams, you name it.`,
  () => `Namaste! 🌟 I'm Yaksha. Whether you need help with your NOC, want to know about timelines, or have questions about ViBe — I've got you covered. What would you like to know?`,
  () => `Hey! 👋 Yaksha here. I know everything about the Vicharanashala internship — from NOC procedures to team formation. How can I help you today?`,
];

const FAREWELL_RESPONSES = [
  (ctx) => `Goodbye! 👋 ${ctx.topicsDiscussed.length > 0 ? `We covered ${ctx.topicsDiscussed.join(', ')} today.` : ''} Feel free to come back anytime!`,
  (ctx) => `See you later! 🙏 ${ctx.messageCount > 4 ? 'Great conversation!' : ''} The community page is always there if you need peer help. Take care!`,
  (ctx) => `Bye! 👋 Remember, all official FAQs are at samagama.in/internship/faq. Good luck with your internship!`,
];

const GRATITUDE_RESPONSES = [
  (ctx) => `You're welcome! 😊 ${ctx.lastFaq ? `Glad the info about ${ctx.lastFaq.category} helped.` : ''} Anything else you'd like to know?`,
  (ctx) => `Happy to help! 🙌 ${ctx.topicsDiscussed.length > 1 ? `We've covered ${ctx.topicsDiscussed.join(', ')} so far.` : ''} What else can I assist with?`,
  () => `Anytime! 😊 That's what I'm here for. Got more questions? Fire away!`,
];

const AFFIRMATION_RESPONSES = [
  (ctx) => `Great! 👍 ${ctx.lastFaq ? `Would you like to know more about ${ctx.lastFaq.category}, or something else entirely?` : 'What would you like to know next?'}`,
  () => `Glad that makes sense! 😊 Feel free to ask anything else.`,
  (ctx) => `Perfect! ${ctx.topicsDiscussed.length > 0 ? `Anything else about ${[...ctx.topicsDiscussed].pop()} or a new topic?` : 'What else can I help with?'}`,
];

const NEGATION_RESPONSES = [
  (ctx) => `I'm sorry about that! 😔 Could you rephrase your question? I'll try harder to find the right answer. ${ctx.lastFaq ? `The last answer was about "${ctx.lastFaq.q}" — was that the wrong topic?` : ''}`,
  () => `Apologies! Let me try again. Could you describe what you're looking for in a different way? For example, mention the specific topic (NOC, timing, ViBe, etc.).`,
  () => `Sorry I missed the mark! 🎯 Try being more specific — for example, "What dates should I put on my NOC?" instead of just "NOC". I understand detailed questions better.`,
];

const META_RESPONSES = [
  () => `I'm Yaksha 🤖 — the Vicharanashala Internship FAQ assistant, powered by a client-side RAG (Retrieval-Augmented Generation) engine.\n\nHere's what I can do:\n🔍 Answer questions from 127 official FAQs\n💡 Understand natural language — ask in your own words\n🔗 Suggest related questions you might want to explore\n📋 Quick-jump to topics: try /noc, /timing, /team, /vibe\n🧠 Remember our conversation context\n\nI cover: NOC, Timing, Certificates, Work, ViBe, Rosetta, Teams, and more!`,
];

const ESCALATION_RESPONSE = `To reach a human:\n\n1. **Primary**: Type #escalate in the Yaksha chat on samagama.in — this reaches the programme team directly.\n2. **Email**: Write to sudarshansudarshan@gmail.com (last resort only).\n3. **Announcements**: Check the Announcements section on samagama.in regularly.\n\n⚠️ Do NOT use WhatsApp/Telegram groups — unofficial groups are strictly prohibited and will lead to immediate termination.`;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main Response Engine ─────────────────────────────────────────────────

/**
 * Generate a complete response for a user message.
 * This is the main entry point for the Yaksha brain.
 *
 * @param {string} userMessage - The user's message
 * @param {ConversationMemory} memory - Conversation context
 * @returns {object} { text, faqs, matchedFAQ, confidence, results, relatedQuestions, intent, quickActions }
 */
export async function generateResponse(userMessage, memory) {
  const { intent, confidence: intentConf, strippedQuery } = classifyIntent(userMessage);
  const ctx = memory.getContext();

  // Record user message
  memory.addUserMessage(userMessage, intent);

  // ── Handle non-FAQ intents ──
  if (intent !== 'faq_query' && intent !== 'slash_command') {
    const response = handleConversationalIntent(intent, ctx, memory);
    memory.addAIMessage(response.text, null, null);
    memory.save();
    return { ...response, intent };
  }

  // ── Handle slash commands ──
  if (intent === 'slash_command') {
    const cmdResult = handleSlashCommand(userMessage);
    if (cmdResult) {
      const faqList = cmdResult.results.map(r => r.faq);
      const relatedQuestions = faqList.slice(0, 4).map(f => ({
        id: f.id, text: f.q, category: f.category,
      }));
      memory.addAIMessage(cmdResult.text, faqList[0], cmdResult.category);
      memory.save();
      return {
        text: cmdResult.text,
        faqs: faqList,
        matchedFAQ: faqList[0],
        confidence: { level: 'high', label: 'Category browse', color: '#00d4ff' },
        results: cmdResult.results,
        relatedQuestions,
        intent,
      };
    }
  }

  // ── Handle clarification (expand on last FAQ) ──
  if (intent === 'clarification' && ctx.lastFaq) {
    return handleClarification(ctx, memory);
  }

  // ── FAQ Query: Use AI Semantic Search or fallback to NLP ──
  const query = strippedQuery || userMessage;
  return await handleFAQQuery(query, memory, ctx);
}

// ─── Intent Handlers ──────────────────────────────────────────────────────

function handleConversationalIntent(intent, ctx, memory) {
  let text = '';
  let quickActions = null;

  switch (intent) {
    case 'greeting':
      text = pickRandom(GREETING_RESPONSES)(ctx);
      quickActions = [
        { label: '📋 NOC Help', query: '/noc' },
        { label: '⏰ Timing', query: '/timing' },
        { label: '🎓 Certificate', query: '/certificate' },
        { label: '👥 Teams', query: '/team' },
        { label: '📺 ViBe', query: '/vibe' },
        { label: '📓 Rosetta', query: '/rosetta' },
      ];
      break;
    case 'farewell':
      text = pickRandom(FAREWELL_RESPONSES)(ctx);
      break;
    case 'gratitude':
      text = pickRandom(GRATITUDE_RESPONSES)(ctx);
      break;
    case 'affirmation':
      text = pickRandom(AFFIRMATION_RESPONSES)(ctx);
      break;
    case 'negation':
      text = pickRandom(NEGATION_RESPONSES)(ctx);
      break;
    case 'meta':
      text = pickRandom(META_RESPONSES)(ctx);
      break;
    case 'escalation':
      text = ESCALATION_RESPONSE;
      break;
    default:
      text = "I'm not sure how to respond to that. Could you ask a question about the Vicharanashala internship?";
  }

  return {
    text,
    faqs: [],
    matchedFAQ: null,
    confidence: null,
    results: [],
    relatedQuestions: [],
    quickActions,
  };
}

function handleClarification(ctx, memory) {
  const lastFaq = ctx.lastFaq;
  const answer = lastFaq.a || lastFaq.description || lastFaq.content || '';

  // Get related FAQs for follow-up
  const related = getRelatedFAQs(lastFaq.id, 4);
  const relatedQuestions = related
    .filter(r => !ctx.shownFaqIds.includes(r.faq.id))
    .slice(0, 4)
    .map(r => ({ id: r.faq.id, text: r.faq.q, category: r.faq.category }));

  const text = `Here's the full answer about "${lastFaq.q}":\n\n${answer}\n\n${
    relatedQuestions.length > 0
      ? 'You might also want to check out the related questions below. 👇'
      : 'That\'s all I have on this topic. Try asking about something else!'
  }`;

  memory.addAIMessage(text, lastFaq, lastFaq.category);
  memory.save();

  return {
    text,
    faqs: [lastFaq],
    matchedFAQ: lastFaq,
    confidence: { level: 'high', label: 'Expanded answer', color: '#00ff88' },
    results: [],
    relatedQuestions,
    intent: 'clarification',
  };
}

async function handleFAQQuery(query, memory, ctx) {
  // RAG Stage 1: Retrieve relevant chunks/FAQs using true semantic AI
  let results = [];
  try {
    results = await searchAIFaqs(query, 5);
    // If AI cache is empty (model still loading), fallback to NLP
    if (results.length === 0) {
      results = searchFAQs(query, { topK: 5 });
    }
  } catch (err) {
    console.error("AI engine error, falling back to keyword NLP", err);
    results = searchFAQs(query, { topK: 5 });
  }

  // Track search analytics
  try {
    trackSearchQuery(query, results?.length || 0, results?.[0]?.faq?.id || null);
  } catch { /* ignore tracking errors */ }
  if (!results || results.length === 0) {
    // No results — check for typo suggestions
    const suggestions = getSuggestions(query);
    let text = `I couldn't find a strong match for "${query}".`;

    if (suggestions.length > 0) {
      text += ` Did you mean "${suggestions[0].suggested}"?`;
    }

    text += '\n\nTry rephrasing your question, or ask on the Community page where peers and mentors can help.';

    // Suggest related topics based on conversation history
    const quickActions = ctx.topicsDiscussed.length > 0
      ? [...ctx.topicsDiscussed].map(t => ({ label: `🔄 More on ${t}`, query: t }))
      : [
          { label: '📋 NOC Help', query: '/noc' },
          { label: '⏰ Timing', query: '/timing' },
          { label: '🎓 Certificate', query: '/certificate' },
        ];

    memory.addAIMessage(text, null, null);
    memory.save();

    return {
      text,
      faqs: [],
      matchedFAQ: null,
      confidence: null,
      results: [],
      relatedQuestions: [],
      redirect: '/community',
      intent: 'faq_query',
      suggestions,
      quickActions,
    };
  }

  // RAG Stage 2: Synthesize response from top result
  const primary = results[0];
  const primaryFAQ = primary.faq;
  let text = primaryFAQ.a || primaryFAQ.description || primaryFAQ.content || '';

  // Confidence-based response framing
  if (primary.confidence.level === 'low' || primary.confidence.level === 'weak') {
    text = `I found something that might be related:\n\n${text}`;
  }

  // RAG Stage 3: Augment with secondary results
  const additionalMatches = results.slice(1).filter(r =>
    r.confidence.level === 'high' || r.confidence.level === 'medium'
  );

  if (additionalMatches.length > 0) {
    const sec = additionalMatches[0];
    const secText = sec.faq.a || sec.faq.description || sec.faq.content || '';
    const preview = secText.length > 120 ? secText.slice(0, 117) + '…' : secText;
    text += `\n\nAlso relevant: "${sec.faq.q || sec.faq.title}" — ${preview}`;
  }

  // RAG Stage 4: Generate related questions (deduped against already shown)
  let relatedQuestions = [];

  // Get content-similar FAQs
  const contentRelated = getRelatedFAQs(primaryFAQ.id, 6);

  // Also get FAQs from the same section
  const sectionRelated = results
    .slice(1, 4)
    .map(r => ({ faq: r.faq, score: r.score }));

  // Merge and deduplicate
  const allRelated = [...contentRelated, ...sectionRelated];
  const seenIds = new Set([primaryFAQ.id, ...ctx.shownFaqIds]);

  for (const r of allRelated) {
    if (seenIds.has(r.faq.id)) continue;
    seenIds.add(r.faq.id);
    relatedQuestions.push({
      id: r.faq.id,
      text: r.faq.q || r.faq.title,
      category: r.faq.category,
    });
    if (relatedQuestions.length >= 4) break;
  }

  // Update memory
  memory.addAIMessage(text, primaryFAQ, primaryFAQ.category);
  memory.save();

  return {
    text,
    faqs: results.map(r => r.faq),
    matchedFAQ: primaryFAQ,
    confidence: primary.confidence,
    results,
    relatedQuestions,
    intent: 'faq_query',
  };
}
