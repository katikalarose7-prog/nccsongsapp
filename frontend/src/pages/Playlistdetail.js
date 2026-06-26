import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, X, Music } from 'lucide-react';
import { fetchPlaylist, removeSongFromPlaylist, downloadPlaylistPdf } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUserAuth();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);

  // Redirect immediately if visited directly while logged out, rather
  // than showing a blank page after a failed, unauthenticated fetch.
  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { state: { from: `/account/playlists/${id}` } });
  }, [authLoading, user, navigate, id]);

  const load = useCallback(() => {
    setLoading(true);
    fetchPlaylist(id)
      .then(r => setPlaylist(r.playlist))
      .catch((err) => {
        if (err.response?.status === 403 || err.response?.status === 404) {
          toast.error('Playlist not found or you don\'t have access to it');
          navigate('/account');
        } else {
          toast.error('Could not load playlist');
        }
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { if (user) load(); }, [load, user]);

  const handleRemove = async (songId, title) => {
    if (!window.confirm(`Remove "${title}" from this playlist?`)) return;
    await removeSongFromPlaylist(id, songId);
    toast.success('Removed');
    load();
  };

  if (authLoading || loading) return <div className="spinner" style={{ marginTop: 100 }} />;
  if (!playlist) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)' }}>
      <header className="header">
        <div className="header-inner">
          <Link to="/account" className="header-logo">
          <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon" style={{borderRadius:'50%', objectFit:'cover'}} />
            <div>
              <span className="header-logo-name">{playlist.name}</span>
              <span className="header-logo-sub">{playlist.songs.length} songs</span>
            </div>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => downloadPlaylistPdf(playlist._id, playlist.name)} className="btn btn-gold">
              <Download size={14} /> Export PDF
            </button>
            <Link to="/account" className="btn btn-ghost" style={{ color: '#fff' }}>
              <ArrowLeft size={14} /> Back
            </Link>
          </div>
        </div>
      </header>

      <div className="container" style={{ padding: '28px 20px 60px' }}>
        {playlist.songs.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Music size={48} /></div>
            <h3>No songs in this playlist yet</h3>
            <p>Open any song and use "Add to Playlist" to add it here</p>
          </div>
        ) : (
          <div className="songs-grid">
            {playlist.songs.map(entry => {
              const song = entry.song;
              if (!song) return null;
              return (
                <div key={song._id} className="song-card" style={{ position: 'relative' }}>
                  <button
                    onClick={() => handleRemove(song._id, song.title)}
                    style={{
                      position: 'absolute', top: 13, right: 13,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 3,
                    }}
                    title="Remove from playlist"
                  >
                    <X size={15} />
                  </button>
                  <Link to={`/?song=${song._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {song.songNumber && <div className="song-number">No. {song.songNumber}</div>}
                    <div className="song-title">{song.title}</div>
                    <div className="song-meta" style={{ marginTop: 10 }}>
                      <span className="badge badge-lang">{song.language}</span>
                      <span className="badge badge-cat">{song.category}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}