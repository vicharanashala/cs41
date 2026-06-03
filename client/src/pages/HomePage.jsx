import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, TrendingUp, Users, Zap, ChevronDown, Sparkles, FileText, Send } from 'lucide-react';
import { officialFAQs, sections, categories, communityQuestions } from '../data/faqs.js';
import { buildFAQIndex, searchFAQs, getSuggestions } from '../utils/nlp-search.js';
import NocGenerator from '../components/NocGenerator.jsx';
import { LeaderboardWidget } from '../components/Leaderboard.jsx';

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchVal, setSearchVal] = useState(searchParams.get('q') || '');
  const [activeSection, setActiveSection] = useState('All');
  const [showPopup, setShowPopup] = useState(null); // 'ask' | 'insights' | null
  const navigate = useNavigate();
  const [showNoc, setShowNoc] = useState(false);

  // Build NLP index on mount
  useEffect(() => {
    buildFAQIndex(officialFAQs.map(f => ({ ...f, source: 'official' })));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) setSearchParams({ q: searchVal.trim() });
  };

  // NLP-powered search with fallback to category filter
  const queryStr = searchParams.get('q') || '';
  const nlpResults = useMemo(() => {
    if (!queryStr.trim()) return null;
    return searchFAQs(queryStr, { topK: 127, category: activeSection });
  }, [queryStr, activeSection]);

  const suggestions = useMemo(() => {
    if (!queryStr.trim()) return [];
    return getSuggestions(queryStr);
  }, [queryStr]);

  const filtered = useMemo(() => {
    // If there's a search query, use NLP results
    if (nlpResults) {
      return nlpResults.map(r => ({ ...r.faq, _nlpScore: r.score, _confidence: r.confidence }));
    }
    // Otherwise just filter by category
    return officialFAQs.filter(faq => {
      return activeSection === 'All' || faq.category === activeSection;
    });
  }, [nlpResults, activeSection]);

  const trendingFAQs = [...officialFAQs].sort((a, b) => b.votes - a.votes).slice(0, 5);
  const recentActivity = communityQuestions.slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-12 px-4">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-primary/8 rounded-full blur-[80px]" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Vicharanashala Internship · IIT Ropar · 2026 Cycle
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-outfit text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight"
          >
            Your internship
            <br />
            <span className="text-glow">questions answered.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-gray-400 text-base sm:text-lg mb-8 max-w-xl mx-auto"
          >
            Official FAQs from Vicharanashala, real community questions, and crowd-sourced insights — all in one place.
          </motion.p>

          {/* Search */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onSubmit={handleSearch}
            className="flex items-center gap-3 max-w-xl mx-auto"
          >
            <div className="flex-1 flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-full px-5 py-3.5 focus-within:border-primary/30 focus-within:bg-white/[0.06] transition-all">
              <Search size={16} className="text-gray-500 flex-shrink-0" />
              <input
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="Search FAQs, NOC, attendance, certificates…"
                className="bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none w-full"
              />
            </div>
            <button type="submit" className="btn-primary px-6 py-3">
              Search
            </button>
          </motion.form>

          {/* Animated Popup Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4 mt-8"
          >
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/submit')}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-accent/20 hover:bg-accent/5 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Send size={16} className="text-black" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-100">Submit FAQ</p>
                <p className="text-[11px] text-gray-500">Add to review queue</p>
              </div>
              <ArrowRight size={14} className="text-gray-600 group-hover:text-accent transition-colors ml-1" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowPopup('ask')}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Zap size={16} className="text-black" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-100">Ask Community</p>
                <p className="text-[11px] text-gray-500">Get peer & AI answers</p>
              </div>
              <ArrowRight size={14} className="text-gray-600 group-hover:text-primary transition-colors ml-1" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowPopup('insights')}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-secondary/20 hover:bg-secondary/5 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-100">Crowd Insights</p>
                <p className="text-[11px] text-gray-500">Analytics & trends</p>
              </div>
              <ArrowRight size={14} className="text-gray-600 group-hover:text-secondary transition-colors ml-1" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Popup Overlays */}
      {showPopup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowPopup(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="relative glass rounded-2xl p-8 max-w-sm w-full text-center"
          >
            {showPopup === 'ask' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                  <Zap size={24} className="text-black" />
                </div>
                <h3 className="font-outfit text-xl font-bold mb-2">Ask the Community</h3>
                <p className="text-gray-400 text-sm mb-6">Post your question anonymously and get answers from peers and AI.</p>
                <Link to="/community" onClick={() => setShowPopup(null)} className="btn-primary w-full justify-center">
                  Go to Community
                </Link>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={24} className="text-white" />
                </div>
                <h3 className="font-outfit text-xl font-bold mb-2">Crowd Insights</h3>
                <p className="text-gray-400 text-sm mb-6">Explore trending topics, analytics, heatmaps, and AI-generated summaries.</p>
                <Link to="/insights" onClick={() => setShowPopup(null)} className="btn-primary w-full justify-center">
                  View Dashboard
                </Link>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Two column layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main: FAQ sections */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Section filter */}
            <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveSection(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                    activeSection === cat
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </motion.div>

            {/* FAQ list */}
            <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3">
              {/* NLP Search feedback */}
              {queryStr && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-secondary" />
                    <span className="text-xs text-gray-400">
                      {filtered.length} result{filtered.length !== 1 ? 's' : ''} for <span className="text-gray-200 font-semibold">"{queryStr}"</span>
                    </span>
                  </div>
                  {queryStr && (
                    <button
                      onClick={() => { setSearchParams({}); setSearchVal(''); }}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}

              {/* Did you mean? suggestions */}
              {suggestions.length > 0 && filtered.length < 3 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/5 border border-secondary/15">
                  <span className="text-[11px] text-gray-400">🔍 Did you mean:</span>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchVal(s.suggested);
                        setSearchParams({ q: s.suggested });
                      }}
                      className="text-[11px] text-secondary hover:text-secondary/80 font-semibold cursor-pointer underline underline-offset-2"
                    >
                      {s.suggested}
                    </button>
                  ))}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-lg mb-2">No FAQs found</p>
                  <p className="text-sm">Try rephrasing your question or use different keywords</p>
                  {suggestions.length > 0 && (
                    <p className="text-sm mt-2 text-secondary">
                      Did you mean "{suggestions[0].suggested}"?
                    </p>
                  )}
                </div>
              )}
              {filtered.map(faq => (
                <motion.div key={faq.id} variants={fadeUp}>
                  <Link to={`/faq/${faq.id}`} className="glass rounded-xl p-5 block hover:bg-white/[0.065] transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 bg-primary/8 px-2 py-0.5 rounded-full">
                            {faq.category}
                          </span>
                          {faq.isOfficial && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent/80 bg-accent/8 px-2 py-0.5 rounded-full">
                              ✓ Official
                            </span>
                          )}
                          {faq._confidence && (
                            <span
                              className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                              style={{
                                backgroundColor: `${faq._confidence.color}12`,
                                color: faq._confidence.color,
                                border: `1px solid ${faq._confidence.color}25`,
                              }}
                            >
                              <Sparkles size={7} />
                              {faq._confidence.label}
                            </span>
                          )}
                        </div>
                        <h3 className="font-outfit font-semibold text-gray-100 group-hover:text-primary transition-colors mb-1.5 leading-snug">
                          {faq.q}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                          {faq.a.replace(/\n[A-Z].*/g, '').slice(0, 140)}…
                        </p>
                      </div>
                      {!faq.isOfficial && (
                        <div className="flex flex-col items-center gap-1 text-center flex-shrink-0">
                          <span className="text-sm font-bold text-gray-300">{faq.votes.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-600">votes</span>
                          <span className="text-sm font-bold text-gray-400 mt-1">{faq.views.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-600">views</span>
                        </div>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* NOC Generator Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass rounded-xl p-5 bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-outfit font-bold text-sm text-gray-200">NOC Generator</h3>
                  <p className="text-[10px] text-gray-500">Auto-generate your certificate</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                Generate a printable No Objection Certificate for the Vicharanashala internship — fill in your details & print.
              </p>
              <button
                onClick={() => setShowNoc(true)}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2"
              >
                <FileText size={13} />
                Generate NOC →
              </button>
            </motion.div>

            {/* Leaderboard */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <LeaderboardWidget />
            </motion.div>

            {/* Trending */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5">
              <h3 className="font-outfit font-bold text-sm text-gray-200 mb-4 flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                Trending FAQs
              </h3>
              <div className="flex flex-col gap-3">
                {trendingFAQs.map((f, i) => (
                  <Link key={f.id} to={`/faq/${f.id}`} className="flex items-start gap-3 group">
                    <span className="text-xs font-bold text-gray-600 w-4 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-gray-400 group-hover:text-gray-200 leading-relaxed transition-colors line-clamp-2">{f.q}</p>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Community activity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-5">
              <h3 className="font-outfit font-bold text-sm text-gray-200 mb-4 flex items-center gap-2">
                <Users size={15} className="text-secondary" />
                Community Activity
              </h3>
              <div className="flex flex-col gap-3">
                {recentActivity.map(cq => (
                  <div key={cq.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-secondary">?</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{cq.title}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{cq.votes} votes · {cq.answers} answers</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/community" className="mt-4 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline">
                View all community questions <ArrowRight size={12} />
              </Link>
            </motion.div>

            {/* Stats row */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-3">
              {[['1,247', 'Total FAQs'], ['3,891', 'Answers'], ['87%', 'Answered'], ['342', 'Active Users']].map(([n, l]) => (
                <div key={l} className="glass rounded-xl p-4 text-center">
                  <p className="font-outfit font-extrabold text-lg text-glow">{n}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{l}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* NOC Generator Modal */}
      <AnimatePresence>
        {showNoc && <NocGenerator open={showNoc} onClose={() => setShowNoc(false)} />}
      </AnimatePresence>
    </div>
  );
}