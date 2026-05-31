import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X, Bot, Zap, Sparkles, ArrowRight, User, LogOut } from 'lucide-react';
import { officialFAQs } from '../data/faqs.js';
import { buildFAQIndex, searchFAQs } from '../utils/nlp-search.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';

const navLinks = [
  { to: '/',           label: 'Home' },
  { to: '/community',  label: 'Community' },
  { to: '/insights',   label: 'Crowd Insights' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const { user, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Build index once (HomePage also builds it, but in case user lands on another page)
  useEffect(() => {
    buildFAQIndex(officialFAQs.map(f => ({ ...f, source: 'official' })));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced NLP search for live suggestions
  const handleSearchInput = (val) => {
    setSearchVal(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const results = searchFAQs(val.trim(), { topK: 5 });
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 200);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      setShowSuggestions(false);
      navigate(`/?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const handleSuggestionClick = (faq) => {
    setShowSuggestions(false);
    setSearchVal('');
    navigate(`/faq/${faq.id}`);
  };

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-deep/90 backdrop-blur-xl border-b border-white/[0.06]' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="16" cy="16" r="9" stroke="#00d4ff" strokeWidth="1.5" opacity="0.3"/>
              <circle cx="16" cy="16" r="4" fill="#00d4ff"/>
              <line x1="16" y1="1" x2="16" y2="7" stroke="#00d4ff" strokeWidth="1.5" opacity="0.8"/>
              <line x1="16" y1="25" x2="16" y2="31" stroke="#00d4ff" strokeWidth="1.5" opacity="0.8"/>
              <line x1="1" y1="16" x2="7" y2="16" stroke="#00d4ff" strokeWidth="1.5" opacity="0.8"/>
              <line x1="25" y1="16" x2="31" y2="16" stroke="#00d4ff" strokeWidth="1.5" opacity="0.8"/>
            </svg>
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md -z-10" />
          </div>
          <span className="font-outfit font-bold text-lg text-white hidden sm:block">
            CrowdSource<span className="text-primary">FAQs</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                location.pathname === link.to
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.04]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search with live NLP suggestions */}
        <div ref={searchRef} className="hidden lg:block flex-1 max-w-sm relative">
          <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-full px-4 py-2 focus-within:border-primary/20 focus-within:bg-white/[0.05] transition-all">
            <Search size={14} className="text-gray-500 flex-shrink-0" />
            <input
              value={searchVal}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search FAQs with NLP…"
              className="bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full"
            />
            {searchVal && (
              <button
                type="button"
                onClick={() => { setSearchVal(''); setSuggestions([]); setShowSuggestions(false); }}
                className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </form>

          {/* Live suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 left-0 right-0 bg-elevated border border-white/[0.1] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[100]"
              >
                <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={9} className="text-secondary" />
                    NLP Results
                  </span>
                  <span className="text-[9px] text-gray-600">{suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}</span>
                </div>
                {suggestions.map((result, i) => (
                  <button
                    key={result.faq.id}
                    onClick={() => handleSuggestionClick(result.faq)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer flex items-start gap-3 group border-t border-white/[0.04]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 group-hover:text-primary transition-colors leading-snug truncate">
                        {result.faq.q || result.faq.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-full font-semibold">
                          {result.faq.category}
                        </span>
                        <span
                          className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${result.confidence.color}12`,
                            color: result.confidence.color,
                          }}
                        >
                          {result.confidence.label}
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={10} className="text-gray-600 group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
                  </button>
                ))}
                <button
                  onClick={handleSearch}
                  className="w-full text-center py-2 text-[10px] text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors border-t border-white/[0.06] cursor-pointer"
                >
                  Search all results →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4 ml-auto">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-white">{user.name}</span>
                <span className="text-[10px] text-primary">{user.role} • {user.reputation} SP</span>
              </div>
              <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/[0.03] hover:bg-white/[0.06] rounded-full">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1]">
              <User size={14} />
              Sign In
            </button>
          )}
          <Link to="/community" className="btn-primary text-sm">
            <Zap size={14} />
            Ask Community
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto md:hidden p-2 text-gray-400 hover:text-white">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-surface border-t border-white/[0.06] overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
                    location.pathname === link.to ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-white/[0.04]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 mt-2">
                <Search size={14} className="text-gray-500" />
                <input
                  value={searchVal}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder="Search FAQs…"
                  className="bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full"
                />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </nav>
  );
}