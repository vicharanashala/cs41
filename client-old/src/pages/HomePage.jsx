import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, isAuthenticated } from '../utils/api.js';
import QuestionCard from '../components/QuestionCard.jsx';
import CategoryPill from '../components/CategoryPill.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './HomePage.module.css';

const SORTS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'votes',      label: 'Top Voted' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'trending',   label: 'Trending' },
];

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const sort     = searchParams.get('sort')     || 'newest';
  const search   = searchParams.get('search')   || '';

  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const addToast = useToast();

  const loadData = async (params = {}) => {
    try {
      const [qRes, catRes, statsRes] = await Promise.all([
        api.getQuestions({ ...params, page }),
        api.getCategories(),
        api.getStats(),
      ]);
      setQuestions(qRes.questions);
      setCategories(catRes.categories);
      setStats(statsRes);
      setTotalPages(qRes.totalPages);
    } catch (err) {
      addToast('Failed to load questions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const params = {};
    if (category) params.category = category;
    if (sort)     params.sort = sort;
    if (search)   params.search = search;
    loadData(params);
  }, [category, sort, search]);

  const handleVote = async (questionId, direction) => {
    if (!isAuthenticated()) { addToast('Sign in to vote', 'info'); return; }
    try {
      await api.voteQuestion(questionId, direction);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const setParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    setSearchParams(next);
  };

  return (
    <main className="page">
      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroGlow} />
          <h1 className={`${styles.heroTitle} animate-in`}>
            The collective brain for<br />
            <span className="glow-text">internship wisdom</span>
          </h1>
          <p className={`${styles.heroSub} animate-in`}>
            Real questions. Real answers. From students who've been there.
          </p>

          {/* Search bar */}
          <form onSubmit={e => { e.preventDefault(); const s = e.target.search.value; if (s.trim()) setParam('search', s.trim()); }} className={styles.heroSearch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input name="search" defaultValue={search} placeholder="How do I prepare for a system design interview…" className={styles.searchBar} autoComplete="off" />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className={styles.categories}>
        <div className="container">
          <div className={`${styles.categoryRow} stagger`}>
            <button
              className={`${styles.allPill} ${!category ? styles.activePill : ''}`}
              onClick={() => setParam('category', '')}
            >
              All Topics
            </button>
            {categories.map(c => (
              <CategoryPill
                key={c.id}
                label={c.label}
                count={c.count}
                active={category === c.label}
                asLink={false}
                onClick={() => setParam('category', c.label === category ? '' : c.label)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="container">
        <div className="layout-main">
          {/* Feed */}
          <div>
            {/* Sort bar */}
            <div className={styles.sortBar}>
              <span className={styles.resultCount}>
                {loading ? 'Loading…' : `${questions.length} question${questions.length !== 1 ? 's' : ''}`}
              </span>
              <div className={styles.sortBtns}>
                {SORTS.map(s => (
                  <button
                    key={s.value}
                    className={`${styles.sortBtn} ${sort === s.value ? styles.sortActive : ''}`}
                    onClick={() => setParam('sort', s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className={`${styles.skeletonList} stagger`}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`glass ${styles.skeletonCard}`}>
                    <div className={`skeleton ${styles.skeletonVote}`} />
                    <div className={styles.skeletonBody}>
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '25%' }} />
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '85%', height: '20px' }} />
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '70%' }} />
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className={styles.empty}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>No questions found</h3>
                <p>{search ? `No results for "${search}"` : category ? `No ${category} questions yet` : 'Be the first to ask!'}</p>
                <Link to="/ask" className="btn btn-primary">Ask a Question</Link>
              </div>
            ) : (
              <div className={`${styles.feed} stagger`}>
                {questions.map(q => (
                  <QuestionCard key={q.id} question={{ ...q, canVote: true }} onVote={handleVote} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>

          <Sidebar stats={stats} categories={categories} />
        </div>
      </div>
    </main>
  );
}