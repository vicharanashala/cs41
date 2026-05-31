import { Link } from 'react-router-dom';
import styles from './Sidebar.module.css';

export default function Sidebar({ stats, categories }) {
  if (!stats) return null;

  return (
    <aside className={styles.sidebar}>
      {/* Community Stats */}
      <div className={`glass ${styles.widget}`}>
        <h3 className={styles.widgetTitle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Community Stats
        </h3>
        <div className={styles.statsGrid}>
          <div className={styles.statBox}>
            <span className={styles.statNum}>{stats.totalQuestions}</span>
            <span className={styles.statLabel}>Questions</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statNum}>{stats.totalAnswers}</span>
            <span className={styles.statLabel}>Answers</span>
          </div>
          <div className={`${styles.statBox} ${styles.statBoxHighlight}`}>
            <span className={styles.statNum}>{stats.answeredPct}%</span>
            <span className={styles.statLabel}>Answered</span>
          </div>
        </div>
      </div>

      {/* Trending Tags */}
      {categories && categories.length > 0 && (
        <div className={`glass ${styles.widget}`}>
          <h3 className={styles.widgetTitle}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            Topics
          </h3>
          <div className={styles.tagCloud}>
            {categories.map(c => (
              <Link
                key={c.id}
                to={`/?category=${encodeURIComponent(c.label)}`}
                className={styles.tagItem}
                style={{ '--tag-color': c.color }}
              >
                <span className={styles.tagIcon}>{c.icon}</span>
                <span className={styles.tagLabel}>{c.label}</span>
                <span className={styles.tagCount}>{c.count || 0}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top Contributors */}
      {stats.topContributors && stats.topContributors.length > 0 && (
        <div className={`glass ${styles.widget}`}>
          <h3 className={styles.widgetTitle}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Top Contributors
          </h3>
          <div className={styles.contributors}>
            {stats.topContributors.map((u, i) => (
              <div key={u.id} className={styles.contributor}>
                <span className={styles.rank}>#{i + 1}</span>
                <div className={styles.avatarSmall}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.contributorInfo}>
                  <span className={styles.contributorName}>{u.name}</span>
                  <span className={styles.contributorRep}>{u.reputation} rep</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}