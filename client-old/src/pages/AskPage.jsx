import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, isAuthenticated } from '../utils/api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './AskPage.module.css';

const CATEGORIES = [
  'Interview Prep', 'Application Tips', 'Company Research',
  'Salary Negotiation', 'Visa & Relocation', 'Mental Health', 'General Advice',
];

export default function AskPage() {
  const navigate = useNavigate();
  const addToast = useToast();
  const [form, setForm] = useState({ title: '', category: '', description: '', tags: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) addToast('Sign in to ask a question', 'info');
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 15) e.title = 'Title must be at least 15 characters';
    if (!form.category) e.category = 'Please select a category';
    if (form.description.trim().length < 50) e.description = 'Description must be at least 50 characters';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const { question } = await api.createQuestion({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      addToast('Question posted!', 'success');
      navigate(`/question/${question.id}`);
    } catch (err) {
      addToast(err.message, 'error');
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="container">
        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={`page-header animate-in`}>
              <h1 className="page-title">Ask a Question</h1>
              <p className="page-subtitle">Share your internship question with the community</p>
            </div>

            <form onSubmit={handleSubmit} className={`glass ${styles.form} animate-in`}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className={`form-input ${errors.title ? styles.inputError : ''}`}
                  placeholder="e.g. How do I answer 'Tell me about yourself' in a tech interview?"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                />
                {errors.title && <span className="form-error">{errors.title}</span>}
                <span className="form-hint">Be specific — imagine you're asking a senior friend</span>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className={`form-select ${errors.category ? styles.inputError : ''}`}
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <span className="form-error">{errors.category}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className={`form-textarea ${errors.description ? styles.inputError : ''}`}
                  placeholder="Describe your question in detail. What have you tried? What specifically do you need help with?"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={8}
                />
                {errors.description && <span className="form-error">{errors.description}</span>}
                <span className="form-hint">Minimum 50 characters · Be descriptive</span>
              </div>

              <div className="form-group">
                <label className="form-label">Tags</label>
                <input
                  className="form-input"
                  placeholder="interview, salary, remote (comma-separated)"
                  value={form.tags}
                  onChange={e => set('tags', e.target.value)}
                />
                <span className="form-hint">Optional — helps others find your question</span>
              </div>

              <div className={styles.formActions}>
                <Link to="/" className="btn btn-ghost">Cancel</Link>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Posting…' : 'Post Question'}
                </button>
              </div>
            </form>
          </div>

          {/* Tips sidebar */}
          <aside className={styles.tips}>
            <div className={`glass ${styles.tipCard}`}>
              <h3 className={styles.tipTitle}>Writing a great question</h3>
              <ul className={styles.tipList}>
                <li>📍 <strong>Be specific</strong> — "my code doesn't work" is harder to answer than sharing the error</li>
                <li>📋 <strong>Provide context</strong> — What role are you targeting? What did you try already?</li>
                <li>🏷️ <strong>Tag it well</strong> — Good tags help the right people find your question</li>
                <li>💬 <strong>Proofread</strong> — Clear writing gets clearer answers</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}