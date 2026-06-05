import { useState, useEffect } from 'react';
import { getTags, createTag, deleteTag } from '../../api/faculty.js';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#1e293b', '#1e293b',
];

const DEFAULT_PREVIEW = '#6366f1';

function TagRow({ tag, onDelete, deletingId }) {
  const isDeleting = deletingId === tag.id;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.875rem 1rem',
      background: '#fff',
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Color swatch */}
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: tag.color || DEFAULT_PREVIEW,
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{tag.name}</div>
        {tag.description && (
          <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tag.description}
          </div>
        )}
      </div>

      {/* Usage count */}
      <div style={{ textAlign: 'center', minWidth: 48 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{tag.usage_count ?? 0}</div>
        <div style={{ fontSize: '0.65rem', color: '#1e293b' }}>uses</div>
      </div>

      {/* Created by */}
      {tag.created_by_name && (
        <div style={{ minWidth: 80 }}>
          <div style={{ fontSize: '0.7rem', color: '#1e293b' }}>{tag.created_by_name}</div>
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(tag)}
        disabled={isDeleting}
        title="Delete tag"
        style={{
          width: 30, height: 30, borderRadius: 6,
          background: isDeleting ? '#fee2e2' : '#fef2f2',
          border: '1px solid',
          borderColor: isDeleting ? '#fecaca' : '#f1f5f9',
          color: '#ef4444',
          cursor: isDeleting ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {isDeleting ? '...' : '🗑'}
      </button>
    </div>
  );
}

export default function TagsManagementPage() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_PREVIEW);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // tag object

  // Filter
  const [search, setSearch] = useState('');

  const fetchTags = () => {
    setLoading(true);
    setError('');
    getTags()
      .then(res => setTags(res.tags || []))
      .catch(() => setError('Failed to load tags.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTags(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setCreateError('Tag name is required.'); return; }
    if (name.length > 40) { setCreateError('Tag name must be 40 characters or fewer.'); return; }

    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const res = await createTag({ name: name.trim(), color, description: description.trim() || undefined });
      setTags(prev => [res.tag, ...prev]);
      setName('');
      setDescription('');
      setColor(DEFAULT_PREVIEW);
      setCreateSuccess(`Tag "${res.tag.name}" created.`);
    } catch (e) {
      setCreateError(e.response?.data?.error || 'Failed to create tag.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (tag) => {
    setConfirmDelete(tag);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    setConfirmDelete(null);
    try {
      await deleteTag(confirmDelete.id);
      setTags(prev => prev.filter(t => t.id !== confirmDelete.id));
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete tag.');
      setDeletingId(null);
    }
  };

  const filtered = tags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>🏷 Tags Management</h1>
        <p style={{ fontSize: '0.85rem', color: '#1e293b' }}>Create and manage topic tags used to categorize FAQ questions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: tag list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Search + count bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tags…"
              style={{
                flex: 1, padding: '0.5rem 0.875rem',
                border: '1px solid #e2e8f0', borderRadius: 6,
                fontSize: '0.85rem', fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap' }}>
              {filtered.length} of {tags.length}
            </span>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem' }}>
              ❌ {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#1e293b', fontSize: '0.9rem' }}>
              Loading tags…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#1e293b', fontSize: '0.9rem' }}>
              {search ? `No tags match "${search}"` : 'No tags yet. Create one using the form.'}
            </div>
          ) : (
            filtered.map(tag => (
              <TagRow
                key={tag.id}
                tag={tag}
                onDelete={handleDeleteClick}
                deletingId={deletingId}
              />
            ))
          )}
        </div>

        {/* Right: create form (sticky) */}
        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <div style={{
            background: '#fff', borderRadius: 10, padding: '1.5rem',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '1rem', letterSpacing: '0.05em' }}>CREATE NEW TAG</div>

            {createSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '0.625rem 0.875rem', color: '#16a34a', fontSize: '0.8rem', marginBottom: '0.875rem' }}>
                ✅ {createSuccess}
              </div>
            )}

            {createError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.625rem 0.875rem', color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.875rem' }}>
                ❌ {createError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Tag name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#1e293b', marginBottom: '0.3rem' }}>Tag Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Admissions, Financial Aid"
                  maxLength={40}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e2e8f0', borderRadius: 6,
                    fontSize: '0.85rem', fontFamily: 'inherit',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#1e293b', textAlign: 'right', marginTop: 2 }}>{name.length}/40</div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#1e293b', marginBottom: '0.3rem' }}>Description (optional)</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short description…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e2e8f0', borderRadius: 6,
                    fontSize: '0.85rem', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Color picker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#1e293b', marginBottom: '0.4rem' }}>Color</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 24, height: 24, borderRadius: 5,
                        background: c,
                        border: color === c ? '2px solid #1e293b' : '2px solid transparent',
                        cursor: 'pointer',
                        boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px #1e293b' : 'none',
                        transition: 'box-shadow 0.1s',
                      }}
                    />
                  ))}
                </div>
                {/* Preview */}
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1e293b' }}>Preview:</div>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    background: color + '20',
                    color: color,
                    border: `1px solid ${color}50`,
                    borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {name || 'Tag name'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !name.trim()}
                style={{
                  padding: '0.625rem',
                  background: name.trim() && !creating ? '#3b82f6' : '#cbd5e1',
                  color: name.trim() && !creating ? '#fff' : '#1e293b',
                  border: 'none', borderRadius: 6,
                  fontSize: '0.875rem', fontWeight: 600,
                  cursor: name.trim() && !creating ? 'pointer' : 'not-allowed',
                }}
              >
                {creating ? 'Creating…' : '🏷 Create Tag'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '1.75rem',
            maxWidth: 380, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
              Delete tag "{confirmDelete.name}"?
            </div>
            <p style={{ fontSize: '0.875rem', color: '#1e293b', marginBottom: '1.25rem' }}>
              This will remove the tag from all {confirmDelete.usage_count ?? 0} question{confirmDelete.usage_count !== 1 ? 's' : ''} it's currently applied to. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1, padding: '0.625rem',
                  background: '#f1f5f9', color: '#1e293b',
                  border: '1px solid #e2e8f0', borderRadius: 6,
                  fontSize: '0.875rem', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  flex: 1, padding: '0.625rem',
                  background: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: 6,
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}