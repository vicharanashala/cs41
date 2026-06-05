import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/faculty.js';

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0',
    }}>
      {title && (
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem' }}>
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

function ConfidenceBar({ score }) {
  const pct = Math.min(100, Math.max(0, Math.round(score ?? 0)));
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 80 }}>
      <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: '#1e293b', minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(e => setError(e.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#1e293b', fontSize: '0.9rem' }}>
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '3rem 2rem', color: '#ef4444', fontSize: '0.9rem' }}>
        ❌ {error}
      </div>
    );
  }

  const stats = data?.stats ?? {};
  const reviewedThisWeek = data?.reviewedThisWeek ?? 0;
  const recentAnalyses = data?.recentAnalyses ?? [];
  const recentInternQuestions = data?.recentInternQuestions ?? [];

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: '1.75rem' }}>
        Faculty Dashboard
      </h1>

      {/* Review stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b' }}>{stats.pending ?? '—'}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Pending Review</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>{stats.published ?? '—'}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Published FAQs</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>❌</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444' }}>{stats.rejected ?? '—'}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Rejected</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📝</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366f1' }}>{stats.total ?? '—'}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Total Questions</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏰</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8b5cf6' }}>{stats.avgQueueHours != null ? `${Math.round(stats.avgQueueHours * 10) / 10}h` : '—'}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Avg Queue Time</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🗓️</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0ea5e9' }}>{reviewedThisWeek}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Reviewed This Week</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👥</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8b5cf6' }}>{stats.totalInterns ?? '—'}</div>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.25rem' }}>Total Interns</div>
        </div>
      </div>

      {/* AI statistics */}
      <SectionCard title="🤖 AI ANALYSIS STATISTICS">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3b82f6' }}>{stats.analyzedCount ?? '—'}</div>
            <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: '0.25rem' }}>Total Analyzed</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: stats.avgConfidence >= 70 ? '#10b981' : stats.avgConfidence >= 50 ? '#f59e0b' : '#ef4444' }}>
              {stats.avgConfidence != null ? `${Math.round(stats.avgConfidence)}%` : '—'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: '0.25rem' }}>Avg AI Confidence</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <ConfidenceBar score={stats.avgConfidence} />
            <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: '0.4rem' }}>Confidence Gauge</div>
          </div>
        </div>
      </SectionCard>

      {/* Recent AI analyses */}
      <SectionCard title="📡 RECENT AI ANALYSES">
        {recentAnalyses.length === 0 ? (
          <div style={{ color: '#1e293b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            No recent AI analyses available.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentAnalyses.map((item, i) => (
              <div key={item.question_id || i} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}>
                {/* Confidence indicator */}
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: (item.ai_confidence ?? 0) >= 70 ? '#10b98118'
                    : (item.ai_confidence ?? 0) >= 50 ? '#f59e0b18'
                    : '#ef444418',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: (item.ai_confidence ?? 0) >= 70 ? '#10b981' : (item.ai_confidence ?? 0) >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {item.ai_confidence != null ? Math.round(item.ai_confidence) : '—'}
                  </span>
                  <span style={{ fontSize: '0.55rem', color: '#1e293b' }}>conf</span>
                </div>

                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || `FAQ #${item.question_id?.slice(0, 8)}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: 2 }}>
                    Quality: <strong style={{ color: '#1e293b' }}>{item.ai_quality_score != null ? `${Math.round(item.ai_quality_score)}%` : '—'}</strong>
                    {item.analyzed_at ? ` · ${new Date(item.analyzed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                </div>

                {/* View button */}
                <Link
                  to={`/faculty/queue/${item.question_id}`}
                  style={{
                    padding: '0.35rem 0.75rem', background: '#3b82f6', color: '#fff',
                    borderRadius: 5, textDecoration: 'none', fontSize: '0.75rem', fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  Review →
                </Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* New Questions from Interns */}
      <SectionCard title="🆕 NEW QUESTIONS FROM INTERNS">
        {recentInternQuestions.length === 0 ? (
          <div style={{ color: '#1e293b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            No pending questions from interns.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentInternQuestions.map((q) => (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: '#8b5cf618',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b5cf6' }}>
                    {q.answer_count ?? 0}
                  </span>
                  <span style={{ fontSize: '0.55rem', color: '#1e293b' }}>ans</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: 2 }}>
                    by <strong style={{ color: '#1e293b' }}>{q.author_name || 'Anonymous'}</strong>
                    {q.trigger_at ? ` · ${new Date(q.trigger_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                </div>
                <Link
                  to={`/faculty/queue/${q.id}`}
                  style={{
                    padding: '0.35rem 0.75rem', background: '#8b5cf6', color: '#fff',
                    borderRadius: 5, textDecoration: 'none', fontSize: '0.75rem', fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  Review →
                </Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* SP Management — Intern Accounts */}
      <SectionCard title="📊 SP MANAGEMENT — INTERN ACCOUNTS">
        {(() => {
          const interns = data?.recentlyAddedInterns ?? [];
          if (interns.length === 0) {
            return (
              <div style={{ color: '#1e293b', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                No intern accounts found.
              </div>
            );
          }
          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Name', 'Email', 'SP', 'Frozen', 'Watchlist', 'Joined'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#1e293b', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interns.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: '#1e293b' }}>{s.name || '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#1e293b' }}>{s.email}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: s.reputation > 0 ? '#059669' : '#1e293b' }}>
                        {s.reputation ?? 0}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {s.is_frozen ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>🔒 Yes</span>
                        ) : (
                          <span style={{ color: '#10b981' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: s.watchlist_entries > 0 ? '#f59e0b' : '#1e293b' }}>
                        {s.watchlist_entries > 0 ? `⚠ ${s.watchlist_entries}` : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#1e293b' }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', textAlign: 'right' }}>
                <Link
                  to="/faculty/interns"
                  style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}
                >
                  View All Interns →
                </Link>
              </div>
            </div>
          );
        })()}
      </SectionCard>

      {/* Quick actions */}
      <SectionCard title="⚡ QUICK ACTIONS">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to="/faculty/queue"
            style={{
              padding: '0.6rem 1.25rem', background: '#3b82f6', color: '#fff',
              borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            📋 Review Queue {stats.pending ? `(${stats.pending} pending)` : ''}
          </Link>
          <Link
            to="/faculty/queue?status=published"
            style={{
              padding: '0.6rem 1.25rem', background: '#1e293b', color: '#94a3b8',
              borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            📖 Published FAQs
          </Link>
          <Link
            to="/faculty/analytics"
            style={{
              padding: '0.6rem 1.25rem', background: '#1e293b', color: '#94a3b8',
              borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            📊 Analytics
          </Link>
          <Link
            to="/faculty/moderation"
            style={{
              padding: '0.6rem 1.25rem', background: '#1e293b', color: '#94a3b8',
              borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            🛡️ Moderation
          </Link>
        </div>
      </SectionCard>

    </div>
  );
}