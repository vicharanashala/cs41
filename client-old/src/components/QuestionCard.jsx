import { Link } from 'react-router-dom';
import VoteControl from './VoteControl.jsx';
import styles from './QuestionCard.module.css';

const CATEGORY_COLORS = {
  'Interview Prep':     { bg: 'rgba(0,212,255,0.1)',  text: '#00d4ff', border: 'rgba(0,212,255,0.2)' },
  'Application Tips':   { bg: 'rgba(168,85,247,0.1)', text: '#a855f7', border: 'rgba(168,85,247,0.2)' },
  'Company Research':   { bg: 'rgba(0,255,136,0.1)',  text: '#00ff88', border: 'rgba(0,255,136,0.2)' },
  'Salary Negotiation': { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
  'Visa & Relocation':  { bg: 'rgba(249,115,22,0.1)', text: '#f97316', border: 'rgba(249,115,22,0.2)' },
  'Mental Health':      { bg: 'rgba(236,72,153,0.1)', text: '#ec4899', border: 'rgba(236,72,153,0.2)' },
  'General Advice':     { bg: 'rgba(99,102,241,0.1)', text: '#6366f1', border: 'rgba(99,102,241,0.2)' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function QuestionCard({ question, onVote }) {
  const colors = CATEGORY_COLORS[question.category] || CATEGORY_COLORS['General Advice'];

  return (
    <article className={`glass ${styles.card} animate-in`}>
      <VoteControl
        score={question.score}
        userVote={question.userVote}
        onVote={(dir) => onVote(question.id, dir)}
        disabled={!question.canVote}
      />

      <div className={styles.body}>
        <div className={styles.meta}>
          <span
            className={styles.category}
            style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
          >
            {question.category}
          </span>
          <span className={styles.time}>{timeAgo(question.created_at)}</span>
        </div>

        <Link to={`/question/${question.id}`} className={styles.title}>
          {question.title}
        </Link>

        <p className={styles.excerpt}>
          {question.description.replace(/[#*`_\[\]]/g, '').slice(0, 160)}
          {question.description.length > 160 ? '…' : ''}
        </p>

        {question.tags && question.tags.length > 0 && (
          <div className={styles.tags}>
            {question.tags.slice(0, 4).map(tag => (
              <span key={tag} className={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {question.answer_count} answers
            </span>
            <span className={styles.stat}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {question.views} views
            </span>
          </div>
          <div className={styles.author}>
            <span className={styles.authorName}>{question.author_name}</span>
            <span className={styles.authorRep}>{question.author_reputation} rep</span>
          </div>
        </div>
      </div>
    </article>
  );
}