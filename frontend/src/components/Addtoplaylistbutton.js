import React, { useState, useEffect, useRef } from 'react';
import { ListPlus, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchPlaylists, addSongToPlaylist, createPlaylist } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';

export default function AddToPlaylistButton({ songId, style }) {
  const { user } = useUserAuth();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [adding, setAdding] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open && user) fetchPlaylists().then(r => setPlaylists(r.playlists)).catch(() => {});
  }, [open, user]);

  if (!user) return null; // playlists require a logged-in account

  const handleAdd = async (playlistId, name) => {
    setAdding(playlistId);
    try {
      await addSongToPlaylist(playlistId, songId);
      toast.success(`Added to "${name}"`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add to playlist');
    } finally {
      setAdding(null);
    }
  };

  const handleCreateAndAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createPlaylist({ name: newName.trim() });
      await addSongToPlaylist(res.playlist._id, songId);
      toast.success(`Created "${newName.trim()}" and added song`);
      setNewName('');
      setPlaylists(p => [{ ...res.playlist, songCount: 1 }, ...p]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create playlist');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="btn btn-outline"
        style={{ fontSize: 13, padding: '7px 14px' }}
      >
        <ListPlus size={13} /> Add to Playlist
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 30,
          background: 'var(--surface-0)', borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: 260, padding: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Add to playlist
          </div>

          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
            {playlists.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>No playlists yet — create one below</div>
            ) : playlists.map(p => (
              <button key={p._id} onClick={() => handleAdd(p._id, p.name)} disabled={adding === p._id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', padding: '8px 8px', borderRadius: 8,
                  cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: 'var(--text-primary)',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                <span>{p.name}</span>
                {adding === p._id ? <span style={{ fontSize: 11 }}>Adding…</span> : <Plus size={14} color="var(--text-muted)" />}
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateAndAdd} style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="New playlist name"
              style={{
                flex: 1, padding: '7px 10px', fontSize: 13,
                border: '1.5px solid var(--border)', borderRadius: 8, outline: 'none',
              }}
            />
            <button type="submit" disabled={creating} className="btn btn-primary" style={{ padding: '7px 10px' }}>
              {creating ? '…' : <Plus size={14} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}