// Skeleton — Phase 1: Overview cards + Intern table + basic API wiring only
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getInternOverview,
  getInterns,
  freezeIntern,
  getWatchlist,
  getInternAnomalies,
  adjustIntern,
  getInternLedger,
  getIntern,
  unfreezeIntern,
  removeFromWatchlist,
  resolveAnomaly,
} from '../../api/spManagement.js';

const STATUS_COLORS = { open: '#ef4444', resolved: '#10b981', dismissed: '#64748b', investigating: '#f59e0b' };
const PRIORITY_COLORS = { low: '#94a3b8', normal: '#3b82f6', high: '#f59e0b', critical: '#ef4444' };

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Ledger Tab ───────────────────────────────────────────────────────────────
const SP_ACTIONS = {
  sp_earn:        { label: 'SP Earned',      color: '#10b981' },
  sp_spend:       { label: 'SP Spent',       color: '#ef4444' },
  sp_adjustment:  { label: 'Adjustment',     color: '#f59e0b' },
  account_frozen: { label: 'Account Frozen', color: '#6366f1' },
};

function LedgerTab({ searchParams, setSearchParams }) {
  const ledgerStudentId = searchParams.get('ledgerStudent');
  const ledgerPage      = Number(searchParams.get('ledgerPage') || 1);
  const ledgerAction    = searchParams.get('ledgerAction') || '';
  const ledgerFrom      = searchParams.get('ledgerFrom') || '';
  const ledgerTo        = searchParams.get('ledgerTo') || '';

  const [ledger, setLedger]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const fetchLedger = (pg = 1, filters = {}) => {
    if (!ledgerStudentId) return;
    setLoading(true);
    setError(null);
    getInternLedger(ledgerStudentId, {
      page: pg,
      action_type: filters.action || ledgerAction,
      from_date:   filters.from   || ledgerFrom,
      to_date:     filters.to     || ledgerTo,
    })
      .then(data => { setLedger(data); setLoading(false); })
      .catch(() => { setError('Failed to load ledger'); setLoading(false); });
  };

  useEffect(() => { fetchLedger(1); }, [ledgerStudentId]);

  const setLedgerParam = (key, val) => {
    setSearchParams(p => { const n = new URLSearchParams(p); val ? n.set(key, val) : n.delete(key); n.delete('ledgerPage'); return n; });
  };

  const goPage = p => {
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('ledgerPage', String(p)); return n; });
    fetchLedger(p);
  };

  if (!ledgerStudentId) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
        👈 Select an intern from the Interns tab to view their ledger.
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={ledgerAction}
          onChange={e => { setLedgerParam('ledgerAction', e.target.value); fetchLedger(1, { action: e.target.value }); }}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem' }}
        >
          <option value="">All actions</option>
          {Object.entries(SP_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" value={ledgerFrom} onChange={e => { setLedgerParam('ledgerFrom', e.target.value); fetchLedger(1, { from: e.target.value }); }}
          style={{ padding: '0.4rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem' }} />
        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→</span>
        <input type="date" value={ledgerTo} onChange={e => { setLedgerParam('ledgerTo', e.target.value); fetchLedger(1, { to: e.target.value }); }}
          style={{ padding: '0.4rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem' }} />
        {(ledgerAction || ledgerFrom || ledgerTo) && (
          <button onClick={() => { setLedgerParam('ledgerAction', ''); setLedgerParam('ledgerFrom', ''); setLedgerParam('ledgerTo', ''); fetchLedger(1, { action: '', from: '', to: '' }); }}
            style={{ padding: '0.4rem 0.75rem', background: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', color: '#64748b' }}>Clear</button>
        )}
        <button onClick={() => { setSearchParams(p => { const n = new URLSearchParams(p); n.delete('ledgerStudent'); return n; }); }}
          style={{ marginLeft: 'auto', padding: '0.4rem 0.75rem', background: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', color: '#64748b' }}>← Back to list</button>
      </div>

      {/* Running total banner */}
      {ledger && (
        <div style={{ marginBottom: '0.75rem', padding: '0.6rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.8rem', color: '#64748b' }}>
          Net SP change: <strong style={{ color: ledger.runningTotal >= 0 ? '#10b981' : '#ef4444' }}>{ledger.runningTotal >= 0 ? '+' : ''}{ledger.runningTotal}</strong>
          &nbsp;&nbsp;|&nbsp;&nbsp;Showing {ledger.entries?.length} of {ledger.total} entries
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'auto' }}>
        {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading ledger…</div>
         : error ? <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>❌ {error}</div>
         : !ledger?.entries?.length ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No ledger entries found.</div>
         : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Time', 'Action', 'SP Δ', 'Balance After', 'Ref', 'Description'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.entries.map(e => {
                const actionCfg = SP_ACTIONS[e.action_type] || { label: e.action_type, color: '#64748b' };
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{timeAgo(e.created_at)}</td>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      <span style={{ background: actionCfg.color + '18', color: actionCfg.color, padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 500 }}>{actionCfg.label}</span>
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: e.points > 0 ? '#10b981' : '#ef4444' }}>
                      {e.points > 0 ? `+${e.points}` : e.points}
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#334155' }}>{e.balance_after}</td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#94a3b8', fontSize: '0.72rem' }}>{e.reference_id ? `${e.reference_type}#${e.reference_id}` : '—'}</td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#475569', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {ledger && ledger.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button disabled={ledgerPage <= 1} onClick={() => goPage(ledgerPage - 1)}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: ledgerPage <= 1 ? 'not-allowed' : 'pointer', opacity: ledgerPage <= 1 ? 0.5 : 1 }}>‹ Prev</button>
          <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>Page {ledgerPage} of {ledger.totalPages}</span>
          <button disabled={ledgerPage >= ledger.totalPages} onClick={() => goPage(ledgerPage + 1)}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: ledgerPage >= ledger.totalPages ? 'not-allowed' : 'pointer', opacity: ledgerPage >= ledger.totalPages ? 0.5 : 1 }}>Next ›</button>
        </div>
      )}
    </div>
  );
}

// ── Anomalies Tab ────────────────────────────────────────────────────────────
const SEVERITY_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8' };
const STATUS_STYLES   = {
  open:         { bg: '#fef2f2', color: '#dc2626' },
  investigating:{ bg: '#fffbeb', color: '#d97706' },
  resolved:     { bg: '#f0fdf4', color: '#16a34a' },
  dismissed:    { bg: '#f8fafc', color: '#64748b' },
};

function AnomaliesTab({ searchParams, setSearchParams }) {
  const anomalyPage    = Number(searchParams.get('anomalyPage') || 1);
  const anomalyStatus  = searchParams.get('anomalyStatus') || 'open';
  const anomalySeverity= searchParams.get('anomalySeverity') || '';

  const [data, setData]     = useState(null);
  const [loading, setLoading]= useState(false);
  const [error, setError]   = useState(null);
  const [resolving, setResolving] = useState(null); // id being resolved
  const [resolveInput, setResolveInput] = useState({}); // id -> { status, notes }

  const fetchAnomalies = (pg = 1, filters = {}) => {
    setLoading(true);
    getInternAnomalies({
      status:  filters.status  || anomalyStatus,
      severity: filters.severity || anomalySeverity,
      page: pg,
    })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load anomalies'); setLoading(false); });
  };

  useEffect(() => { fetchAnomalies(1); }, []);

  const setParam = (key, val) => {
    setSearchParams(p => { const n = new URLSearchParams(p); val ? n.set(key, val) : n.delete(key); n.delete('anomalyPage'); return n; });
  };

  const goPage = p => {
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('anomalyPage', String(p)); return n; });
    fetchAnomalies(p);
  };

  const handleResolve = async (id, status, notes) => {
    setResolving(id);
    try {
      await resolveAnomaly(id, { status, notes });
      setResolveInput(i => { const m = { ...i }; delete m[id]; return m; });
      fetchAnomalies(anomalyPage);
    } catch {
      setError('Failed to resolve anomaly');
    } finally {
      setResolving(null);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={anomalyStatus} onChange={e => { setParam('anomalyStatus', e.target.value); fetchAnomalies(1, { status: e.target.value }); }}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem' }}>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
        <select value={anomalySeverity} onChange={e => { setParam('anomalySeverity', e.target.value); fetchAnomalies(1, { severity: e.target.value }); }}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem' }}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>
          {data ? `${data.total} event${data.total !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'auto' }}>
        {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
         : error ? <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>❌ {error}</div>
         : !data?.events?.length ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No anomaly events found.</div>
         : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Severity', 'Intern', 'Type', 'Description', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.events.map(ev => {
                const sevColor = SEVERITY_COLORS[ev.severity] || '#94a3b8';
                const sty = STATUS_STYLES[ev.status] || STATUS_STYLES.open;
                const ri  = resolveInput[ev.id] || {};
                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      <span style={{ background: sevColor + '20', color: sevColor, padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        {ev.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: 500, color: '#1e293b', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.student_name}</td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#475569', fontSize: '0.75rem' }}>{ev.anomaly_type}</td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description || '—'}</td>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      <span style={{ background: sty.bg, color: sty.color, padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 500 }}>{ev.status}</span>
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{timeAgo(ev.created_at)}</td>
                    <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {ev.status === 'open' || ev.status === 'investigating' ? (
                        resolveInput[ev.id] ? (
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <select value={ri.status || ''} onChange={e => setResolveInput(i => ({ ...i, [ev.id]: { ...i[ev.id], status: e.target.value } }))}
                              style={{ padding: '0.2rem 0.3rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.72rem' }}>
                              <option value="">Choose…</option>
                              <option value="resolved">Resolved</option>
                              <option value="dismissed">Dismissed</option>
                              <option value="investigating">Investigating</option>
                            </select>
                            <input placeholder="notes…" value={ri.notes || ''} onChange={e => setResolveInput(i => ({ ...i, [ev.id]: { ...i[ev.id], notes: e.target.value } }))}
                              style={{ padding: '0.2rem 0.4rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.72rem', width: 80 }} />
                            <button disabled={!ri.status || resolving === ev.id}
                              onClick={() => handleResolve(ev.id, ri.status, ri.notes)}
                              style={{ padding: '0.2rem 0.5rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.72rem', cursor: ri.status && resolving !== ev.id ? 'pointer' : 'not-allowed', opacity: ri.status && resolving !== ev.id ? 1 : 0.5 }}>
                              {resolving === ev.id ? '…' : '✓'}
                            </button>
                            <button onClick={() => setResolveInput(i => { const m = { ...i }; delete m[ev.id]; return m; })}
                              style={{ padding: '0.2rem 0.4rem', background: '#f1f5f9', border: 'none', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer' }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setResolveInput(i => ({ ...i, [ev.id]: { status: '', notes: '' } }))}
                            style={{ padding: '0.25rem 0.6rem', background: '#fef3c7', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#d97706' }}>
                            Resolve
                          </button>
                        )
                      ) : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button disabled={anomalyPage <= 1} onClick={() => goPage(anomalyPage - 1)}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: anomalyPage <= 1 ? 'not-allowed' : 'pointer', opacity: anomalyPage <= 1 ? 0.5 : 1 }}>‹ Prev</button>
          <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>Page {anomalyPage} of {data.totalPages}</span>
          <button disabled={anomalyPage >= data.totalPages} onClick={() => goPage(anomalyPage + 1)}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: anomalyPage >= data.total.totalPages ? 'not-allowed' : 'pointer', opacity: anomalyPage >= data.totalPages ? 0.5 : 1 }}>Next ›</button>
        </div>
      )}
    </div>
  );
}

// ── Watchlist Tab ───────────────────────────────────────────────────────────
const PRIORITY_BADGE = {
  low:    { bg: '#f1f5f9', color: '#64748b' },
  normal: { bg: '#dbeafe', color: '#1d4ed8' },
  high:   { bg: '#fef3c7', color: '#d97706' },
  urgent: { bg: '#fef2f2', color: '#dc2626' },
};

function WatchlistTab({ searchParams, setSearchParams }) {
  const wlPage     = Number(searchParams.get('wlPage') || 1);
  const wlPriority = searchParams.get('wlPriority') || '';
  const wlStudent  = searchParams.get('wlStudent') || '';

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [removing, setRemoving] = useState(null);

  const fetchWatchlist = (pg = 1, filters = {}) => {
    setLoading(true);
    getWatchlist({
      priority:  filters.priority || wlPriority,
      student_id: filters.student  || wlStudent,
      page: pg,
    })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load watchlist'); setLoading(false); });
  };

  useEffect(() => { fetchWatchlist(1); }, []);

  const setParam = (key, val) => {
    setSearchParams(p => { const n = new URLSearchParams(p); val ? n.set(key, val) : n.delete(key); n.delete('wlPage'); return n; });
  };

  const goPage = p => {
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('wlPage', String(p)); return n; });
    fetchWatchlist(p);
  };

  const handleRemove = async (userId) => {
    setRemoving(userId);
    try {
      await removeFromWatchlist(userId);
      fetchWatchlist(wlPage);
    } catch {
      setError('Failed to remove from watchlist');
    } finally {
      setRemoving(null);
    }
  };

  const viewLedger = (userId, userName) => {
    setSearchParams(p => {
      const n = new URLSearchParams(p);
      n.set('tab', 'ledger');
      n.set('ledgerStudent', userId);
      n.delete('ledgerPage');
      return n;
    });
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={wlPriority} onChange={e => { setParam('wlPriority', e.target.value); fetchWatchlist(1, { priority: e.target.value }); }}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem' }}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <input value={wlStudent} onChange={e => { setParam('wlStudent', e.target.value); fetchWatchlist(1, { student: e.target.value }); }}
          placeholder="Filter by intern name…"
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem', flex: '0 0 180px' }} />
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>
          {data ? `${data.total} intern${data.total !== 1 ? 's' : ''} on watchlist` : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'auto' }}>
        {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading watchlist…</div>
         : error ? <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>❌ {error}</div>
         : !data?.students?.length ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Watchlist is empty.</div>
         : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Priority', 'Intern', 'Email', 'SP', 'Frozen', 'Reasons', 'Watched Since', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map(w => {
                const pb = PRIORITY_BADGE[w.priority] || PRIORITY_BADGE.normal;
                return (
                  <tr key={w.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      <span style={{ background: pb.bg, color: pb.color, padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        {w.priority}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: 500, color: '#1e293b' }}>{w.name}</td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>{w.email}</td>
                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, color: '#3b82f6' }}>{w.sp_points ?? w.reputation}</td>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      {w.is_frozen
                        ? <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem' }}>❄️ Yes</span>
                        : <span style={{ background: '#f0fdf4', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem' }}>🟢 No</span>}
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.reasons?.length ? w.reasons.join('; ') : '—'}
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{timeAgo(w.added_at)}</td>
                    <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                      <button onClick={() => viewLedger(w.user_id, w.name)}
                        style={{ padding: '0.25rem 0.6rem', background: '#f1f5f9', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', marginRight: 4 }}>Ledger</button>
                      <button disabled={removing === w.user_id}
                        onClick={() => handleRemove(w.user_id)}
                        style={{ padding: '0.25rem 0.6rem', background: '#fef2f2', border: 'none', borderRadius: 4, cursor: removing === w.user_id ? 'not-allowed' : 'pointer', fontSize: '0.75rem', color: '#dc2626', opacity: removing === w.user_id ? 0.5 : 1 }}>
                        {removing === w.user_id ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button disabled={wlPage <= 1} onClick={() => goPage(wlPage - 1)}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: wlPage <= 1 ? 'not-allowed' : 'pointer', opacity: wlPage <= 1 ? 0.5 : 1 }}>‹ Prev</button>
          <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>Page {wlPage} of {data.totalPages}</span>
          <button disabled={wlPage >= data.totalPages} onClick={() => goPage(wlPage + 1)}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: wlPage >= data.totalPages ? 'not-allowed' : 'pointer', opacity: wlPage >= data.totalPages ? 0.5 : 1 }}>Next ›</button>
        </div>
      )}
    </div>
  );
}

// ── Shared Modals ───────────────────────────────────────────────────────────
function Modal({ onClose, title, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#94a3b8', padding: '0.1rem 0.3rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExportModal({ interns, onClose }) {
  const [format, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  if (!interns?.length) return null;
  const handleExport = () => {
    setExporting(true);
    const timestamp = new Date().toISOString().slice(0, 10);
    let content, mimeType, filename;
    if (format === 'csv') {
      const rows = [['Name', 'Email', 'SP', 'Status', 'Frozen', 'Watchlist', 'Open Anomalies', 'Joined']];
      interns.forEach(s => rows.push([s.name || '', s.email || '', s.sp_points ?? s.reputation ?? '', s.is_frozen ? 'Frozen' : 'Active', s.is_frozen ? 'Yes' : 'No', s.watchlist_entries || 0, s.open_anomalies || 0, s.created_at ? new Date(s.created_at).toLocaleDateString() : '']));
      content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      mimeType = 'text/csv'; filename = `interns_${timestamp}.csv`;
    } else {
      content = JSON.stringify(interns.map(s => ({ name: s.name, email: s.email, sp: s.sp_points ?? s.reputation, is_frozen: s.is_frozen, watchlist_entries: s.watchlist_entries || 0, open_anomalies: s.open_anomalies || 0, created_at: s.created_at })), null, 2);
      mimeType = 'application/json'; filename = `interns_${timestamp}.json`;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setExporting(false); onClose();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.75rem', width: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>📤 Export Interns</h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Export {interns.length} intern{interns.length !== 1 ? 's' : ''} to file.</p>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[['csv', 'CSV Spreadsheet'], ['json', 'JSON']].map(([v, label]) => (
            <button key={v} onClick={() => setFormat(v)} style={{ flex: 1, padding: '0.75rem', borderRadius: 8, border: `2px solid ${format === v ? '#3b82f6' : '#e2e8f0'}`, background: format === v ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: format === v ? '#1d4ed8' : '#64748b' }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={handleExport} disabled={exporting} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: exporting ? 0.7 : 1 }}>{exporting ? 'Preparing…' : `Download ${format.toUpperCase()}`}</button>
        </div>
      </div>
    </div>
  );
}

function FreezeModal({ target, onClose, onAction, freezing }) {
  if (!target) return null;
  const isUnfreeze = target.is_frozen;
  return (
    <Modal onClose={onClose} title={isUnfreeze ? '❄️ Unfreeze Account' : '🥶 Freeze Account'}>
      <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        {isUnfreeze
          ? <>Unfreezing <strong>{target.name}</strong> will allow them to earn and spend SP again. Continue?</>
          : <>Freezing <strong>{target.name}</strong> will suspend their SP earning and spending. An audit log will be recorded. Continue?</>}
      </p>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={freezing} style={{ padding: '0.45rem 1rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: '0.82rem', cursor: 'pointer', color: '#475569' }}>Cancel</button>
        <button disabled={freezing} onClick={onAction}
          style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: freezing ? 'not-allowed' : 'pointer',
            opacity: freezing ? 0.6 : 1,
            background: isUnfreeze ? '#10b981' : '#ef4444', color: '#fff' }}>
          {freezing ? '…' : isUnfreeze ? 'Unfreeze' : 'Freeze'}
        </button>
      </div>
    </Modal>
  );
}

function AdjustModal({ target, onClose, onAction, adjusting, adjustError }) {
  if (!target) return null;
  const delta  = Number(pendingDelta);
  const valid  = !isNaN(delta) && delta !== 0 && Math.abs(delta) <= 1000;

  const handleSubmit = e => {
    e.preventDefault();
    if (!valid || !pendingReason.trim()) return;
    onAction(delta, pendingReason.trim());
  };

  return (
    <Modal onClose={onClose} title={`⚖️ Adjust SP — ${target.name}`}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>Current SP Balance</label>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6' }}>{target.sp_points} SP</span>
        </div>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>Points Delta <span style={{ color: '#ef4444' }}>*</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="number" value={pendingDelta} onChange={e => { setPendingDelta(e.target.value); setAdjustError(''); }}
              placeholder="e.g. -50 or +100"
              min="-1000" max="1000" step="1"
              style={{ flex: 1, padding: '0.45rem 0.6rem', border: `1px solid ${adjustError && !valid ? '#ef4444' : '#e2e8f0'}`, borderRadius: 6, fontSize: '0.82rem' }} />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>|delta| ≤ 1000</span>
          </div>
          {!isNaN(delta) && delta !== 0 && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', fontWeight: 600, color: delta > 0 ? '#10b981' : '#ef4444' }}>
              → New balance: <strong>{target.sp_points + delta} SP</strong>
            </div>
          )}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
          <textarea value={pendingReason} onChange={e => setPendingReason(e.target.value)}
            placeholder="Explain why this adjustment is being made…"
            rows={3}
            style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        {adjustError && <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: '0.78rem' }}>{adjustError}</div>}
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={adjusting} style={{ padding: '0.45rem 1rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: '0.82rem', cursor: 'pointer', color: '#475569' }}>Cancel</button>
          <button type="submit" disabled={adjusting || !valid || !pendingReason.trim()}
            style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: (adjusting || !valid || !pendingReason.trim()) ? 'not-allowed' : 'pointer',
              opacity: (adjusting || !valid || !pendingReason.trim()) ? 0.5 : 1, background: '#7c3aed', color: '#fff' }}>
            {adjusting ? 'Saving…' : 'Apply Adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function InternManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';

  const [overview, setOverview]       = useState(null);
  const [interns, setInterns]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [search, setSearch]           = useState('');
  const [frozen, setFrozen]           = useState('');
  const [exportTarget, setExportTarget] = useState(null); // null = closed, [] = all students
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [freezeTarget, setFreezeTarget]  = useState(null); // { id, name, is_frozen }
  const [adjustTarget, setAdjustTarget]  = useState(null); // { id, name, sp_points }
  const [pendingDelta, setPendingDelta]  = useState('');
  const [pendingReason, setPendingReason]= useState('');
  const [adjustError, setAdjustError]    = useState('');
  const [adjusting, setAdjusting]        = useState(false);
  const [freezing, setFreezing]          = useState(false);

  // ── Fetch overview ──────────────────────────────────────────────────────────
  useEffect(() => {
    getInternOverview()
      .then(setOverview)
      .catch(() => {});
  }, []);

  // ── Fetch intern list ───────────────────────────────────────────────────────
  const fetchInterns = (pg = 1, opts = {}) => {
    setLoading(true);
    getInterns({
      page: pg,
      search: opts.search !== undefined ? opts.search : search,
      is_frozen: opts.frozen !== undefined ? opts.frozen : frozen,
      on_watchlist: opts.watchlistOnly !== undefined ? opts.watchlistOnly : watchlistOnly,
    })
      .then(data => {
        setInterns(data.interns);
        setTotalPages(data.totalPages);
        setPage(data.page);
      })
      .catch(() => setError('Failed to load interns'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInterns(1); }, [frozen, watchlistOnly]);

  const applyFilters = () => fetchInterns(1, { search, frozen, watchlistOnly });
  const goPage = p => { setPage(p); fetchInterns(p); };

  // ── Freeze / Unfreeze ────────────────────────────────────────────────────────
  const handleFreezeConfirm = () => {
    if (!freezeTarget || freezing) return;
    setFreezing(true);
    const fn = freezeTarget.is_frozen ? unfreezeIntern : freezeIntern;
    fn(freezeTarget.id)
      .then(() => {
        setFreezeTarget(null);
        fetchInterns(page);
        getInternOverview().then(setOverview).catch(() => {});
      })
      .catch(() => setError('Action failed. Please try again.'))
      .finally(() => setFreezing(false));
  };

  // ── SP Adjustment ───────────────────────────────────────────────────────────
  const handleAdjust = (delta, reason) => {
    if (!adjustTarget || adjusting) return;
    setAdjusting(true);
    setAdjustError('');
    adjustIntern(adjustTarget.id, { points_delta: delta, reason })
      .then(() => {
        setAdjustTarget(null);
        setPendingDelta('');
        setPendingReason('');
        fetchInterns(page);
        getInternOverview().then(setOverview).catch(() => {});
      })
      .catch(err => {
        setAdjustError(err?.message || 'Adjustment failed. Check limits and frozen status.');
      })
      .finally(() => setAdjusting(false));
  };

  const setTab = t => setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', t); return n; });

  // ── SP Distribution bar ─────────────────────────────────────────────────────
  const renderDistBar = () => {
    if (!overview?.distribution?.length) return null;
    const total = overview.distribution.reduce((s, b) => s + b.count, 0) || 1;
    return (
      <div style={{ marginTop: '0.75rem' }}>
        {overview.distribution.map(b => (
          <div key={b.bucket} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
            <span style={{ width: 70, fontSize: '0.7rem', color: '#64748b' }}>{b.bucket}</span>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 3, height: 12 }}>
              <div style={{ width: `${Math.round((b.count / total) * 100)}%`, background: '#3b82f6', borderRadius: 3, height: 12, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', width: 28, textAlign: 'right' }}>{b.count}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>🎓 Intern SP Management</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setExportTarget(interns || [])} style={{ padding: '0.35rem 0.85rem', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}>📤 Export</button>
          {['overview', 'interns', 'ledger', 'watchlist', 'anomalies'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.35rem 0.85rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
              background: tab === t ? '#3b82f6' : '#e2e8f0', color: tab === t ? '#fff' : '#475569',
            }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          {!overview ? <div style={{ color: '#94a3b8' }}>Loading overview…</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Total Interns',   value: overview.totalInterns,   icon: '👥', color: '#6366f1' },
                  { label: 'Active (7d)',    value: overview.activeLast7Days, icon: '🟢', color: '#10b981' },
                  { label: 'Frozen',         value: overview.frozenCount,    icon: '❄️', color: '#06b6d4' },
                  { label: 'On Watchlist',   value: overview.onWatchlist,    icon: '👁️', color: '#f59e0b' },
                  { label: 'Open Anomalies', value: overview.openAnomalies,  icon: '🚨', color: '#ef4444' },
                ].map(c => (
                  <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{c.icon}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>SP Distribution</h3>
                  {renderDistBar()}
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>Top Earners</h3>
                  {overview.topEarners?.map(u => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.8rem', color: '#334155' }}>{u.name}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6' }}>{u.sp_points ?? u.reputation} SP</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Interns tab ──────────────────────────────────────────────────── */}
      {tab === 'interns' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilters()}
              placeholder="Search by name or email…" style={{ flex: 1, minWidth: 200, padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem' }} />
            <select value={frozen} onChange={e => setFrozen(e.target.value)} style={{ padding: '0.45rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem' }}>
              <option value="">All accounts</option>
              <option value="true">Frozen only</option>
              <option value="false">Active only</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#475569' }}>
              <input type="checkbox" checked={watchlistOnly} onChange={e => setWatchlistOnly(e.target.checked)} />
              Watchlist only
            </label>
            <button onClick={applyFilters} style={{ padding: '0.45rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>Search</button>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>❌ {error}</div>
            ) : !interns?.length ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No interns found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Name', 'Email', 'SP', 'Status', 'Watchlist', 'Anomalies', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interns.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500, color: '#1e293b' }}>{s.name}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>{s.email}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#3b82f6' }}>{s.sp_points ?? s.reputation}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {s.is_frozen ? (
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 500 }}>❄️ Frozen</span>
                        ) : (
                          <span style={{ background: '#f0fdf4', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 500 }}>🟢 Active</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{s.watchlist_entries > 0 ? `👁️ ${s.watchlist_entries}` : '—'}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {s.open_anomalies > 0 ? (
                          <span
                            onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', 'anomalies'); n.set('anomalyStudent', s.id); return n; })}
                            title={`${s.open_anomalies} open anomaly${s.open_anomalies !== 1 ? 's' : ''} — click to view`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              background: s.open_anomalies >= 3 ? '#fef2f2' : s.open_anomalies === 1 || s.open_anomalies === 2 ? '#fffbeb' : '#f0fdf4',
                              color:       s.open_anomalies >= 3 ? '#dc2626' : s.open_anomalies === 1 || s.open_anomalies === 2 ? '#d97706' : '#16a34a',
                              padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                            {s.open_anomalies}
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>{timeAgo(s.created_at)}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <button
                          onClick={() => { setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', 'ledger'); n.set('ledgerStudent', s.id); n.delete('ledgerPage'); return n; }); }}
                          style={{ padding: '0.25rem 0.6rem', background: '#f1f5f9', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', marginRight: 4 }}
                        >Ledger</button>
                        {s.is_frozen ? (
                          <button onClick={() => setFreezeTarget({ id: s.id, name: s.name, is_frozen: true })}
                          style={{ padding: '0.25rem 0.6rem', background: '#f0fdf4', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#15803d' }}>Unfreeze</button>
                        ) : (
                          <button onClick={() => setFreezeTarget({ id: s.id, name: s.name, is_frozen: false })}
                          style={{ padding: '0.25rem 0.6rem', background: '#fef2f2', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626' }}>Freeze</button>
                        )}
                        <button onClick={() => setAdjustTarget({ id: s.id, name: s.name, sp_points: s.sp_points ?? s.reputation })}
                          style={{ padding: '0.25rem 0.6rem', background: '#ede9fe', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#7c3aed' }}>Adjust SP</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button disabled={page <= 1} onClick={() => goPage(page - 1)} style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>‹ Prev</button>
              <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => goPage(page + 1)} style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Next ›</button>
            </div>
          )}
        </div>
      )}

      {/* ── Ledger tab ─────────────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <LedgerTab searchParams={searchParams} setSearchParams={setSearchParams} />
      )}

      {/* ── Watchlist tab ────────────────────────────────────────────────── */}
      {tab === 'watchlist' && (
        <WatchlistTab searchParams={searchParams} setSearchParams={setSearchParams} />
      )}

      {/* ── Anomalies tab ────────────────────────────────────────────────── */}
      {tab === 'anomalies' && (
        <AnomaliesTab searchParams={searchParams} setSearchParams={setSearchParams} />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ExportModal students={exportTarget} onClose={() => setExportTarget(null)} />
      <FreezeModal
        target={freezeTarget}
        onClose={() => { setFreezeTarget(null); setError(null); }}
        onAction={handleFreezeConfirm}
        freezing={freezing}
      />
      <AdjustModal
        target={adjustTarget}
        onClose={() => { setAdjustTarget(null); setPendingDelta(''); setPendingReason(''); setAdjustError(''); }}
        onAction={handleAdjust}
        adjusting={adjusting}
        adjustError={adjustError}
      />
    </div>
  );
}