import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/AuthModal.css';

interface AuthModalProps {
  opened: boolean;
  onClose: () => void;
}

type Tab = 'login' | 'signup';

const AuthModal: React.FC<AuthModalProps> = ({ opened, onClose }) => {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!opened) return null;

  const reset = () => {
    setEmail('');
    setPassword('');
    setError('');
    setInfo('');
    setLoading(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        reset();
        onClose();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setInfo('Check your email to confirm your account, then log in.');
        setPassword('');
      }
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={e => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose} aria-label="Close">✕</button>

        <div className="auth-logo-row">
          <span className="auth-brand">Search<span className="auth-brand-accent">Tern</span></span>
        </div>

        <div className="auth-tabs">
          <button
            id="auth-tab-login"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            Log In
          </button>
          <button
            id="auth-tab-signup"
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => handleTabChange('signup')}
          >
            Sign Up
          </button>
        </div>

        <p className="auth-sub">
          {tab === 'login'
            ? 'Welcome back! Your applications are waiting.'
            : 'Create an account to save and sync your applications across devices.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label className="auth-label" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            className="auth-input"
            type="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="auth-error">{error}</p>}
          {info  && <p className="auth-info">{info}</p>}

          <button
            id="auth-submit-btn"
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer-note">
          {tab === 'login' ? (
            <>Don't have an account?{' '}
              <button className="auth-link-btn" onClick={() => handleTabChange('signup')}>Sign up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button className="auth-link-btn" onClick={() => handleTabChange('login')}>Log in</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
