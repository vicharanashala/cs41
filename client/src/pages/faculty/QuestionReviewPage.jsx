import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuestion, getQuestionAnswers, getQuestionHistory, postReview, runAnalysis, getTags, applyTags, removeTag } from '../../api/faculty.js';

const STATUS_LABELS = {
  community: { label: 'Community', color: '#6366f1' },
  pending_review: { label: 'Pending Review', color: '#f59e0b' },
  published: { label: 'Published', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  changes_requested: { label: 'Changes Requested', color: '#8b5cf6' },
  merged: { label: 'Merged', color: '#1e293b' },
  unpublished: { label: 'Unpublished', color: '#1e293b' },
};

const ACTION_LABELS = {
  queued: '📋 Queued (auto)',
  published: '✅ Published',
  rejected: '❌ Rejected',
  changes_requested: '🔄 Changes Requested',
  unpublished: '📤 Unpublished',
  merged: '🔗 Merged',
  ai_analyzed: '🤖 AI Analyzed',
};

function formatTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelative(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function QuestionReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review action state
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisSuccess, setAnalysisSuccess] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  // Tag management state
  const [allTags, setAllTags] = useState([]);
  const [questionTags, setQuestionTags] = useState([]); // {id, name, color} from backend
  const [tagLoading, setTagLoading] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState('');
  const [tagMsg, setTagMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getQuestion(id).catch(e => ({ question: null, _err: e })),
      getQuestionAnswers(id).catch(e => ({ answers: [], _err: e })),
      getQuestionHistory(id).catch(e => ({ history: [], _err: e })),
    ]).then(([q, a, h]) => {
      if (q._err) { setError(q._err.response?.data?.error || 'Failed to load question'); }
      else { setQuestion(q.question); }
      setAnswers(a.answers ?? []);
      setHistory(h.history ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleReview = async () => {
    if (!action) { setError('Please select an action'); return; }
    setSubmitting(true);
    setError(null);
    setActionSuccess('');
    try {
      await postReview(id, { action, notes });
      setActionSuccess(`Question ${action} successfully.`);
      setTimeout(() => navigate('/faculty/queue'), 1200);
    } catch (e) {
      setError(e.response?.data?.error || 'Review action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysisSuccess('');
    setAnalysisResult(null);
    try {
      const result = await runAnalysis(id);
      setAnalysisResult(result);
      setAnalysisSuccess('AI analysis complete. Results shown below.');
      // Refresh question data so updated scores/topics reflect
      const [updated] = await Promise.all([getQuestion(id)]);
      setQuestion(updated.question);
    } catch (e) {
      setAnalysisError(e.response?.data?.error || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Load all tags + question's applied tags on mount
  useEffect(() => {
    setTagLoading(true);
    Promise.all([getTags(), getQuestion(id)])
      .then(([tagsRes, qRes]) => {
        setAllTags(tagsRes.tags || []);
        // question already fetched by parent useEffect; if we have it, extract tags
      })
      .catch(() => {})
      .finally(() => setTagLoading(false));
  }, [id]);

  // Sync questionTags when question loads (backend sends current tags)
  useEffect(() => {
    if (question?.tags && Array.isArray(question.tags)) {
      setQuestionTags(question.tags);
    }
  }, [question]);

  const handleApplyTag = async (tagId) => {
    if (!tagId) return;
    setTagSaving(true);
    setTagError('');
    setTagMsg('');
    try {
      const res = await applyTags(id, [tagId]);
      setQuestionTags(res.tags || []);
      setTagMsg('Tag applied.');
    } catch (e) {
      setTagError(e.response?.data?.error || 'Failed to apply tag.');
    } finally {
      setTagSaving(false);
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (!tagId) return;
    setTagSaving(true);
    setTagError('');
    setTagMsg('');
    try {
      await removeTag(id, tagId);
      setQuestionTags(prev => prev.filter(t => t.name !== tagId));
      setTagMsg('Tag removed.');
    } catch (e) {
      setTagError(e.response?.data?.error || 'Failed to remove tag.');
    } finally {
      setTagSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#1e293b' }}>Loading question...</div>;
  if (error && !question) return <div style={{ padding: '2rem', color: 'red' }}>❌ {error}</div>;
  if (!question) return null;

  const q = question;
  const statusInfo = STATUS_LABELS[q.faq_status] || { label: q.faq_status, color: '#1e293b' };

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back nav */}
      <Link to="/faculty/queue" style={{ color: '#1e293b', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: '1rem' }}>
        ← Back to Queue
      </Link>

      {/* Status banner */}
      <div style={{
        background: statusInfo.color + '15',
        border: `1px solid ${statusInfo.color}40`,
        borderRadius: 8, padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap',
      }}>
        <span style={{
          padding: '0.2rem 0.75rem', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
          background: statusInfo.color, color: '#fff',
        }}>
          {statusInfo.label}
        </span>
        {q.trigger && (
          <span style={{ fontSize: '0.8rem', color: '#1e293b' }}>
            {q.trigger?.event === 'upvote_threshold' ? '📈' : '🚩'} Triggered: <b>{q.trigger?.event || '—'}</b> at <b>{q.trigger?.upvotes ?? '—'}</b> upvotes · {formatRelative(q.trigger?.at)}
          </span>
        )}
        <span style={{ fontSize: '0.8rem', color: '#1e293b', marginLeft: 'auto' }}>
          ID: {q.id ? q.id.slice(0, 8) + '...' : '—'}
        </span>
      </div>

      {/* Engagement + meta row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { icon: '👍', value: q.upvotes, label: 'upvotes' },
          { icon: '👎', value: q.downvotes, label: 'downvotes' },
          { icon: '📊', value: q.score, label: 'score' },
          { icon: '👁', value: q.engagement?.views || 0, label: 'views' },
          { icon: '💬', value: q.engagement?.answerCount || 0, label: 'answers' },
          { icon: '👤', value: q.author_reputation, label: 'author SP' },
        ].map(m => (
          <div key={m.label} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '0.5rem 1rem', textAlign: 'center', minWidth: 70,
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{m.value ?? 0}</div>
            <div style={{ fontSize: '0.7rem', color: '#1e293b' }}>{m.icon} {m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left column: question + answers + history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Question */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '0.5rem' }}>QUESTION</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', lineHeight: 1.4 }}>{q.title || 'Untitled Question'}</h1>
            <div style={{ fontSize: '0.875rem', color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{q.description || '—'}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {questionTags.map(t => (
                <span
                  key={t.name}
                  style={{
                    padding: '0.2rem 0.6rem',
                    background: (t.color || '#6366f1') + '20',
                    color: t.color || '#6366f1',
                    border: `1px solid ${t.color || '#6366f1'}40`,
                    borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                  }}
                >
                  {t.name}
                  <button
                    onClick={() => handleRemoveTag(t.name)}
                    disabled={tagSaving}
                    style={{
                      marginLeft: '0.35rem', background: 'none', border: 'none',
                      color: (t.color || '#6366f1') + '99', cursor: tagSaving ? 'not-allowed' : 'pointer',
                      fontSize: '0.7rem', padding: 0, lineHeight: 1,
                    }}
                    title="Remove tag"
                  >
                    ×
                  </button>
                </span>
              ))}
              {questionTags.length === 0 && q.tags?.map(t => (
                t?.name ? <span key={t.name} style={{ padding: '0.2rem 0.6rem', background: '#f1f5f9', borderRadius: 4, fontSize: '0.75rem', color: '#1e293b' }}>#{t.name}</span> : null
              ))}
            </div>

            {/* Tag management: apply more tags */}
            {tagLoading ? (
              <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: '0.625rem' }}>Loading tags…</div>
            ) : (
              <div style={{ marginTop: '0.75rem' }}>
                {tagError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '0.3rem 0.6rem', color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                    ❌ {tagError}
                  </div>
                )}
                {tagMsg && !tagError && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '0.3rem 0.6rem', color: '#16a34a', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                    ✅ {tagMsg}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '0.35rem' }}>Apply tag:</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {allTags
                    .filter(t => t.name && !questionTags.find(qt => qt.name === t.name))
                    .map(t => (
                      <button
                        key={t.name}
                        onClick={() => handleApplyTag(t.name)}
                        disabled={tagSaving}
                        style={{
                          padding: '0.2rem 0.5rem',
                          background: (t.color || '#6366f1') + '15',
                          color: t.color || '#6366f1',
                          border: `1px solid ${t.color || '#6366f1'}40`,
                          borderRadius: 4, fontSize: '0.7rem', cursor: tagSaving ? 'not-allowed' : 'pointer',
                        }}
                        title={t.description || t.name}
                      >
                        + {t.name}
                      </button>
                    ))}
                  {allTags.filter(t => t.name && !questionTags.find(qt => qt.name === t.name)).length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#1e293b', fontStyle: 'italic' }}>All tags applied</span>
                  )}
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#1e293b', marginTop: '1rem' }}>
              Asked by <b>{q.author_name}</b> · {q.category} · {formatTime(q.created_at && q.created_at * 1000 || q.created_at)}
            </div>
          </div>

          {/* Answers */}
          {Array.isArray(answers) && answers.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '1rem' }}>ANSWERS ({answers.length})</div>
              {answers.map((a, i) => (
                <div key={a.id} style={{ marginBottom: i < answers.length - 1 ? '1.25rem' : 0, paddingBottom: i < answers.length - 1 ? '1.25rem' : 0, borderBottom: i < answers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    {a.is_accepted === 1 && <span style={{ fontSize: '0.75rem', background: '#10b98122', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: 4 }}>✓ Accepted</span>}
                    <span style={{ fontSize: '0.75rem', color: '#1e293b' }}>👤 {a.author_name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#1e293b' }}>👍 {a.upvotes} 👎 {a.downvotes}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{a.content}</div>
                </div>
              ))}
            </div>
          )}

          {/* AI Analysis */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#1e293b' }}>AI ANALYSIS</div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                style={{
                  padding: '0.4rem 1rem',
                  background: analyzing ? '#1e293b' : '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {analyzing ? '⏳ Analyzing…' : '🤖 Run AI Analysis'}
              </button>
            </div>

            {analysisError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.625rem 0.875rem', color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                ❌ {analysisError}
              </div>
            )}

            {analysisSuccess && analysisResult && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '0.625rem 0.875rem', color: '#16a34a', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                ✅ {analysisSuccess}
              </div>
            )}

            {analyzing && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#1e293b', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🧠</div>
                Processing question with AI analysis…
              </div>
            )}

            {!analyzing && analysisResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Quality score */}
                {analysisResult.quality_score != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#1e293b', minWidth: 90 }}>Quality</span>
                    <div style={{ flex: 1, height: 8, background: '#cbd5e1', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.round(analysisResult.quality_score)}%`,
                        height: '100%',
                        background: analysisResult.quality_score >= 70 ? '#10b981' : analysisResult.quality_score >= 40 ? '#f59e0b' : '#ef4444',
                        borderRadius: 4,
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', minWidth: 36 }}>{analysisResult.quality_score}%</span>
                  </div>
                )}

                {/* Spam score */}
                {analysisResult.spam_score != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#1e293b', minWidth: 90 }}>Spam Risk</span>
                    <div style={{ flex: 1, height: 8, background: '#cbd5e1', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.round(analysisResult.spam_score)}%`,
                        height: '100%',
                        background: analysisResult.spam_score < 30 ? '#10b981' : analysisResult.spam_score < 60 ? '#f59e0b' : '#ef4444',
                        borderRadius: 4,
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', minWidth: 36 }}>{analysisResult.spam_score}%</span>
                  </div>
                )}

                {/* Detected topics/tags */}
                {analysisResult.detected_topics?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#1e293b', display: 'block', marginBottom: '0.4rem' }}>Detected Topics</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {analysisResult.detected_topics.map(t => (
                        <span key={t} style={{ padding: '0.2rem 0.6rem', background: '#ede9fe', color: '#5b21b6', borderRadius: 4, fontSize: '0.75rem' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested tags */}
                {analysisResult.suggested_tags?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#1e293b', display: 'block', marginBottom: '0.4rem' }}>Suggested Tags</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {analysisResult.suggested_tags.map(t => (
                        <span key={t} style={{ padding: '0.2rem 0.6rem', background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: '0.75rem' }}>+ {t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary / recommendation */}
                {analysisResult.summary && (
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 6, fontSize: '0.8rem', color: '#1e293b', lineHeight: 1.6 }}>
                    {analysisResult.summary}
                  </div>
                )}
              </div>
            )}

            {!analyzing && !analysisResult && (
              <div style={{ color: '#1e293b', fontSize: '0.8rem' }}>
                Click "Run AI Analysis" to assess question quality, spam risk, and topic detection.
              </div>
            )}
          </div>

          {/* Review history */}
          {Array.isArray(history) && history.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '1rem' }}>REVIEW HISTORY ({history.length})</div>
              {history.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: i < history.length - 1 ? '0.875rem' : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', marginTop: 5 }} />
                    {i < history.length - 1 && <div style={{ width: 1, flex: 1, background: '#cbd5e1', marginTop: 3 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                      {ACTION_LABELS[h.action] || h.action}
                      {h.reviewed_by === 'system' && <span style={{ fontSize: '0.7rem', color: '#1e293b', marginLeft: 4 }}>(automated)</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#1e293b' }}>{h.reviewed_by_name || h.reviewed_by} · {formatRelative(h.created_at)}</div>
                    {h.notes && <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '0.2rem', fontStyle: 'italic' }}>{h.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: review action panel */}
        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '0.7rem', color: '#1e293b', marginBottom: '1rem', letterSpacing: '0.05em' }}>REVIEW ACTION</div>

            {actionSuccess && (
              <div style={{ background: '#10b98115', border: '1px solid #10b98140', borderRadius: 6, padding: '0.75rem', color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>
                ✅ {actionSuccess}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {[
                { val: 'published', label: '✅ Publish as FAQ', color: '#10b981' },
                { val: 'rejected', label: '❌ Reject', color: '#ef4444' },
                { val: 'changes_requested', label: '🔄 Request Changes', color: '#8b5cf6' },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setAction(opt.val)}
                  style={{
                    padding: '0.625rem 1rem',
                    background: action === opt.val ? opt.color : '#f8fafc',
                    color: action === opt.val ? '#fff' : '#1e293b',
                    border: `1px solid ${action === opt.val ? opt.color : '#cbd5e1'}`,
                    borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer',
                    textAlign: 'left', fontWeight: action === opt.val ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes for the intern..."
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '0.625rem',
                border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.85rem',
                resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.875rem',
              }}
            />

            {error && (
              <div style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: 6, padding: '0.5rem 0.75rem', color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleReview}
              disabled={!action || submitting}
              style={{
                width: '100%', padding: '0.75rem',
                background: action ? '#3b82f6' : '#cbd5e1',
                color: action ? '#fff' : '#1e293b',
                border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600,
                cursor: action && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}