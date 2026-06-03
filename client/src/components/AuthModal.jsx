import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login', 'register'

  // Navigate to /faculty only AFTER React has committed the user state update
  useEffect(() => {
    if (user?.role === 'faculty') {
      handleClose();
      navigate('/faculty', { replace: true });
    }
  }, [user]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('intern'); // 'intern' or 'faculty'

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
    setMode('login');
    setName(''); setEmail(''); setPassword(''); setRole('intern');
    setError('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const loggedInUser = await login(email, password);
        if (loggedInUser?.role === 'faculty') {
          navigate('/faculty', { replace: true });
        }
        handleClose();
      } else if (mode === 'register') {
        await register({ name, email, password, role });
        handleClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden bg-slate-900 border border-slate-700/50 shadow-2xl rounded-2xl"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />

          <button
            onClick={handleClose}
            className="absolute p-2 text-slate-400 transition-colors top-3 right-3 hover:text-white rounded-full hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            {/* Header */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'login' ? 'Welcome Back' : 'Join the Community'}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {mode === 'login'
                  ? 'Sign in to ask questions and earn SP points.'
                  : 'Create your account to start contributing.'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start p-3 mb-6 text-sm text-red-200 border rounded-lg bg-red-500/10 border-red-500/20"
              >
                <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Register form */}
            {mode === 'register' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role toggle */}
                <div className="flex p-1 space-x-1 border rounded-lg bg-slate-800/50 border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setRole('intern')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'intern' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Intern
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('faculty')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'faculty' ? 'bg-purple-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Faculty
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Full Name</label>
                  <input
                    type="text" required
                    value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Email Address</label>
                  <input
                    type="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Password</label>
                  <input
                    type="password" required minLength="6"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit" disabled={loading}
                  className="flex items-center justify-center w-full py-3 mt-4 space-x-2 text-sm font-semibold text-white transition-all bg-blue-600 rounded-lg disabled:opacity-50 hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  <span>Create Account</span>
                </button>
              </form>
            )}

            {/* Login form */}
            {mode === 'login' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Email Address</label>
                  <input
                    type="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Password</label>
                  <input
                    type="password" required
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit" disabled={loading}
                  className="flex items-center justify-center w-full py-3 mt-4 space-x-2 text-sm font-semibold text-white transition-all bg-blue-600 rounded-lg disabled:opacity-50 hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  <span>Sign In</span>
                </button>
              </form>
            )}

            {/* Toggle login/register */}
            {mode === 'login' ? (
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            ) : (
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}