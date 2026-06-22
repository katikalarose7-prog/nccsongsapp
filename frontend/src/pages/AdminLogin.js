import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { adminLogin } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await adminLogin(form);
      loginAdmin(res.token, res.admin);
      toast.success(`Welcome, ${res.admin.name}!`);
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)', position: 'relative',
      }}>
        <Link to="/" style={{
          position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center',
          gap: 4, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500,
        }}>
          <ArrowLeft size={14} /> Back to site
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 12 }}>
          <div style={{
            width: 60, height: 60, background: 'linear-gradient(135deg,#f0a500,#f59e0b)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
          }}>✝</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--brand-deep)' }}>
            Admin Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>New Covenant Church Songs</p>
        </div>

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required autoComplete="username"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@ncc.church" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: 13, marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
          This area is restricted to church administrators.
        </p>
      </div>
    </div>
  );
}