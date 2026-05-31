import { Link } from 'react-router-dom';
import styles from './CategoryPill.module.css';

const CATEGORY_ICONS = {
  'Interview Prep':     '💬',
  'Application Tips':   '📝',
  'Company Research':   '🏢',
  'Salary Negotiation': '💰',
  'Visa & Relocation':  '✈️',
  'Mental Health':      '🧠',
  'General Advice':     '💡',
};

const CATEGORY_COLORS = {
  'Interview Prep':     { bg: 'rgba(0,212,255,0.08)',  text: '#00d4ff', glow: 'rgba(0,212,255,0.15)' },
  'Application Tips':   { bg: 'rgba(168,85,247,0.08)', text: '#a855f7', glow: 'rgba(168,85,247,0.15)' },
  'Company Research':   { bg: 'rgba(0,255,136,0.08)',  text: '#00ff88', glow: 'rgba(0,255,136,0.15)' },
  'Salary Negotiation': { bg: 'rgba(251,191,36,0.08)', text: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  'Visa & Relocation':  { bg: 'rgba(249,115,22,0.08)', text: '#f97316', glow: 'rgba(249,115,22,0.15)' },
  'Mental Health':      { bg: 'rgba(236,72,153,0.08)', text: '#ec4899', glow: 'rgba(236,72,153,0.15)' },
  'General Advice':     { bg: 'rgba(99,102,241,0.08)', text: '#6366f1', glow: 'rgba(99,102,241,0.15)' },
};

export default function CategoryPill({ label, count, active, asLink }) {
  const colors = CATEGORY_COLORS[label] || { bg: 'rgba(99,102,241,0.08)', text: '#6366f1', glow: 'rgba(99,102,241,0.15)' };
  const icon = CATEGORY_ICONS[label] || '💡';

  const style = {
    '--pill-bg': colors.bg,
    '--pill-text': colors.text,
    '--pill-glow': colors.glow,
    '--pill-border': colors.text + '30',
  };

  const className = `${styles.pill} ${active ? styles.active : ''} ${asLink ? styles.asLink : ''}`;

  const inner = (
    <>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </>
  );

  if (asLink) {
    return (
      <Link to={`/?category=${encodeURIComponent(label)}`} className={className} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={className} style={style}>
      {inner}
    </button>
  );
}