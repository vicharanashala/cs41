import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Protected route wrapper for Faculty pages.
 * Redirects to / if user is not authenticated or not a faculty.
 */
export default function FacultyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🔒</div>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'faculty') return <Navigate to="/" replace />;

  return children;
}