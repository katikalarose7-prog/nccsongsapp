import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, FolderOpen, Clock, Sparkles, Settings, LogOut, ChevronDown,
} from 'lucide-react';
import { useUserAuth } from '../context/Userauthcontext';

/* Account button that opens a dropdown of destinations instead of
   navigating immediately on click. The full Account page itself still
   exists with the same tabs (Playlists / Recent / For You / Profile) —
   this dropdown is just a faster way to jump straight to one of them
   without landing on the default tab first. */
export default function AccountMenu() {
  const { user, logoutUser } = useUserAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!user) return null;

  const go = (tab) => {
    setOpen(false);
    navigate('/account', { state: { tab } });
  };

  const handleLogout = () => {
    setOpen(false);
    logoutUser();
    navigate('/');
  };

  const items = [
    { key: 'playlists',   label: 'My Playlists',     icon: FolderOpen },
    { key: 'recent',      label: 'Recently Played',   icon: Clock },
    { key: 'recommended', label: 'For You',           icon: Sparkles },
    { key: 'profile',     label: 'Profile Settings',  icon: Settings },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="btn"
        style={{
          background: open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
          color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)',
        }}
      >
        <User size={14} /> {user.name.split(' ')[0]}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 110,
          background: 'var(--surface-0)', borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: 220, overflow: 'hidden', animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{user.email}</div>
          </div>

          <div style={{ padding: 6 }}>
            {items.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => go(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  background: 'none', border: 'none', padding: '9px 10px', borderRadius: 8,
                  cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: 'var(--text-primary)',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                <Icon size={15} color="var(--text-muted)" />
                {label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', padding: 6 }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                background: 'none', border: 'none', padding: '9px 10px', borderRadius: 8,
                cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: '#ef4444', fontWeight: 600,
              }}
              onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}