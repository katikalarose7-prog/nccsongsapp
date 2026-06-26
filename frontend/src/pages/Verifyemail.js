import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { verifyEmail } from '../services/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('checking'); // checking | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in this link. Please check your email and try again.');
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email is verified. You can now receive song notifications and access all features.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'This verification link has expired or already been used. Please register again or contact support.');
      });
  }, [params]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #1a0533, #3b0f6e 60%, #1a0533)', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 48, width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)', textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, background: 'linear-gradient(135deg,#f0a500,#f59e0b)',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(240,165,0,0.4)',
        }}>            <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon" style={{borderRadius:'50%', objectFit:'cover'}} />
</div>

        {status === 'checking' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <Loader size={48} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, color: '#1a0533', marginBottom: 8 }}>
              Verifying your email…
            </h2>
            <p style={{ color: '#888', fontSize: 14 }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, color: '#1a0533', marginBottom: 10 }}>
              Email Verified! 🎉
            </h2>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{message}</p>
            <Link to="/" style={{
              display: 'inline-block', background: '#7c3aed', color: '#fff',
              padding: '13px 28px', borderRadius: 10, textDecoration: 'none',
              fontWeight: 700, fontSize: 15,
            }}>
              Browse Songs 🎵
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={56} color="#dc2626" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, color: '#1a0533', marginBottom: 10 }}>
              Verification Failed
            </h2>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{message}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" style={{
                display: 'inline-block', background: '#7c3aed', color: '#fff',
                padding: '13px 24px', borderRadius: 10, textDecoration: 'none',
                fontWeight: 700, fontSize: 14,
              }}>
                Go to Login
              </Link>
              <Link to="/" style={{
                display: 'inline-block', background: '#f5f0ff', color: '#7c3aed',
                padding: '13px 24px', borderRadius: 10, textDecoration: 'none',
                fontWeight: 700, fontSize: 14, border: '1.5px solid #e0d4ff',
              }}>
                Browse Songs
              </Link>
            </div>
          </>
        )}

        <p style={{ color: '#aaa', fontSize: 12, marginTop: 28 }}>
          New Covenant Church Songs
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
