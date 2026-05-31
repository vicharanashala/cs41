import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('csfaq_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('csfaq_token');
    if (token) {
      api.me().then(({ user }) => {
        setUser(user);
        localStorage.setItem('csfaq_user', JSON.stringify(user));
      }).catch(() => {
        localStorage.removeItem('csfaq_token');
        localStorage.removeItem('csfaq_user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { user, token } = await api.login({ email, password });
    localStorage.setItem('csfaq_token', token);
    localStorage.setItem('csfaq_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const { user, token } = await api.register({ name, email, password });
    localStorage.setItem('csfaq_token', token);
    localStorage.setItem('csfaq_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('csfaq_token');
    localStorage.removeItem('csfaq_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);