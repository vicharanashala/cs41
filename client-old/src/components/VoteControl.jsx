import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import styles from './VoteControl.module.css';

export default function VoteControl({ score, userVote, onVote, disabled }) {
  const { user } = useAuth();
  const [optimistic, setOptimistic] = useState(null);
  const [animating, setAnimating] = useState(null);

  const currentVote = optimistic || userVote;

  const handle = (dir) => {
    if (!user || disabled) return;
    setAnimating(dir);
    setTimeout(() => setAnimating(null), 300);

    const next = currentVote === dir ? null : dir;
    setOptimistic(next);

    const delta = next === 'up' ? 1 : next === 'down' ? -1 : currentVote === 'up' ? -1 : 1;
    onVote(dir);
  };

  const displayScore = optimistic !== null
    ? (score + (optimistic === 'up' ? 1 : optimistic === 'down' ? -1 : 0))
    : (userVote !== null ? score : score);

  return (
    <div className={styles.votes}>
      <button
        className={`${styles.btn} ${currentVote === 'up' ? styles.upActive : ''} ${animating === 'up' ? styles.animate : ''}`}
        onClick={() => handle('up')}
        disabled={!user || disabled}
        title={!user ? 'Sign in to vote' : disabled ? 'Cannot vote' : 'Upvote'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      </button>

      <span className={`${styles.score} ${currentVote === 'up' ? styles.scoreUp : currentVote === 'down' ? styles.scoreDown : ''}`}>
        {score}
      </span>

      <button
        className={`${styles.btn} ${currentVote === 'down' ? styles.downActive : ''} ${animating === 'down' ? styles.animate : ''}`}
        onClick={() => handle('down')}
        disabled={!user || disabled}
        title={!user ? 'Sign in to vote' : disabled ? 'Cannot vote' : 'Downvote'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
      </button>
    </div>
  );
}