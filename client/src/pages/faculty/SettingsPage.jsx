import { useState, useEffect } from 'react';
import { getSettings, updateSettings, resetSettings, getFacultyList, updateFacultyRole } from '../../api/faculty.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBool(v) { return v === true || v === 'true'; }

function Section({ title, children, action }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, description, children, error }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{label}</div>
        {description && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{description}</div>}
        {error && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{error}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? '#3b82f6' : '#e2e8f0',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        background: '#fff',
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, disabled, suffix }) {
  const [local, setLocal] = useState(String(value ?? ''));
  useEffect(() => { setLocal(String(value ?? '')); }, [value]);

  const handleBlur = () => {
    const n = Number(local);
    if (!isNaN(n)) {
      const clamped = Math.min(Math.max(n, min ?? 0), max ?? Infinity);
      onChange(clamped);
      setLocal(String(clamped));
    } else {
      setLocal(String(value ?? ''));
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        value={local}
        min={min} max={max} step={step}
        disabled={disabled}
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        style={{
          width: 72, padding: '0.35rem 0.5rem',
          border: '1px solid #e2e8f0', borderRadius: 6,
          fontSize: '0.875rem', color: '#1e293b',
          background: disabled ? '#f8fafc' : '#fff',
          textAlign: 'center',
        }}
      />
      {suffix && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{suffix}</span>}
    </div>
  );
}

function Select({ value, onChange, options, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: '0.35rem 0.6rem',
        border: '1px solid #e2e8f0', borderRadius: 6,
        fontSize: '0.875rem', color: '#1e293b',
        background: disabled ? '#f8fafc' : '#fff',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SaveButton({ onClick, loading, dirty }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || !dirty}
      style={{
        padding: '0.45rem 1rem',
        background: dirty ? '#3b82f6' : '#e2e8f0',
        color: dirty ? '#fff' : '#94a3b8',
        border: 'none', borderRadius: 6,
        fontSize: '0.8rem', fontWeight: 600,
        cursor: dirty ? 'pointer' : 'not-allowed',
        transition: 'background 0.2s',
      }}
    >
      {loading ? 'Saving…' : dirty ? '💾 Save Changes' : 'Saved'}
    </button>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{
      padding: '0.1rem 0.5rem', borderRadius: 10,
      fontSize: '0.7rem', fontWeight: 600,
      background: (color || '#64748b') + '18',
      color: color || '#64748b',
    }}>
      {children}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errors, setErrors]     = useState({});
  const [toast, setToast]       = useState('');
  const [faculty, setFaculty]   = useState([]);
  const [dirtyCount, setDirtyCount] = useState(0);

  // Dirty tracking
  const isDirty = (key) => String(settings[key]) !== String(saved[key]);

  useEffect(() => {
    Promise.all([
      getSettings().catch(() => null),
      getFacultyList().catch(() => null),
    ]).then(([setRes, facRes]) => {
      if (!setRes) {
        setErrors({ _form: 'Failed to load settings.' });
        return;
      }
      const s = setRes.settings || {};
      setSettings(s);
      setSaved({ ...s });
      if (facRes) setFaculty(facRes.faculty || []);
    }).finally(() => setLoading(false));
  }, []);

  const set = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirtyCount(prev => {
      const wasDirty = String(settings[key]) !== String(saved[key]);
      const nowDirty = String(value) !== String(saved[key]);
      return nowDirty ? prev + (wasDirty ? 0 : 1) : prev - (wasDirty ? 1 : 0);
    });
  };

  const handleSave = async () => {
    if (dirtyCount === 0) return;
    const patches = {};
    for (const [k, v] of Object.entries(settings)) {
      if (String(v) !== String(saved[k])) patches[k] = v;
    }
    setSaving(true);
    setErrors({});
    try {
      const res = await updateSettings(patches);
      if (res.errors?.length) {
        const errMap = {};
        res.errors.forEach(e => {
          const key = e.split(':')[0];
          errMap[key] = e;
        });
        setErrors(errMap);
        setToast('Some settings had validation errors.');
      } else {
        setSaved({ ...settings });
        setDirtyCount(0);
        setToast('Settings saved successfully.');
      }
    } catch (e) {
      setToast(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
    setTimeout(() => setToast(''), 3000);
  };

  const handleReset = async () => {
    if (!confirm('Reset ALL settings to defaults? This cannot be undone.')) return;
    setResetting(true);
    try {
      const res = await resetSettings();
      const s = res.settings || {};
      setSettings(s);
      setSaved({ ...s });
      setDirtyCount(0);
      setToast('All settings reset to defaults.');
    } catch (e) {
      setToast(`Reset failed: ${e.message}`);
    } finally {
      setResetting(false);
    }
    setTimeout(() => setToast(''), 3000);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateFacultyRole(userId, newRole);
      setFaculty(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setToast('Role updated.');
    } catch (e) {
      setToast(`Role update failed: ${e.message}`);
    }
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
        Loading settings…
      </div>
    );
  }

  const ROLE_OPTIONS = [
    { value: 'intern', label: 'Intern' },
    { value: 'verified', label: 'Verified' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'admin', label: 'Admin' },
  ];

  const REVIEW_ASSIGN_OPTIONS = [
    { value: 'round_robin', label: 'Round Robin' },
    { value: 'load_balanced', label: 'Load Balanced' },
    { value: 'random', label: 'Random' },
  ];

  const ROLE_COLORS = { admin: '#ef4444', faculty: '#3b82f6', verified: '#10b981', intern: '#94a3b8' };

  return (
    <div style={{ padding: '2rem', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>⚙️ Settings</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Configure platform thresholds, review workflow, moderation, SP rules, and notifications.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <SaveButton onClick={handleSave} loading={saving} dirty={dirtyCount > 0} />
          <button
            onClick={handleReset}
            disabled={resetting}
            style={{ padding: '0.45rem 0.8rem', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {resetting ? 'Resetting…' : '↺ Reset to Defaults'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.includes('failed') || toast.includes('error') || toast.includes('Validation')
            ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toast.includes('fail') ? '#fecaca' : '#bbf7d0'}`,
          color: toast.includes('fail') ? '#dc2626' : '#16a34a',
          padding: '0.75rem 1rem', borderRadius: 8,
          fontSize: '0.85rem', zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {toast}
        </div>
      )}

      {/* Global error */}
      {errors._form && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
          ❌ {errors._form}
        </div>
      )}

      {/* ── Review Thresholds ─────────────────────────────────────────────── */}
      <Section title="REVIEW THRESHOLDS">
        <Row
          label="Auto-promote threshold"
          description="Net upvotes needed to auto-promote a community post to review queue"
          error={errors.auto_promote_threshold}
        >
          <NumberInput value={settings.auto_promote_threshold} onChange={v => set('auto_promote_threshold', v)} min={1} max={100} />
        </Row>
        <Row
          label="Min SP to submit FAQ"
          description="Minimum student points required to submit a new FAQ"
          error={errors.min_sp_to_submit}
        >
          <NumberInput value={settings.min_sp_to_submit} onChange={v => set('min_sp_to_submit', v)} min={0} max={1000} suffix="SP" />
        </Row>
        <Row
          label="Min SP to answer"
          description="Minimum student points required to submit an answer"
          error={errors.min_sp_to_answer}
        >
          <NumberInput value={settings.min_sp_to_answer} onChange={v => set('min_sp_to_answer', v)} min={0} max={1000} suffix="SP" />
        </Row>
        <Row
          label="Min SP to vote"
          description="Minimum student points required to vote on content"
          error={errors.min_sp_to_vote}
        >
          <NumberInput value={settings.min_sp_to_vote} onChange={v => set('min_sp_to_vote', v)} min={0} max={1000} suffix="SP" />
        </Row>
        <Row
          label="Max questions per day"
          description="Maximum FAQs a student can submit per day"
          error={errors.max_questions_per_day}
        >
          <NumberInput value={settings.max_questions_per_day} onChange={v => set('max_questions_per_day', v)} min={1} max={100} />
        </Row>
      </Section>

      {/* ── Review Workflow ───────────────────────────────────────────────── */}
      <Section title="REVIEW WORKFLOW">
        <Row
          label="Assignment strategy"
          description="How reviews are distributed among faculty"
          error={errors.review_assignment}
        >
          <Select
            value={settings.review_assignment}
            onChange={v => set('review_assignment', v)}
            options={REVIEW_ASSIGN_OPTIONS}
          />
        </Row>
        <Row
          label="Require AI analysis"
          description="Force AI quality analysis before a FAQ enters review"
          error={errors.require_ai_analysis}
        >
          <Toggle
            value={toBool(settings.require_ai_analysis)}
            onChange={v => set('require_ai_analysis', v)}
          />
        </Row>
        <Row
          label="Require second review"
          description="A second faculty member must approve before publishing"
          error={errors.require_2nd_review}
        >
          <Toggle
            value={toBool(settings.require_2nd_review)}
            onChange={v => set('require_2nd_review', v)}
          />
        </Row>
        <Row
          label="Max reviews per reviewer / day"
          description="Limit how many reviews one faculty can do in a single day"
          error={errors.max_reviews_per_reviewer_per_day}
        >
          <NumberInput value={settings.max_reviews_per_reviewer_per_day} onChange={v => set('max_reviews_per_reviewer_per_day', v)} min={1} max={100} />
        </Row>
      </Section>

      {/* ── Moderation ───────────────────────────────────────────────────── */}
      <Section title="MODERATION">
        <Row
          label="Auto-resolve flag threshold"
          description="Auto-resolve content after this many repeated flags from same user"
          error={errors.auto_resolve_flag_threshold}
        >
          <NumberInput value={settings.auto_resolve_flag_threshold} onChange={v => set('auto_resolve_flag_threshold', v)} min={1} max={20} />
        </Row>
        <Row
          label="Flag dismiss cooldown"
          description="Hours before the same user can flag the same content again"
          error={errors.flag_dismiss_cooldown_hours}
        >
          <NumberInput value={settings.flag_dismiss_cooldown_hours} onChange={v => set('flag_dismiss_cooldown_hours', v)} min={1} max={720} suffix="hrs" />
        </Row>
        <Row
          label="Flag review window"
          description="Hours before an open flag is escalated"
          error={errors.content_flag_review_hours}
        >
          <NumberInput value={settings.content_flag_review_hours} onChange={v => set('content_flag_review_hours', v)} min={1} max={720} suffix="hrs" />
        </Row>
        <Row
          label="Max flags per content item"
          description="Hard cap on how many flags a single piece of content can receive"
          error={errors.max_flags_per_content}
        >
          <NumberInput value={settings.max_flags_per_content} onChange={v => set('max_flags_per_content', v)} min={1} max={50} />
        </Row>
      </Section>

      {/* ── SP / Reputation ───────────────────────────────────────────────── */}
      <Section title="STUDENT POINTS (SP)">
        <Row
          label="SP per upvote received"
          description="Points awarded to content author when receiving an upvote"
          error={errors.sp_upvote_gain}
        >
          <NumberInput value={settings.sp_upvote_gain} onChange={v => set('sp_upvote_gain', v)} min={0} max={100} suffix="SP" />
        </Row>
        <Row
          label="SP lost per downvote"
          description="Points deducted from content author per downvote"
          error={errors.sp_downvote_loss}
        >
          <NumberInput value={settings.sp_downvote_loss} onChange={v => set('sp_downvote_loss', v)} min={0} max={50} suffix="SP" />
        </Row>
        <Row
          label="SP for accepted answer"
          description="Points awarded when your answer is accepted"
          error={errors.sp_accepted_answer}
        >
          <NumberInput value={settings.sp_accepted_answer} onChange={v => set('sp_accepted_answer', v)} min={0} max={100} suffix="SP" />
        </Row>
        <Row
          label="SP for published FAQ"
          description="Points awarded when your submitted FAQ is published"
          error={errors.sp_published_faq}
        >
          <NumberInput value={settings.sp_published_faq} onChange={v => set('sp_published_faq', v)} min={0} max={100} suffix="SP" />
        </Row>
        <Row
          label="SP penalty on rejection"
          description="Points deducted when a submitted FAQ is rejected"
          error={errors.sp_rejection_penalty}
        >
          <NumberInput value={settings.sp_rejection_penalty} onChange={v => set('sp_rejection_penalty', v)} min={0} max={50} suffix="SP" />
        </Row>
      </Section>

      {/* ── Quality ──────────────────────────────────────────────────────── */}
      <Section title="QUALITY GATES">
        <Row
          label="Min quality score to publish"
          description="FAQ must have at least this AI quality score to be published"
          error={errors.min_quality_score_publish}
        >
          <NumberInput value={settings.min_quality_score_publish} onChange={v => set('min_quality_score_publish', v)} min={0} max={100} suffix="%" />
        </Row>
        <Row
          label="AI confidence threshold"
          description="AI analysis must have at least this confidence to auto-approve"
          error={errors.ai_confidence_threshold}
        >
          <NumberInput value={settings.ai_confidence_threshold} onChange={v => set('ai_confidence_threshold', v)} min={0} max={100} suffix="%" />
        </Row>
      </Section>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <Section title="NOTIFICATIONS">
        <Row
          label="Notify on FAQ submission"
          description="Alert faculty when a new FAQ is submitted for review"
          error={errors.notify_on_submit}
        >
          <Toggle value={toBool(settings.notify_on_submit)} onChange={v => set('notify_on_submit', v)} />
        </Row>
        <Row
          label="Notify on review complete"
          description="Alert submitter when their FAQ is reviewed (published/rejected/changes)"
          error={errors.notify_on_review_complete}
        >
          <Toggle value={toBool(settings.notify_on_review_complete)} onChange={v => set('notify_on_review_complete', v)} />
        </Row>
        <Row
          label="Notify on flag raised"
          description="Alert faculty when any content flag is submitted"
          error={errors.notify_on_flag}
        >
          <Toggle value={toBool(settings.notify_on_flag)} onChange={v => set('notify_on_flag', v)} />
        </Row>
        <Row
          label="Notify on SP change"
          description="Alert users when their student points change"
          error={errors.notify_on_sp_change}
        >
          <Toggle value={toBool(settings.notify_on_sp_change)} onChange={v => set('notify_on_sp_change', v)} />
        </Row>
        <Row
          label="Notify on admin action"
          description="Notify faculty of administrative changes to users or content"
          error={errors.notify_on_admin_action}
        >
          <Toggle value={toBool(settings.notify_on_admin_action)} onChange={v => set('notify_on_admin_action', v)} />
        </Row>
      </Section>

      {/* ── Faculty Role Management ──────────────────────────────────────── */}
      <Section title="FACULTY & ROLE MANAGEMENT">
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
          {faculty.length} faculty/admin account{faculty.length !== 1 ? 's' : ''} · changes take effect immediately
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faculty.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              {/* Avatar placeholder */}
              <div style={{ width: 36, height: 36, borderRadius: 18, background: (ROLE_COLORS[u.role] || '#64748b') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                👤
              </div>
              {/* Name + email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{u.name || '—'}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.email}</div>
              </div>
              {/* Current role badge */}
              <Badge color={ROLE_COLORS[u.role]}>{u.role}</Badge>
              {/* Role selector */}
              <select
                value={u.role}
                onChange={e => handleRoleChange(u.id, e.target.value)}
                style={{ padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem', color: '#1e293b', background: '#fff' }}
              >
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {/* Reputation */}
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: 48, textAlign: 'right' }}>
                ⭐ {u.reputation ?? 0}
              </div>
            </div>
          ))}
          {faculty.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
              No faculty accounts found.
            </div>
          )}
        </div>
      </Section>

    </div>
  );
}