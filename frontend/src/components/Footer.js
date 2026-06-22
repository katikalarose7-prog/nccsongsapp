import React from 'react';
import { Link } from 'react-router-dom';
import { Settings, Heart } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      background: 'var(--brand-deep)', color: 'rgba(255,255,255,0.6)',
      padding: '36px 20px 24px', marginTop: 40,
    }}>
      <div className="container" style={{
        display: 'flex', flexWrap: 'wrap', gap: 28, justifyContent: 'space-between',
        paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ maxWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, var(--brand-gold), #e09600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
            }}>✝</div>
            <span style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
              New Covenant Church
            </span>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            Worship songs in English, Telugu &amp; Hindi — search, save favourites, build playlists, and sing along.
          </p>
        </div>

        <div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Account
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
            <Link to="/login" style={{ color: 'inherit' }}>Sign In / Register</Link>
            <Link to="/account" style={{ color: 'inherit' }}>My Playlists</Link>
          </div>
        </div>

        <div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Legal
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
            <Link to="/privacy" style={{ color: 'inherit' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: 'inherit' }}>Terms of Use</Link>
            <Link to="/contact" style={{ color: 'inherit' }}>Contact</Link>
          </div>
        </div>

        <div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Church Staff
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
            <Link to="/admin/login" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Settings size={12} /> Admin Login
            </Link>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: 1180, margin: '18px auto 0', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        fontSize: 12, padding: '0 20px',
      }}>
        <span>© {year} New Covenant Church. All rights reserved.</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Made with <Heart size={11} fill="currentColor" /> for the church
        </span>
      </div>
    </footer>
  );
}