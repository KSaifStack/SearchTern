import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import { MagnifyingGlass, Kanban, CloudArrowUp, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import '../styles/Auth.css';

type Tab = 'login' | 'signup';

// Google "G" logo SVG (official brand colours)
const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'block' }}>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        <path fill="none" d="M0 0h48v48H0z" />
    </svg>
);

function Auth() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // If already logged in, redirect to tracker
    React.useEffect(() => {
        if (user) navigate('/tracker', { replace: true });
    }, [user, navigate]);

    const reset = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setLoading(false);
    };

    const handleTabChange = (t: Tab) => {
        setTab(t);
        reset();
    };

    const handleGoogleLogin = async () => {
        if (!supabase) {
            notifications.show({ title: 'Configuration Error', message: 'Supabase is not configured.', color: 'red', icon: <WarningCircle size={18} /> });
            return;
        }
        setGoogleLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/tracker`,
            },
        });
        if (error) {
            notifications.show({ title: 'Authentication Error', message: error.message, color: 'red', icon: <WarningCircle size={18} /> });
            setGoogleLoading(false);
        }
        // On success Supabase redirects the browser — no manual navigation needed
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) {
            notifications.show({ title: 'Configuration Error', message: 'Supabase is not configured.', color: 'red', icon: <WarningCircle size={18} /> });
            return;
        }
        setLoading(true);

        if (tab === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            setLoading(false);
            if (error) {
                notifications.show({ title: 'Login Failed', message: error.message, color: 'red', icon: <WarningCircle size={18} /> });
            } else {
                notifications.show({ title: 'Welcome Back!', message: 'Successfully logged in.', color: 'teal', icon: <CheckCircle size={18} weight="fill" /> });
                navigate('/tracker', { replace: true });
            }
        } else {
            if (password !== confirmPassword) {
                setLoading(false);
                notifications.show({ title: 'Signup Failed', message: 'Passwords do not match.', color: 'red', icon: <WarningCircle size={18} /> });
                return;
            }
            const { error } = await supabase.auth.signUp({ email, password });
            setLoading(false);
            if (error) {
                notifications.show({ title: 'Signup Failed', message: error.message, color: 'red', icon: <WarningCircle size={18} /> });
            } else {
                notifications.show({ title: 'Check Your Email', message: 'Please confirm your account via the link sent to your email, then log in.', color: 'teal', icon: <CheckCircle size={18} weight="fill" /> });
                setPassword('');
                setConfirmPassword('');
            }
        }
    };

    return (
        <div className="auth-page">
            {/* ── Left panel ── */}
            <div className="auth-panel-left">
                <div className="auth-panel-content">
                    <h2 className="auth-panel-headline">
                        Track every application.<br />Land the right internship.
                    </h2>
                    <p className="auth-panel-sub">
                        Unlike our competitors, SearchTern is built with zero bloat. Discover internships and manage your entire application pipeline: saved, applied, interviewed, offered. All seamlessly in one place.
                    </p>

                    <div className="auth-panel-features">
                        <div className="auth-feature-item">
                            <span className="auth-feature-icon"><MagnifyingGlass weight="bold" /></span>
                            <span>Search 600+ internships</span>
                        </div>
                        <div className="auth-feature-item">
                            <span className="auth-feature-icon"><Kanban weight="bold" /></span>
                            <span>Drag-and-drop application board</span>
                        </div>
                        <div className="auth-feature-item">
                            <span className="auth-feature-icon"><CloudArrowUp weight="bold" /></span>
                            <span>Cloud sync across all your devices</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right panel (form) ── */}
            <div className="auth-panel-right">
                <div className="auth-form-card">
                    <h1 className="auth-form-title">
                        {tab === 'login' ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p className="auth-form-sub">
                        {tab === 'login'
                            ? 'Log in to access your application tracker.'
                            : 'Sign up to start tracking your internship applications.'}
                    </p>

                    {/* ── Google OAuth button ── */}
                    <Button
                        id="auth-google-btn"
                        fullWidth
                        variant="default"
                        leftSection={<GoogleIcon />}
                        loading={googleLoading}
                        onClick={handleGoogleLogin}
                        styles={{
                            root: {
                                height: 44,
                                fontSize: 14,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: 8,
                                color: '#172b4d',
                                backgroundColor: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                transition: 'box-shadow 0.15s, border-color 0.15s',
                                '&:hover': {
                                    backgroundColor: '#f8f7f4',
                                    borderColor: '#cbd5e1',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                },
                            },
                        }}
                    >
                        Continue with Google
                    </Button>

                    <Divider
                        label="or continue with email"
                        labelPosition="center"
                        my="lg"
                        styles={{
                            label: {
                                fontSize: 12,
                                color: '#8993a4',
                                fontFamily: 'inherit',
                                fontWeight: 500,
                            },
                        }}
                    />

                    {/* ── Email / password form ── */}
                    <form onSubmit={handleSubmit} className="auth-form-body">
                        <div className="auth-field">
                            <label className="auth-field-label" htmlFor="auth-email">Email</label>
                            <input
                                id="auth-email"
                                className="auth-field-input"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label className="auth-field-label" htmlFor="auth-password">Password</label>
                            <input
                                id="auth-password"
                                className="auth-field-input"
                                type="password"
                                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                                placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        {tab === 'signup' && (
                            <div className="auth-field">
                                <label className="auth-field-label" htmlFor="auth-confirm-password">Confirm Password</label>
                                <input
                                    id="auth-confirm-password"
                                    className="auth-field-input"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Confirm your password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        )}

                        <button
                            id="auth-submit-btn"
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading}
                        >
                            {loading
                                ? 'Please wait…'
                                : tab === 'login' ? 'Log In' : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-switch-note">
                        {tab === 'login' ? (
                            <>Don't have an account?{' '}
                                <button className="auth-switch-link" onClick={() => handleTabChange('signup')}>
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>Already have an account?{' '}
                                <button className="auth-switch-link" onClick={() => handleTabChange('login')}>
                                    Log in
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Auth;
