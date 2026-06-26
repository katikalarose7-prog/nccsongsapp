import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, Lock, User as UserIcon } from 'lucide-react';
import { userLogin, userRegister, userForgotPassword } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';

export default function UserLogin() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { loginUser } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await userForgotPassword(form.email);
        toast.success('If that email is registered, a reset link has been sent.');
        setMode('login');
        setLoading(false);
        return;
      }
      const res = mode === 'login'
        ? await userLogin({ email: form.email, password: form.password })
        : await userRegister(form);
      loginUser(res.token, res.user);
      toast.success(mode === 'login' ? `Welcome back, ${res.user.name}!` : `Welcome, ${res.user.name}! Check your email to verify your account.`);
      navigate(redirectTo);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, var(--brand-deep), #3b0f6e 60%, #1a0533)', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)', position: 'relative',
      }}>
        <Link to="/" style={{
          position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center',
          gap: 4, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500,
        }}>
          <ArrowLeft size={14} /> Back
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 28, marginTop: 12 }}>
          <div style={{
            width: 56, height: 56, background: 'linear-gradient(135deg,#f0a500,#f59e0b)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, margin: '0 auto 14px',
          }}>          <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon" style={{borderRadius:'50%', objectFit:'cover'}} />
</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brand-deep)' }}>
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to access your playlists & favourites'
              : mode === 'register' ? 'Save favourites, build playlists, and get notified of new songs'
              : "We'll email you a reset link"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} required
                  value={form.name} onChange={set('name')} placeholder="Your name" />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 36 }} type="email" required autoComplete="username"
                value={form.email} onChange={set('email')} placeholder="you@example.com" />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} type="password" required minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password} onChange={set('password')} placeholder="••••••••" />
              </div>
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: 13, marginTop: 4 }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-muted)' }}>
          {mode === 'login' && (
            <>
              <button onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 600, fontSize: 13, textDecoration: 'underline', padding: '4px 0' }}>
                Forgot password?
              </button>
              <div style={{ marginTop: 10 }}>
                New here?{' '}
                <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}>
                  Create an account
                </button>
              </div>
            </>
          )}
          {mode === 'register' && (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}>
                Sign in
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}