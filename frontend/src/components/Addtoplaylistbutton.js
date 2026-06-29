import React, { useState, useEffect, useRef } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchPlaylists, addSongToPlaylist, createPlaylist } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';

export default function AddToPlaylistButton({ songId, style, iconOnly = false }) {
  const { user } = useUserAuth();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [adding, setAdding] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open && user) fetchPlaylists().then(r => setPlaylists(r.playlists)).catch(() => {});
  }, [open, user]);

  if (!user) return null;

  const handleAdd = async (playlistId, name) => {
    setAdding(playlistId);
    try {
      await addSongToPlaylist(playlistId, songId);
      toast.success(`Added to "${name}"`);
      setOpen(false);
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
      setOpen(false);
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
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="Add to playlist"
        title="Add to playlist"
        className={iconOnly ? '' : 'btn btn-outline'}
        style={iconOnly ? {
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 3,
          color: open ? 'var(--text-accent)' : 'var(--text-muted)',
          transition: 'color 0.15s, transform 0.15s',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } : { fontSize: 13, padding: '7px 14px' }}
        onMouseOver={e => { if (iconOnly) e.currentTarget.style.transform = 'scale(1.2)'; }}
        onMouseOut={e  => { if (iconOnly) e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <ListPlus size={iconOnly ? 15 : 13} />
        {!iconOnly && <span style={{ marginLeft: 5 }}>Add to Playlist</span>}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: iconOnly ? '110%' : '110%',
          left: iconOnly ? 'auto' : 0,
          right: iconOnly ? 0 : 'auto',
          zIndex: 30,
          background: 'var(--surface-0)',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 240,
          padding: 12,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          }}>
            Add to playlist
          </div>

          <div style={{
            maxHeight: 180,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            marginBottom: 10,
          }}>
            {playlists.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>
                No playlists yet — create one below
              </div>
            ) : playlists.map(p => (
              <button
                key={p._id}
                onClick={() => handleAdd(p._id, p.name)}
                disabled={adding === p._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  padding: '8px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13.5,
                  color: 'var(--text-primary)',
                  width: '100%',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-1)'}
                onMouseOut={e  => e.currentTarget.style.background = 'none'}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {p.name}
                </span>
                {adding === p._id
                  ? <span style={{ fontSize: 11, flexShrink: 0 }}>Adding…</span>
                  : <Plus size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                }
              </button>
            ))}
          </div>

          <form
            onSubmit={handleCreateAndAdd}
            style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}
          >
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New playlist name"
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: 13,
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                outline: 'none',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary"
              style={{ padding: '7px 10px', flexShrink: 0 }}
            >
              {creating ? '…' : <Plus size={14} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}