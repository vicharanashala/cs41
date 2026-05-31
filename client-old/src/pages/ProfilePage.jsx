import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinedDate] = useState(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  if (!user) { navigate('/login'); return null; }

  return (
    <main className="page">
      <div className="container">
        <div className={`glass ${styles.profileCard} animate-in`}>
          <div className={styles.avatar}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.info}>
            <h1 className={styles.name}>{user.name}</h1>
            <p className={styles.email}>{user.email}</p>
            <p className={styles.joined}>Member since {joinedDate}</p>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{user.reputation}</span>
              <span className={styles.statLabel}>Reputation</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}