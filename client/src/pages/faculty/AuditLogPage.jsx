import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAuditLog } from '../../api/faculty.js';

// ── Action classification ───────────────────────────────────────────────────

const ACTION_CONFIG = {
  'faq':          { label: 'FAQ / Question', color: '#3b82f6', bg: '#eff6ff' },
  'tag':          { label: 'Tag',            color: '#8b5cf6', bg: '#f5f3ff' },
  'flag':         { label: 'Moderation',     color: '#f59e0b', bg: '#fffbeb' },
  'sp':           { label: 'Intern Points',  color: '#10b981', bg: '#f0fdf4' },
};

function getActionInfo(action) {
  if (!action) return { color: '#1e293b', bg: '#f8fafc', label: action };
  const prefix = action.split('.')[0];
  return ACTION_CONFIG[prefix] || { color: '#1e293b', bg: '#f8fafc', label: prefix };
}

function formatTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelative(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Entity type options ─────────────────────────────────────────────────────

const ENTITY_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'question', label: 'Question' },
  { value: 'faq_tag', label: 'Tag' },
  { value: 'content_flag', label: 'Content Flag' },
  { value: 'user', label: 'User / Intern' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'faq.', label: 'FAQ Actions' },
  { value: 'tag.', label: 'Tag Actions' },
  { value: 'flag.', label: 'Moderation Actions' },
  { value: 'sp.', label: 'Intern Points' },
];

const LIMIT_OPTIONS = [
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

// ── AuditRow component ──────────────────────────────────────────────────────

function AuditRow({ entry, expanded, onToggle }) {
  const info = getActionInfo(entry.action);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Main row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.875rem',
          padding: '0.875rem 1rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Timeline dot */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: info.color,
          marginTop: 5, flexShrink: 0,
          boxShadow: `0 0 0 3px ${info.bg}`,
        }} />

        {/* Time */}
        <div style={{ minWidth: 72, flexShrink: 0 }}>
          <div style={{ fontSize: '0.8rem', color: '#1e293b' }} title={formatTime(entry.created_at)}>
            {formatRelative(entry.created_at)}
          </div>
        </div>

        {/* Actor */}
        <div style={{ minWidth: 100, flexShrink: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
            {entry.actor_name || entry.actor_id?.slice(0, 8) || '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#1e293b' }}>actor</div>
        </div>

        {/* Action badge */}
        <div style={{ flexShrink: 0 }}>
          <span style={{
            padding: '0.2rem 0.55rem',
            background: info.bg,
            color: info.color,
            borderRadius: 4,
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            {entry.action}
          </span>
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.details || <span style={{ color: '#1e293b', fontStyle: 'italic' }}>No details</span>}
          </div>
        </div>

        {/* Entity type chip */}
        <div style={{ flexShrink: 0 }}>
          <span style={{
            padding: '0.15rem 0.5rem',
            background: '#f1f5f9',
            color: '#1e293b',
            borderRadius: 4,
            fontSize: '0.7rem',
          }}>
            {entry.entity_type}
          </span>
        </div>

        {/* Metadata indicator */}
        {entry.metadata && (
          <div style={{ flexShrink: 0, color: '#1e293b', fontSize: '0.8rem' }} title="Has metadata">
            📎
          </div>
        )}

        {/* Expand arrow */}
        <div style={{ color: '#1e293b', fontSize: '0.8rem', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f1f5f9',
          padding: '0.875rem 1rem',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}>
          {/* Full timestamp */}
          <div style={{ fontSize: '0.75rem', color: '#1e293b' }}>
            <b>Timestamp:</b> {formatTime(entry.created_at)} ({entry.created_at})
          </div>

          {/* Entity ID */}
          <div style={{ fontSize: '0.75rem', color: '#1e293b' }}>
            <b>Entity ID:</b>{' '}
            <code style={{ background: '#cbd5e1', padding: '0.1rem 0.3rem', borderRadius: 3, fontSize: '0.7rem' }}>
              {entry.entity_id}
            </code>
          </div>

          {/* Actor ID */}
          {entry.actor_id && (
            <div style={{ fontSize: '0.75rem', color: '#1e293b' }}>
              <b>Actor ID:</b>{' '}
              <code style={{ background: '#cbd5e1', padding: '0.1rem 0.3rem', borderRadius: 3, fontSize: '0.7rem' }}>
                {entry.actor_id}
              </code>
            </div>
          )}

          {/* Details if truncated */}
          {entry.details && (
            <div style={{ fontSize: '0.75rem', color: '#1e293b' }}>
              <b>Details:</b> {entry.details}
            </div>
          )}

          {/* Metadata JSON */}
          {entry.metadata && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#1e293b', marginBottom: '0.25rem' }}><b>Metadata:</b></div>
              <pre style={{
                background: '#1e293b',
                color: '#cbd5e1',
                padding: '0.75rem',
                borderRadius: 6,
                fontSize: '0.75rem',
                overflow: 'auto',
                margin: 0,
                maxHeight: 160,
              }}>
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, onChange }) {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
      <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>
        Page {page} of {totalPages} · {total} total entries
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          style={{
            padding: '0.35rem 0.65rem',
            background: page <= 1 ? '#f1f5f9' : '#fff',
            color: page <= 1 ? '#cbd5e1' : '#1e293b',
            border: '1px solid #e2e8f0',
            borderRadius: 5,
            fontSize: '0.8rem',
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          ←
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              padding: '0.35rem 0.65rem',
              background: p === page ? '#3b82f6' : '#fff',
              color: p === page ? '#fff' : '#1e293b',
              border: '1px solid',
              borderColor: p === page ? '#3b82f6' : '#cbd5e1',
              borderRadius: 5,
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: p === page ? 600 : 400,
            }}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: '0.35rem 0.65rem',
            background: page >= totalPages ? '#f1f5f9' : '#fff',
            color: page >= totalPages ? '#cbd5e1' : '#1e293b',
            border: '1px solid #e2e8f0',
            borderRadius: 5,
            fontSize: '0.8rem',
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const entityType = searchParams.get('entity_type') || '';
  const actionPrefix = searchParams.get('action') || '';
  const limit = searchParams.get('limit') || '50';
  const page = Number(searchParams.get('page') || '1');

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState(null);

  const fetchLog = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (entityType) params.entity_type = entityType;
    if (actionPrefix) params.action = actionPrefix;
    params.limit = limit;
    params.page = page;
    getAuditLog(params)
      .then(res => {
        setEntries(res.entries || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      })
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLog(); }, [entityType, actionPrefix, limit, page]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // reset to page 1 on filter change
    setSearchParams(next);
  };

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
          📋 Audit Log
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#1e293b' }}>
          Complete record of all faculty actions — question reviews, tag changes, SP adjustments, and moderation decisions.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}>
        {/* Entity type filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 600, letterSpacing: '0.04em' }}>ENTITY TYPE</label>
          <select
            value={entityType}
            onChange={e => setParam('entity_type', e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              color: '#1e293b',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Action prefix filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 600, letterSpacing: '0.04em' }}>ACTION TYPE</label>
          <select
            value={actionPrefix}
            onChange={e => setParam('action', e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              color: '#1e293b',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Per-page limit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 600, letterSpacing: '0.04em' }}>PER PAGE</label>
          <select
            value={limit}
            onChange={e => setParam('limit', e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              color: '#1e293b',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {LIMIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Clear filters */}
        {(entityType || actionPrefix) && (
          <button
            onClick={() => {
              const next = new URLSearchParams();
              next.set('limit', limit);
              next.set('page', '1');
              setSearchParams(next);
            }}
            style={{
              padding: '0.45rem 0.875rem',
              background: '#f1f5f9',
              color: '#1e293b',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: '0.8rem',
              cursor: 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            Clear filters ✕
          </button>
        )}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.875rem', alignItems: 'center', flexWrap: 'wrap', alignSelf: 'flex-end' }}>
          {Object.entries(ACTION_CONFIG).map(([key, v]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color }} />
              <span style={{ fontSize: '0.7rem', color: '#1e293b' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 6, padding: '0.75rem 1rem',
          color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#1e293b', fontSize: '0.9rem' }}>
          Loading audit log…
        </div>
      ) : entries.length === 0 ? (
        /* Empty state */
        <div style={{ textAlign: 'center', padding: '4rem', color: '#1e293b', fontSize: '0.9rem' }}>
          {(entityType || actionPrefix)
            ? 'No audit entries match the current filters.'
            : 'No audit entries recorded yet.'}
        </div>
      ) : (
        <>
          {/* Entry list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {entries.map(entry => (
              <AuditRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}