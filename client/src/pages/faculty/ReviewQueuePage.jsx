import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getQueue, getQueueStats } from '../../api/faculty.js';

const STATUS_LABELS = {
  pending_review: { label: 'Pending Review', color: '#f59e0b' },
  published: { label: 'Published', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  changes_requested: { label: 'Changes Requested', color: '#8b5cf6' },
};

const TRIGGER_LABELS = {
  upvote_threshold: 'Upvote Threshold 📈',
  faculty_flag: 'Faculty Flag 🚩',
  manual: 'Manual Escalation 🙋',
};

export default function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'pending_review';
  const sort = searchParams.get('sort') || 'trigger_at';

  const [queue, setQueue] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getQueue({ status, sort }), getQueueStats()])
      .then(([q, s]) => { setQueue(q); setStats(s); })
      .catch(e => setError(e.response?.data?.error || 'Failed to load queue'))
      .finally(() => setLoading(false));
  }, [status, sort]);

  const setFilter = (key, value) => setSearchParams(p => { const n = new URLSearchParams(p); n.set(key, value); return n; });

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Review Queue</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Filter:</span>
          {Object.entries(STATUS_LABELS).map(([val, { label, color }]) => (
            <button
              key={val}
              onClick={() => setFilter('status', val)}
              style={{
                padding: '0.3rem 0.75rem',
                background: status === val ? color : '#f1f5f9',
                color: status === val ? '#fff' : '#334155',
                border: 'none', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                fontWeight: status === val ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <span>⏳ <b style={{ color: '#1e293b' }}>{stats.pending}</b> pending</span>
          <span>✅ <b style={{ color: '#1e293b' }}>{stats.published}</b> published</span>
          <span>❌ <b style={{ color: '#1e293b' }}>{stats.rejected}</b> rejected</span>
          <span>⏰ Avg queue: <b style={{ color: '#1e293b' }}>{stats.avgQueueHours}h</b></span>
          {stats.categoryBreakdown?.[0] && (
            <span>📂 Top: <b style={{ color: '#1e293b' }}>{stats.categoryBreakdown[0].category}</b></span>
          )}
        </div>
      )}

      {/* Sort controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Sort:</span>
        {[['trigger_at', 'Oldest First'], ['upvotes', 'Most Upvotes'], ['views', 'Most Views'], ['answers', 'Most Answers'], ['created_at', 'Newest']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter('sort', val)}
            style={{
              padding: '0.25rem 0.6rem',
              background: sort === val ? '#1e293b' : '#f1f5f9',
              color: sort === val ? '#fff' : '#64748b',
              border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '3rem' }}>Loading queue...</div>
      ) : error ? (
        <div style={{ color: 'red', padding: '1rem' }}>❌ {error}</div>
      ) : (
        <>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
            {queue.total} question{queue.total !== 1 ? 's' : ''}
          </div>

          {queue.questions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '4rem', fontSize: '0.9rem' }}>
              No questions in this queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {queue.questions.map(q => (
                <Link
                  key={q.id}
                  to={`/faculty/queue/${q.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    background: '#fff', borderRadius: 10, padding: '1rem 1.25rem',
                    border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'box-shadow 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                          {q.title}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <span>👤 {q.author_name}</span>
                          <span>📂 {q.category}</span>
                          {q.trigger_event && <span>{TRIGGER_LABELS[q.trigger_event] || q.trigger_event}</span>}
                          {q.trigger_upvotes && <span>👍 {q.trigger_upvotes} upvotes when queued</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', marginLeft: '1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                          background: STATUS_LABELS[q.faq_status]?.color + '22',
                          color: STATUS_LABELS[q.faq_status]?.color,
                        }}>
                          {STATUS_LABELS[q.faq_status]?.label || q.faq_status}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                          <span>👍 {q.upvotes}</span>
                          <span>👎 {q.downvotes}</span>
                          <span>💬 {q.answer_count}</span>
                          <span>👁 {q.views}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}