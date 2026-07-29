import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, User, Bell, Music, Clock, Sparkles, FolderPlus,
  Trash2, Download, FileText, LogOut, Plus, X,
} from 'lucide-react';
import { useUserAuth } from '../context/Userauthcontext';
import {
  updateUserProfile, fetchRecentlyPlayed, fetchRecommended,
  fetchPlaylists, createPlaylist, deletePlaylist, downloadPlaylistPdf,
} from '../services/api';

const LANGUAGES = [
  { value: '', label: 'No preference' },
  { value: 'english', label: 'English' },
  { value: 'telugu', label: 'Telugu' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'multilingual', label: 'Multilingual' },
];

export default function Account() {
  const { user, logoutUser, refreshUser } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // AccountMenu (the header dropdown) passes which tab to land on directly,
  // e.g. clicking "Recently Played" opens straight to that tab instead of
  // always defaulting to Playlists first.
  const [tab, setTab] = useState(location.state?.tab || 'playlists');

  const [recent, setRecent] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    emailNotifications: user?.emailNotifications ?? true,
    preferredLanguage: user?.preferredLanguage || '',
  });

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const loadPlaylists = useCallback(() => {
    fetchPlaylists().then(r => setPlaylists(r.playlists)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'recent') fetchRecentlyPlayed().then(r => setRecent(r.songs)).catch(() => {});
    if (tab === 'recommended') fetchRecommended().then(r => setRecommended(r.songs)).catch(() => {});
    if (tab === 'playlists') loadPlaylists();
  }, [tab, loadPlaylists]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      await updateUserProfile(profileForm);
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save changes');
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    try {
      await createPlaylist({ name: newPlaylistName.trim() });
      setNewPlaylistName('');
      toast.success('Playlist created');
      loadPlaylists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await deletePlaylist(id);
    toast.success('Playlist deleted');
    loadPlaylists();
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)' }}>
      {/* Simple header */}
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-logo">
<div>
          <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon" style={{borderRadius:'50%', objectFit:'cover'}} />
</div>            <div>
              <span className="header-logo-name">New Covenant Church</span>
              <span className="header-logo-sub">My Account</span>
            </div>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Link to="/" className="btn btn-ghost" style={{ color: '#fff' }}>
              <ArrowLeft size={14} /> Back to Songs
            </Link>
          </div>
        </div>
      </header>

      <div className="container" style={{ padding: '28px 20px 60px' }}>
        {/* Profile summary */}
        <div style={{
          background: 'var(--surface-0)', borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--border)', padding: 22, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-mid), var(--brand-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0,
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.email}</div>
            {!user.emailVerified && (
              <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>⚠ Email not verified — check your inbox</div>
            )}
          </div>
          <button onClick={() => { logoutUser(); navigate('/'); }} className="btn btn-ghost" style={{ color: '#ef4444' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            ['playlists', 'My Playlists', FolderPlus],
            ['recent', 'Recently Played', Clock],
            ['recommended', 'For You', Sparkles],
            ['profile', 'Profile Settings', User],
          ].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${tab === key ? 'var(--brand-light)' : 'var(--border)'}`,
                background: tab === key ? 'var(--surface-2)' : 'var(--surface-0)',
                color: tab === key ? 'var(--brand-mid)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Playlists tab ────────────────────────────────────── */}
        {tab === 'playlists' && (
          <div>
            <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 420 }}>
              <input className="form-input" placeholder="e.g. Sunday Song List"
                value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={creating}>
                <Plus size={15} /> Create
              </button>
            </form>

            {playlists.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><FolderPlus size={48} /></div>
                <h3>No playlists yet</h3>
                <p>Create a folder like "Sunday Song List" to organize songs</p>
              </div>
            ) : (
              <div className="songs-grid">
                {playlists.map(p => (
                  <div key={p._id} className="song-card" style={{ cursor: 'default' }}>
                    <Link to={`/account/playlists/${p._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="song-title" style={{ paddingRight: 0 }}>{p.name}</div>
                      {p.description && <div className="song-title-alt">{p.description}</div>}
                      <div className="song-meta" style={{ marginTop: 10 }}>
                        <span className="badge badge-lang">{p.songCount} song{p.songCount !== 1 ? 's' : ''}</span>
                      </div>
                    </Link>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <button onClick={() => downloadPlaylistPdf(p._id, p.name)}
                        className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                        <Download size={12} /> PDF
                      </button>
                      <button onClick={() => handleDeletePlaylist(p._id, p.name)}
                        className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: '#ef4444', marginLeft: 'auto' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Recently played tab ──────────────────────────────── */}
        {tab === 'recent' && (
          <div>
            {recent.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Clock size={48} /></div>
                <h3>No listening history yet</h3>
                <p>Songs you open will appear here</p>
              </div>
            ) : (
              <div className="songs-grid">
                {recent.map(s => (
                  <Link key={s._id} to={`/?song=${s._id}`} className="song-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="song-title" style={{ paddingRight: 0 }}>{s.title}</div>
                    <div className="song-meta" style={{ marginTop: 10 }}>
                      <span className="badge badge-lang">{s.language}</span>
                      <span className="badge badge-cat">{s.category}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Recommendations tab ──────────────────────────────── */}
        {tab === 'recommended' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Based on what you've been listening to
            </p>
            {recommended.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Sparkles size={48} /></div>
                <h3>Listen to a few songs first</h3>
                <p>We'll recommend songs based on your taste</p>
              </div>
            ) : (
              <div className="songs-grid">
                {recommended.map(s => (
                  <Link key={s._id} to={`/?song=${s._id}`} className="song-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="song-title" style={{ paddingRight: 0 }}>{s.title}</div>
                    <div className="song-meta" style={{ marginTop: 10 }}>
                      <span className="badge badge-lang">{s.language}</span>
                      <span className="badge badge-cat">{s.category}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Profile settings tab ─────────────────────────────── */}
        {tab === 'profile' && (
          <form onSubmit={handleProfileSave} style={{
            background: 'var(--surface-0)', borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--border)', padding: 24, maxWidth: 460,
          }}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Name</label>
              <input className="form-input" value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Preferred Language</label>
              <select className="form-select" value={profileForm.preferredLanguage}
                onChange={e => setProfileForm(f => ({ ...f, preferredLanguage: e.target.value }))}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={profileForm.emailNotifications}
                onChange={e => setProfileForm(f => ({ ...f, emailNotifications: e.target.checked }))}
                style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                <Bell size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                Email me when new songs are added
              </span>
            </label>

            <button type="submit" className="btn btn-primary">Save Changes</button>
          </form>
        )}
      </div>
    </div>
  );
}