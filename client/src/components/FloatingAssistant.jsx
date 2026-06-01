import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, X, Send, ExternalLink, ChevronRight, ChevronDown, ChevronUp,
  Zap, Sparkles, Brain, Target, Copy, Check, ArrowRight, Search,
  MessageSquare, RotateCcw, Hash, Lightbulb,
} from 'lucide-react';
import { officialFAQs } from '../data/faqs.js';
import { buildFAQIndex, searchFAQs } from '../utils/nlp-search.js';
import { generateResponse, ConversationMemory, classifyIntent } from '../utils/yaksha-brain.js';
import { initAIEngine } from '../utils/ai-engine.js';

const API = 'http://localhost:3001/api';

// ─── Confidence Badge ─────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: `${confidence.color}15`,
        color: confidence.color,
        border: `1px solid ${confidence.color}30`,
      }}
    >
      <Target size={7} />
      {confidence.label}
    </span>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: do nothing */ }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-gray-600 hover:text-gray-300 transition-colors cursor-pointer p-0.5"
      title="Copy answer"
    >
      {copied ? <Check size={10} className="text-accent" /> : <Copy size={10} />}
    </button>
  );
}

// ─── Typing Animation ────────────────────────────────────────────────────

function TypewriterText({ text, speed = 8, onComplete }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    let i = 0;
    setDisplayed('');
    setDone(false);

    const interval = setInterval(() => {
      i++;
      // Type in chunks of 2-4 chars for faster rendering
      const chunk = Math.min(i * 3, text.length);
      setDisplayed(text.slice(0, chunk));
      if (chunk >= text.length) {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <>
      {renderMessageText(displayed)}
      {!done && <span className="inline-block w-1.5 h-3 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />}
    </>
  );
}

// ─── Message Text Renderer ────────────────────────────────────────────────

function renderMessageText(text) {
  if (!text) return null;
  return text.split('\n').map((line, li) => {
    if (line.startsWith('Also relevant:')) {
      const rest = line.replace(/^Also\s*relevant:\s*/, '');
      return (
        <p key={li} className="mt-2 pt-2 border-t border-white/[0.07] text-gray-400 text-[11px]">
          💡 {rest}
        </p>
      );
    }
    if (line.startsWith('Did you mean')) {
      return (
        <p key={li} className="mt-1 text-secondary text-[11px] italic">
          🔍 {line}
        </p>
      );
    }
    if (line.startsWith('I found something that might')) {
      return (
        <p key={li} className="text-gray-400 text-[11px] italic mb-2">
          ⚠️ {line}
        </p>
      );
    }
    // Bold text with ** — parsed into React elements, no raw HTML
    const boldMatch = line.match(/\*\*(.+?)\*\*/);
    if (boldMatch) {
      const before = line.slice(0, boldMatch.index);
      const bold   = boldMatch[1];
      const after  = line.slice(boldMatch.index + boldMatch[0].length);
      return (
        <p key={li} className={li > 0 ? 'mt-2' : ''}>
          {before && <span>{before}</span>}
          <b className="font-semibold text-gray-100">{bold}</b>
          {after  && renderMessageText(after)}
        </p>
      );
    }
    // Numbered lists
    if (/^\d+[\.\)]\s/.test(line.trim())) {
      return (
        <p key={li} className={`${li > 0 ? 'mt-1' : ''} pl-2 text-gray-300`}>
          {line.trim()}
        </p>
      );
    }
    return line.trim() ? <p key={li} className={li > 0 ? 'mt-2' : ''}>{line}</p> : null;
  });
}

// ─── Related Questions Component ──────────────────────────────────────────

function RelatedQuestions({ questions, onQuestionClick }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-2.5">
      <p className="text-[9px] text-gray-600 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <Lightbulb size={8} />
        Related questions
      </p>
      <div className="flex flex-col gap-1">
        {questions.map((q) => (
          <button
            key={q.id}
            onClick={() => onQuestionClick(q.text)}
            className="text-left text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-gray-400 hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer flex items-center gap-2 group"
          >
            <ArrowRight size={8} className="text-gray-600 group-hover:text-primary transition-colors flex-shrink-0" />
            <span className="flex-1 truncate">{q.text}</span>
            <span className="text-[8px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded-full flex-shrink-0">
              {q.category}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Quick Action Chips ───────────────────────────────────────────────────

function QuickActions({ actions, onActionClick }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => onActionClick(action.query)}
          className="text-[10px] px-2.5 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-primary/80 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all cursor-pointer"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ─── Preset Quick Questions ───────────────────────────────────────────────

const PRESETS = [
  { q: 'How do I get my NOC signed?',                icon: '📋' },
  { q: 'What if I miss a Zoom session?',             icon: '📹' },
  { q: 'When will I get my certificate?',            icon: '🎓' },
  { q: 'Can I start later if I have exams?',         icon: '📅' },
  { q: 'Who is my mentor?',                          icon: '👨‍🏫' },
  { q: 'Is there a stipend?',                        icon: '💰' },
  { q: 'What is Rosetta?',                           icon: '📓' },
  { q: 'How do I log into ViBe?',                    icon: '🔗' },
  { q: 'What is the team size?',                     icon: '👥' },
  { q: 'Can I use WhatsApp groups?',                 icon: '📱' },
];

// ─── Main Component ───────────────────────────────────────────────────────

export default function FloatingAssistant() {
  const [open, setOpen]                     = useState(false);
  const [messages, setMessages]             = useState([]);
  const [input, setInput]                   = useState('');
  const [visible, setVisible]               = useState(true);
  const [communityFAQs, setCommunityFAQs]   = useState([]);
  const [presetExpanded, setPresetExpanded]  = useState(false);
  const [thinking, setThinking]             = useState(false);
  const [indexReady, setIndexReady]          = useState(false);
  const [typingId, setTypingId]             = useState(null);
  const messagesEndRef                      = useRef(null);
  const memoryRef                           = useRef(new ConversationMemory());

  // Fetch community FAQs
  useEffect(() => {
    if (!open) return;
    fetch(`${API}/community/faqs`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.faqs) setCommunityFAQs(data.faqs); })
      .catch(() => {});
  }, [open]);

  // Build NLP index
  const allFAQs = useMemo(() => [
    ...officialFAQs.map(f => ({ ...f, source: 'official' })),
    ...communityFAQs.map(f => ({ ...f, source: 'community' })),
  ], [communityFAQs]);

  useEffect(() => {
    if (allFAQs.length > 0) {
      buildFAQIndex(allFAQs);
      // Initialize Semantic AI model in the background
      initAIEngine(allFAQs, (progress) => {
        // Optional: can show progress in UI if needed, for now just load
      }).catch(console.error);
      setIndexReady(true);
    }
  }, [allFAQs]);

  // Initialize: restore session or show welcome
  useEffect(() => {
    const memory = memoryRef.current;
    const hasSession = memory.restore();

    if (hasSession) {
      // Rebuild messages from memory
      const restored = memory.history.map((h, i) => ({
        id: `restored-${i}`,
        from: h.role === 'user' ? 'user' : 'ai',
        text: h.text,
        matchedFAQ: h.matchedFaq || null,
        isRestored: true,
      }));
      setMessages(restored);
    } else {
      setMessages([{
        id: 'welcome',
        from: 'ai',
        text: "Namaste! 🙏 I'm Yaksha — powered by a RAG engine that understands your questions naturally. I have 127 official FAQs and I learn from every community question.\n\nAsk me anything, or try a quick command like /noc, /timing, /team!",
        isWelcome: true,
        quickActions: [
          { label: '📋 NOC Help', query: '/noc' },
          { label: '⏰ Timing', query: '/timing' },
          { label: '🎓 Certificate', query: '/certificate' },
          { label: '👥 Teams', query: '/team' },
          { label: '📺 ViBe', query: '/vibe' },
          { label: '📓 Rosetta', query: '/rosetta' },
        ],
      }]);
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // ── Send Message Handler ──
  const handleSend = useCallback((text) => {
    const userText = (text || input).trim();
    if (!userText || !indexReady) return;

    const msgId = Date.now().toString(36);

    setMessages(m => [...m, { id: `user-${msgId}`, from: 'user', text: userText }]);
    setInput('');
    setThinking(true);

    // Simulate thinking delay (shorter for conversational intents)
    const { intent } = classifyIntent(userText);
    const delay = intent === 'faq_query' ? 600 + Math.random() * 500 : 300 + Math.random() * 300;

    setTimeout(async () => {
      const response = await generateResponse(userText, memoryRef.current);
      const aiMsgId = `ai-${msgId}`;

      setThinking(false);
      setTypingId(aiMsgId); // Enable typewriter effect

      setMessages(m => [
        ...m,
        {
          id: aiMsgId,
          from: 'ai',
          text: response.text,
          faqs: response.faqs,
          matchedFAQ: response.matchedFAQ || null,
          confidence: response.confidence,
          redirect: response.redirect,
          results: response.results,
          relatedQuestions: response.relatedQuestions,
          quickActions: response.quickActions,
          intent: response.intent,
          suggestions: response.suggestions,
        },
      ]);
    }, delay);
  }, [input, indexReady]);

  // ── Clear Chat ──
  const handleClear = () => {
    memoryRef.current.clear();
    setMessages([{
      id: 'welcome-new',
      from: 'ai',
      text: "Chat cleared! 🔄 I'm ready for new questions. What would you like to know?",
      quickActions: [
        { label: '📋 NOC', query: '/noc' },
        { label: '⏰ Timing', query: '/timing' },
        { label: '🎓 Certificate', query: '/certificate' },
        { label: '👥 Teams', query: '/team' },
      ],
    }]);
  };

  const displayedPresets = presetExpanded ? PRESETS : PRESETS.slice(0, 5);

  // ── Render ──
  return (
    <AnimatePresence>
      {!visible ? (
        <motion.button
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={() => { setVisible(true); setOpen(false); }}
          className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:shadow-[0_0_40px_rgba(0,212,255,0.45)] transition-all duration-300 cursor-pointer"
        >
          <Bot size={24} className="text-black" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-deep animate-pulse" />
        </motion.button>
      ) : !open ? (
        <motion.button
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:shadow-[0_0_40px_rgba(0,212,255,0.45)] transition-all duration-300 cursor-pointer"
        >
          <Bot size={24} className="text-black" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-deep animate-pulse" />
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-6 right-6 z-[60] w-[22rem] sm:w-[26rem] bg-elevated border border-white/[0.1] rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden max-h-[40rem]"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-surface/90 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Bot size={16} className="text-black" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full border-2 border-elevated animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  Yaksha
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/20">
                    <Brain size={7} />
                    RAG
                  </span>
                </p>
                <p className="text-[10px] text-gray-500">
                  {allFAQs.length} FAQs · BM25 + NLP
                  {indexReady && ' · Ready'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClear} className="text-gray-600 hover:text-gray-300 p-1 transition-colors cursor-pointer" title="Clear chat">
                <RotateCcw size={13} />
              </button>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white p-1 transition-colors cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 no-scrollbar">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={m.isRestored ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[88%]">
                  {/* AI header */}
                  {m.from === 'ai' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <Bot size={9} className="text-black" />
                      </div>
                      <span className="text-[10px] text-gray-600 font-medium">Yaksha</span>
                      {m.confidence && <ConfidenceBadge confidence={m.confidence} />}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    m.from === 'user'
                      ? 'bg-primary text-black font-semibold rounded-br-md'
                      : 'bg-white/[0.06] text-gray-200 border border-white/[0.07] rounded-bl-md'
                  }`}>
                    {m.from === 'ai' && typingId === m.id && !m.isRestored
                      ? <TypewriterText text={m.text} speed={8} onComplete={() => setTypingId(null)} />
                      : renderMessageText(m.text)
                    }
                  </div>

                  {/* Copy button for AI messages */}
                  {m.from === 'ai' && m.text && !m.isWelcome && (
                    <div className="flex items-center gap-2 mt-1">
                      <CopyButton text={m.text} />
                      {m.matchedFAQ && (
                        <a
                          href={`/faq/${m.matchedFAQ.id}`}
                          className="text-[9px] text-gray-600 hover:text-primary transition-colors flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={8} />
                          View full FAQ
                        </a>
                      )}
                    </div>
                  )}

                  {/* Source badge */}
                  {m.from === 'ai' && m.matchedFAQ && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-primary/[0.06] border border-primary/12 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-0.5">
                          {m.matchedFAQ.source === 'community' ? '🌐 Community' : '✅ Official FAQ'}
                          {m.matchedFAQ.section && ` · ${m.matchedFAQ.section}`}
                        </p>
                        <p className="text-[11px] text-gray-300 leading-snug group-hover:text-primary transition-colors">
                          {m.matchedFAQ.q || m.matchedFAQ.title}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Additional results */}
                  {m.from === 'ai' && m.results && m.results.length > 1 && (
                    <div className="mt-1.5 space-y-1">
                      {m.results.slice(1, 3).map((r, ri) => (
                        <div key={ri} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] group">
                          <Sparkles size={8} className="text-gray-600 flex-shrink-0" />
                          <p className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors truncate flex-1">
                            {r.faq.q || r.faq.title}
                          </p>
                          <ConfidenceBadge confidence={r.confidence} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Related questions (clickable) */}
                  {m.from === 'ai' && (
                    <RelatedQuestions
                      questions={m.relatedQuestions}
                      onQuestionClick={(q) => handleSend(q)}
                    />
                  )}

                  {/* Quick action chips */}
                  {m.from === 'ai' && (
                    <QuickActions
                      actions={m.quickActions}
                      onActionClick={(q) => handleSend(q)}
                    />
                  )}

                  {/* Redirect */}
                  {m.from === 'ai' && m.redirect && (
                    <a
                      href={m.redirect}
                      className="mt-2 flex items-center gap-1.5 text-[10px] text-primary/70 hover:text-primary transition-colors"
                    >
                      <ExternalLink size={10} />
                      Ask on Community page →
                    </a>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Thinking indicator */}
            {thinking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-gray-500">Searching with RAG…</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Presets ── */}
          <div className="px-3 pb-2 flex-shrink-0 border-t border-white/[0.04] pt-2">
            <div className="flex flex-wrap gap-1.5">
              {displayedPresets.map(p => (
                <button
                  key={p.q}
                  onClick={() => handleSend(p.q)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-gray-500 hover:text-gray-200 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="flex-shrink-0">{p.icon}</span>
                  <span className="truncate max-w-[11rem]">{p.q.length > 32 ? p.q.slice(0, 30) + '…' : p.q}</span>
                </button>
              ))}
              {PRESETS.length > 5 && (
                <button
                  onClick={() => setPresetExpanded(e => !e)}
                  className="text-[10px] px-2 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer flex items-center gap-1"
                >
                  {presetExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  {presetExpanded ? 'Less' : `+${PRESETS.length - 5} more`}
                </button>
              )}
            </div>
          </div>

          {/* ── Input ── */}
          <div className="px-3 pb-3 pt-1 flex gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything or try /noc, /team…"
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-full px-4 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-primary/30 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!indexReady}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:brightness-110 transition-all cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={13} className="text-black" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}