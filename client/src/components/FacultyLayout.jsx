import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getModerationStats } from '../api/moderation.js';
import { getInternOverview } from '../api/spManagement.js';

export default function FacultyLayout() {
  const { user, logout, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [openFlags, setOpenFlags] = useState(0);
  const [spBadges, setSpBadges] = useState({ watchlist: 0, anomalies: 0 });
  const [showLogin, setShowLogin] = useState(!user);
  const [loginEmail, setLoginEmail] = useState('probe@faculty.test');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const navItems = [
    { to: '/faculty', label: 'Dashboard', icon: '📊', exact: true },
    { to: '/faculty/queue', label: 'Review Queue', icon: '📋' },
    { to: '/faculty/moderation', label: 'Moderation', icon: '🛡️', badge: openFlags > 0 ? openFlags : null },
    { to: '/faculty/interns', label: 'SP Management', icon: '🎓', badge: (spBadges.watchlist + spBadges.anomalies) || null },
    { to: '/faculty/tags', label: 'Tags', icon: '🏷️' },
    { to: '/faculty/analytics', label: 'Analytics', icon: '📈' },
    { to: '/faculty/settings', label: 'Settings', icon: '⚙️' },
    { to: '/faculty/audit', label: 'Audit Log', icon: '📋' },
  ];

  useEffect(() => {
    getModerationStats()
      .then(s => setOpenFlags(s.open))
      .catch(() => {});
    getInternOverview()
      .then(o => setSpBadges({ watchlist: o.onWatchlist, anomalies: o.openAnomalies }))
      .catch(() => {});
  }, []);

  const handleFacultyLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      if (user?.role === 'faculty') navigate('/faculty', { replace: true });
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const spBadgeCount = spBadges.watchlist + spBadges.anomalies;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: '#1e293b',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #334155' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Faculty Portal</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>CROWDFAQ Review System</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem 0' }}>
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 1rem',
                margin: '0.125rem 0.5rem',
                borderRadius: 6,
                color: isActive(item.to, item.exact) ? '#fff' : '#94a3b8',
                background: isActive(item.to, item.exact) ? '#3b82f6' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive(item.to, item.exact) ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {item.label}
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  marginLeft: 6, background: '#ef4444', color: '#fff',
                  borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.65rem', fontWeight: 700,
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
            {user?.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem' }}>{user?.email}</div>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '0.4rem', background: '#334155', color: '#94a3b8',
              border: 'none', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top-right faculty login widget */}
      {!user && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '1.25rem', width: 300,
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
            🔐 Faculty Login
          </div>
          <form onSubmit={handleFacultyLogin}>
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="Faculty email"
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
            />
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Password"
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
            />
            {loginError && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{loginError}</div>}
            <button
              type="submit"
              disabled={loginLoading}
              style={{ width: '100%', padding: '0.5rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: loginLoading ? 'not-allowed' : 'pointer', opacity: loginLoading ? 0.7 : 1 }}
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.6rem', textAlign: 'center' }}>
            Default: probe@faculty.test / faculty
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}