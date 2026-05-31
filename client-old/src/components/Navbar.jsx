import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/?search=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal('');
    }
  };

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#00d4ff" strokeWidth="1.5" opacity="0.6"/>
            <circle cx="14" cy="14" r="8" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4"/>
            <circle cx="14" cy="14" r="3" fill="#00d4ff"/>
            <line x1="14" y1="1" x2="14" y2="6" stroke="#00d4ff" strokeWidth="1.5"/>
            <line x1="14" y1="22" x2="14" y2="27" stroke="#00d4ff" strokeWidth="1.5"/>
            <line x1="1" y1="14" x2="6" y2="14" stroke="#00d4ff" strokeWidth="1.5"/>
            <line x1="22" y1="14" x2="27" y2="14" stroke="#00d4ff" strokeWidth="1.5"/>
          </svg>
          <span className={styles.logoText}>CrowdSource<span className={styles.logoAccent}>FAQs</span></span>
        </Link>

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search questions..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            className={styles.searchInput}
          />
        </form>

        <div className={styles.actions}>
          <Link to="/?sort=unanswered" className="btn btn-ghost">Unanswered</Link>
          {user ? (
            <>
              <Link to="/ask" className="btn btn-primary btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Ask
              </Link>
              <div className={styles.userMenu}>
                <div className={styles.avatar} onClick={() => setMenuOpen(!menuOpen)}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {menuOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <strong>{user.name}</strong>
                      <span>{user.reputation} rep</span>
                    </div>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
                    <button onClick={() => { logout(); setMenuOpen(false); navigate('/'); }}>Sign Out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Join</Link>
            </>
          )}
        </div>

        <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
          <span/><span/><span/>
        </button>
      </div>
    </nav>
  );
}