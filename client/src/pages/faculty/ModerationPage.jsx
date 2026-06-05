import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getModerationQueue, getModerationStats, resolveFlag, bulkDismiss } from '../../api/moderation.js';

const REASON_LABELS = {
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  wrong_info: 'Wrong Info',
  duplicate: 'Duplicate',
  too_vague: 'Too Vague',
  offensive: 'Offensive',
  other: 'Other',
};

const REASON_COLORS = {
  spam: '#f97316',
  inappropriate: '#ef4444',
  wrong_info: '#f59e0b',
  duplicate: '#1e293b',
  too_vague: '#8b5cf6',
  offensive: '#dc2626',
  other: '#1e293b',
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: '#ef4444', bg: '#fef2f2' },
  reviewed: { label: 'Reviewed', color: '#10b981', bg: '#f0fdf4' },
  dismissed: { label: 'Dismissed', color: '#1e293b', bg: '#f8fafc' },
};

function formatRelative(ms) {
  if (!ms) return '—';
  const diff = Date.now() - new Date(ms).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeAgo(isoString) {
  if (!isoString) return '—';
  return formatRelative(new Date(isoString).getTime());
}

export default function ModerationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'open';
  const targetType = searchParams.get('target_type') || '';
  const page = Number(searchParams.get('page') || 1);

  const [queue, setQueue] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkNotes, setBulkNotes] = useState('');
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getModerationQueue({ status, target_type: targetType || undefined, page }),
      getModerationStats(),
    ])
      .then(([q, s]) => { setQueue(q); setStats(s); })
      .catch(e => setError(e.response?.data?.error || 'Failed to load moderation queue'))
      .finally(() => setLoading(false));
  }, [status, targetType, page]);

  const setFilter = (key, value) => {
    setSearchParams(p => {
      const n = new URLSearchParams(p);
      if (value) n.set(key, value);
      else n.delete(key);
      n.delete('page');
      return n;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (!queue) return;
    if (selectedIds.length === queue.flags.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(queue.flags.map(f => f.id));
    }
  };

  const handleBulkDismiss = async () => {
    if (!selectedIds.length) return;
    setDismissing(true);
    setError(null);
    try {
      await bulkDismiss(selectedIds, bulkNotes || undefined);
      setSelectedIds([]);
      setBulkNotes('');
      // Refresh
      const q = await getModerationQueue({ status, target_type: targetType || undefined, page });
      setQueue(q);
      const s = await getModerationStats();
      setStats(s);
    } catch (e) {
      setError(e.response?.data?.error || 'Bulk dismiss failed');
    } finally {
      setDismissing(false);
    }
  };

  const handleResolve = async (flagId, action, notes) => {
    try {
      await resolveFlag(flagId, { action, notes });
      const q = await getModerationQueue({ status, target_type: targetType || undefined, page });
      setQueue(q);
      const s = await getModerationStats();
      setStats(s);
      setSelectedIds(prev => prev.filter(id => id !== flagId));
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed');
    }
  };

  const setPage = (p) => {
    setSearchParams(pa => { const n = new URLSearchParams(pa); n.set('page', p); return n; });
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Content Moderation</h1>
          <p style={{ fontSize: '0.8rem', color: '#1e293b', margin: '0.25rem 0 0' }}>
            Review and act on community-reported content
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Open Flags', value: stats.open, icon: '🚩', color: '#ef4444' },
            { label: 'Reviewed', value: stats.reviewed, icon: '✅', color: '#10b981' },
            { label: 'Dismissed', value: stats.dismissed, icon: '🙈', color: '#1e293b' },
            { label: 'Resolved (7d)', value: stats.resolved7d, icon: '🗓️', color: '#3b82f6' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 8, padding: '0.75rem 1.25rem',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              flex: '1 1 120px',
            }}>
              <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '0.25rem' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* High priority banner */}
      {stats?.highPriority?.length > 0 && status === 'open' && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '0.875rem 1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>
            ⚠️ High-Priority Items (multiple open flags)
          </div>
          {stats.highPriority.slice(0, 5).map(item => (
            <div key={`${item.target_type}:${item.target_id}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.25rem 0', fontSize: '0.8rem',
            }}>
              <span style={{ color: '#7f1d1d' }}>
                [{item.target_type}] {item.question_title?.slice(0, 60)}
              </span>
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: 10,
                padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
              }}>
                {item.flag_count} flags
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#1e293b' }}>Status:</span>
        {['open', 'reviewed', 'dismissed'].map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter('status', s)}
              style={{
                padding: '0.3rem 0.75rem',
                background: status === s ? cfg.color : '#f1f5f9',
                color: status === s ? '#fff' : '#1e293b',
                border: 'none', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                fontWeight: status === s ? 600 : 400,
              }}
            >
              {cfg.label}
            </button>
          );
        })}

        <span style={{ fontSize: '0.8rem', color: '#1e293b', marginLeft: '0.5rem' }}>Type:</span>
        {[{ val: '', label: 'All' }, { val: 'question', label: 'Questions' }, { val: 'answer', label: 'Answers' }].map(t => (
          <button
            key={t.val}
            onClick={() => setFilter('target_type', t.val)}
            style={{
              padding: '0.3rem 0.75rem',
              background: targetType === t.val ? '#3b82f6' : '#f1f5f9',
              color: targetType === t.val ? '#fff' : '#1e293b',
              border: 'none', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div style={{
          background: '#1e293b', borderRadius: 8, padding: '0.75rem 1rem',
          display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
            {selectedIds.length} selected
          </span>
          <input
            type="text"
            value={bulkNotes}
            onChange={e => setBulkNotes(e.target.value)}
            placeholder="Optional notes..."
            style={{
              flex: 1, minWidth: 200, padding: '0.4rem 0.75rem',
              border: '1px solid #334155', borderRadius: 6,
              fontSize: '0.8rem', background: '#0f172a', color: '#cbd5e1',
            }}
          />
          <button
            onClick={handleBulkDismiss}
            disabled={dismissing}
            style={{
              padding: '0.4rem 1rem', background: '#1e293b', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            {dismissing ? 'Dismissing...' : 'Dismiss Selected'}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            style={{
              padding: '0.4rem 0.75rem', background: '#1e293b', color: '#1e293b',
              border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#1e293b', padding: '3rem' }}>Loading moderation queue...</div>
      ) : (
        <>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginBottom: '0.75rem' }}>
            {queue?.total || 0} flag{queue?.total !== 1 ? 's' : ''}
          </div>

          {queue?.flags.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#1e293b', padding: '4rem', fontSize: '0.9rem' }}>
              ✅ No flags in this queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Select all */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={queue && selectedIds.length === queue.flags.length && queue.flags.length > 0}
                  onChange={toggleAll}
                />
                Select all
              </div>

              {queue?.flags.map(flag => {
                const statusCfg = STATUS_CONFIG[flag.status] || { label: flag.status, color: '#1e293b', bg: '#f8fafc' };
                const reasonColor = REASON_COLORS[flag.reason] || '#1e293b';
                const isSelected = selectedIds.includes(flag.id);

                return (
                  <div
                    key={flag.id}
                    style={{
                      background: isSelected ? '#f0f9ff' : '#fff',
                      border: `1px solid ${isSelected ? '#93c5fd' : '#cbd5e1'}`,
                      borderRadius: 10, padding: '1rem 1.25rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(flag.id)}
                        style={{ marginTop: '0.2rem', flexShrink: 0, cursor: 'pointer' }}
                      />

                      {/* Main content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Reason + status badges */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                            background: reasonColor + '22', color: reasonColor,
                          }}>
                            {flag.reason_label}
                          </span>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                            background: statusCfg.bg, color: statusCfg.color,
                          }}>
                            {statusCfg.label}
                          </span>
                          {flag.open_flag_count > 1 && (
                            <span style={{
                              padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                              background: '#fef3c7', color: '#92400e',
                            }}>
                              ⚠️ {flag.open_flag_count} total open flags
                            </span>
                          )}
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem',
                            background: '#f1f5f9', color: '#1e293b',
                          }}>
                            {flag.target_type}
                          </span>
                        </div>

                        {/* Question title */}
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                          {flag.question_title?.slice(0, 120)}
                        </div>

                        {/* Meta row */}
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#1e293b', flexWrap: 'wrap' }}>
                          <span>👤 {flag.author_name}</span>
                          <span>📂 {flag.question_category}</span>
                          <span>📌 Flagged by {flag.flagged_by_name}</span>
                          <span>⏰ {timeAgo(flag.created_at)}</span>
                          {flag.resolved_at && <span>✅ Resolved {timeAgo(flag.resolved_at)}</span>}
                        </div>

                        {/* Flag details if present */}
                        {flag.details && (
                          <div style={{
                            marginTop: '0.5rem', padding: '0.5rem 0.75rem',
                            background: '#1e293b', borderRadius: 6, fontSize: '0.8rem', color: '#94a3b8',
                            fontStyle: 'italic',
                          }}>
                            "{flag.details}"
                          </div>
                        )}

                        {/* Question status indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#1e293b' }}>Question status:</span>
                          <span style={{
                            padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem',
                            background: flag.question_status === 'published' ? '#dcfce7' : flag.question_status === 'pending_review' ? '#fef9c3' : '#f1f5f9',
                            color: flag.question_status === 'published' ? '#166534' : flag.question_status === 'pending_review' ? '#854d0e' : '#1e293b',
                          }}>
                            {flag.question_status}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {flag.status === 'open' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleResolve(flag.id, 'dismissed_flag', '')}
                            style={{
                              padding: '0.35rem 0.75rem', background: '#1e293b', color: '#94a3b8',
                              border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
                            }}
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => handleResolve(flag.id, 'warned_user', '')}
                            style={{
                              padding: '0.35rem 0.75rem', background: '#fef3c7', color: '#92400e',
                              border: '1px solid #fde68a', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
                            }}
                          >
                            Warn User
                          </button>
                          <button
                            onClick={() => handleResolve(flag.id, 'removed_content', '')}
                            style={{
                              padding: '0.35rem 0.75rem', background: '#fef2f2', color: '#991b1b',
                              border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                          <Link
                            to={`/faculty/queue/${flag.target_id}`}
                            style={{
                              padding: '0.35rem 0.75rem', background: '#3b82f6', color: '#fff',
                              border: 'none', borderRadius: 6, fontSize: '0.75rem', textDecoration: 'none',
                              textAlign: 'center',
                            }}
                          >
                            Review →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {queue && queue.totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                style={{
                  padding: '0.4rem 0.875rem', background: page <= 1 ? '#f1f5f9' : '#fff',
                  color: page <= 1 ? '#1e293b' : '#1e293b',
                  border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Prev
              </button>
              <span style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#1e293b' }}>
                Page {page} of {queue.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= queue.totalPages}
                style={{
                  padding: '0.4rem 0.875rem', background: page >= queue.totalPages ? '#f1f5f9' : '#fff',
                  color: page >= queue.totalPages ? '#1e293b' : '#1e293b',
                  border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem', cursor: page >= queue.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}