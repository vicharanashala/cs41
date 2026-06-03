import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, CheckCircle, AlertCircle, Tag, X } from 'lucide-react';
import { submitFAQ } from '../api/faqs.js';

const CATEGORIES = [
  'Interview Prep',
  'Application Tips',
  'Company Research',
  'Salary Negotiation',
  'Visa & Relocation',
  'Mental Health',
  'General Advice',
];

const POPULAR_TAGS = [
  'interview', 'resume', 'salary', 'remote', 'offer',
  'negotiation', 'unpaid', 'J-1', 'networking', 'LinkedIn',
  'technical', 'system-design', 'behavioral', 'imposter-syndrome',
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function SubmitQuestionPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  // ── Validation ───────────────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.title.trim()) {
      e.title = 'Title is required.';
    } else if (form.title.trim().length < 15) {
      e.title = `Title must be at least 15 characters (${form.title.trim().length}/15).`;
    }
    if (!form.description.trim()) {
      e.description = 'Description is required.';
    } else if (form.description.trim().length < 30) {
      e.description = `Description must be at least 30 characters (${form.description.trim().length}/30).`;
    }
    if (!form.category) {
      e.category = 'Please select a category.';
    }
    return e;
  }

  // ── Tag helpers ──────────────────────────────────────────────────────────
  function addTag(tag) {
    const cleaned = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleaned) return;
    if (form.tags.includes(cleaned)) return;
    if (form.tags.length >= 5) return;
    setForm(f => ({ ...f, tags: [...f.tags, cleaned] }));
    setTagInput('');
  }

  function removeTag(tag) {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
      setForm(f => ({ ...f, tags: f.tags.slice(0, -1) }));
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to first error
      const first = Object.keys(validationErrors)[0];
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      await submitFAQ({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        tags: form.tags,
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Submission failed. Please try again.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function updateForm(field, value) {
    setErrors(Errors => ({ ...errors, [field]: undefined }));
    setForm(f => ({ ...f, [field]: value }));
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-10 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-accent" />
          </div>
          <h2 className="font-outfit text-2xl font-bold text-gray-100 mb-3">Submitted!</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Your question has been submitted and is now in the review queue. Our faculty will review it shortly. You'll be able to track it once it's published.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/faculty/queue" className="btn-primary w-full justify-center">
              View Review Queue
            </Link>
            <button onClick={() => navigate('/')} className="btn-secondary w-full justify-center">
              Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-12 pb-8">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[250px] bg-primary/6 rounded-full blur-[70px]" />
        </div>
        <div className="max-w-2xl mx-auto relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 mb-8 transition-colors"
          >
            <ArrowLeft size={14} /> Back to FAQs
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold mb-5">
              <Send size={11} /> Public Submission
            </div>
            <h1 className="font-outfit text-3xl sm:text-4xl font-extrabold text-gray-100 mb-2">
              Submit a Question
            </h1>
            <p className="text-gray-400 text-sm">
              Ask anything about the internship program. Submissions enter the review queue and are evaluated by faculty before publication.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="flex flex-col gap-6"
          noValidate
        >
          {/* Server error banner */}
          {serverError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warn/10 border border-warn/20">
              <AlertCircle size={16} className="text-warn flex-shrink-0 mt-0.5" />
              <p className="text-sm text-warn">{serverError}</p>
            </div>
          )}

          {/* Category */}
          <div id="field-category">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Category <span className="text-warn">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => updateForm('category', cat)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                    form.category === cat
                      ? 'bg-primary/10 border-primary/25 text-primary'
                      : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-xs text-warn mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} />{errors.category}
              </p>
            )}
          </div>

          {/* Title */}
          <div id="field-title">
            <label htmlFor="title" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Question Title <span className="text-warn">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={e => updateForm('title', e.target.value)}
              placeholder="e.g. How do I answer 'Tell me about yourself' in a tech interview?"
              className={`input-field ${errors.title ? 'border-warn focus:border-warn ring-2 ring-warn/10' : ''}`}
              maxLength={200}
            />
            <div className="flex items-start justify-between mt-1.5">
              {errors.title ? (
                <p className="text-xs text-warn flex items-center gap-1">
                  <AlertCircle size={11} />{errors.title}
                </p>
              ) : (
                <p className="text-xs text-gray-600">Be specific — imagine you're asking a senior student.</p>
              )}
              <span className={`text-[11px] ${form.title.length > 180 ? 'text-warn' : 'text-gray-600'}`}>
                {form.title.length}/200
              </span>
            </div>
          </div>

          {/* Description */}
          <div id="field-description">
            <label htmlFor="description" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Description <span className="text-warn">*</span>
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              placeholder="Provide context: What have you tried? What's your specific situation? What are you looking for?"
              className={`input-field resize-y min-h-[140px] leading-relaxed ${errors.description ? 'border-warn focus:border-warn ring-2 ring-warn/10' : ''}`}
              maxLength={2000}
            />
            <div className="flex items-start justify-between mt-1.5">
              {errors.description ? (
                <p className="text-xs text-warn flex items-center gap-1">
                  <AlertCircle size={11} />{errors.description}
                </p>
              ) : (
                <p className="text-xs text-gray-600">Include relevant background details.</p>
              )}
              <span className={`text-[11px] ${form.description.length > 1900 ? 'text-warn' : 'text-gray-600'}`}>
                {form.description.length}/2000
              </span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Tags <span className="text-gray-600 font-normal">(up to 5)</span>
            </label>

            {/* Tag input */}
            <div className="flex items-center flex-wrap gap-2 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl focus-within:border-primary/25 focus-within:bg-white/[0.04] transition-all mb-2.5">
              {form.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold"
                >
                  <Tag size={9} />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-warn transition-colors cursor-pointer ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              {form.tags.length < 5 && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={form.tags.length === 0 ? 'Type a tag and press Enter…' : ''}
                  className="bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none flex-1 min-w-[140px]"
                />
              )}
            </div>

            {/* Popular tag suggestions */}
            {form.tags.length < 5 && (
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-[10px] text-gray-600">Popular:</span>
                {POPULAR_TAGS.filter(t => !form.tags.includes(t)).slice(0, 8).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="text-[11px] text-gray-500 hover:text-primary transition-colors cursor-pointer border border-transparent hover:border-primary/15 px-2 py-0.5 rounded-full hover:bg-primary/5"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs text-gray-600 text-center sm:text-left">
              By submitting, you agree your question may be reviewed and published by faculty.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-8 py-3 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send size={14} />
                  Submit Question
                </>
              )}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}