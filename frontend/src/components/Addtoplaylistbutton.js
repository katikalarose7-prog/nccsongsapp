import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ListPlus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchPlaylists, addSongToPlaylist, createPlaylist } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';

// Module-level cache — survives re-renders, cleared on page refresh.
// All instances share the same cache so only the FIRST open ever hits the network.
let playlistCache = null;
let playlistCachePromise = null;

function getPlaylists() {
  if (playlistCache) return Promise.resolve(playlistCache);
  if (playlistCachePromise) return playlistCachePromise;
  playlistCachePromise = fetchPlaylists()
    .then(r => { playlistCache = r.playlists; playlistCachePromise = null; return playlistCache; })
    .catch(err => { playlistCachePromise = null; throw err; });
  return playlistCachePromise;
}

function invalidateCache() {
  playlistCache = null;
  playlistCachePromise = null;
}

export default function AddToPlaylistButton({ songId, style, iconOnly = false }) {
  const { user } = useUserAuth();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState(playlistCache || []); // pre-fill from cache instantly
  const [adding, setAdding] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  // Fetch (or serve from cache) when opened
  useEffect(() => {
    if (!open || !user) return;
    if (playlistCache) {
      setPlaylists(playlistCache); // instant — no spinner needed
      return;
    }
    setLoading(true);
    getPlaylists()
      .then(p => setPlaylists(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, user]);

  if (!user) return null;

  const toggleOpen = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownWidth = 240;
      let left = rect.right - dropdownWidth;
      if (left < 8) left = 8;
      if (left + dropdownWidth > window.innerWidth - 8) left = window.innerWidth - dropdownWidth - 8;
      setDropdownPos({ top: rect.bottom + window.scrollY + 6, left: left + window.scrollX });
    }
    setOpen(v => !v);
  };

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
      // Update both local state and the shared cache
      const updated = [{ ...res.playlist, songCount: 1 }, ...(playlistCache || [])];
      playlistCache = updated;
      setPlaylists(updated);
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create playlist');
    } finally {
      setCreating(false);
    }
  };

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 9999,
        background: 'var(--surface-0)',
        borderRadius: 'var(--radius-md, 10px)',
        border: '1.5px solid var(--border)',
        boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))',
        width: 240,
        padding: 12,
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
      }}>
        Add to playlist
      </div>

      <div style={{
        maxHeight: 180, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10,
      }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>
            Loading…
          </div>
        ) : playlists.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>
            No playlists yet — create one below
          </div>
        ) : playlists.map(p => (
          <button
            key={p._id}
            onClick={(e) => { e.stopPropagation(); handleAdd(p._id, p.name); }}
            disabled={adding === p._id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', padding: '8px 8px', borderRadius: 8,
              cursor: 'pointer', textAlign: 'left', fontSize: 13.5,
              color: 'var(--text-primary)', width: '100%',
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
          onClick={e => e.stopPropagation()}
          placeholder="New playlist name"
          style={{
            flex: 1, padding: '7px 10px', fontSize: 13,
            border: '1.5px solid var(--border)', borderRadius: 8,
            outline: 'none', background: 'var(--surface-1)',
            color: 'var(--text-primary)', minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={creating}
          className="btn btn-primary"
          style={{ padding: '7px 10px', flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          {creating ? '…' : <Plus size={14} />}
        </button>
      </form>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-label="Add to playlist"
        title="Add to playlist"
        className={iconOnly ? '' : 'btn btn-outline'}
        style={iconOnly ? {
          background: 'none', border: 'none', cursor: 'pointer', padding: 3,
          color: open ? 'var(--text-accent)' : 'var(--text-muted)',
          transition: 'color 0.15s, transform 0.15s',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        } : { fontSize: 13, padding: '7px 14px' }}
        onMouseOver={e => { if (iconOnly) e.currentTarget.style.transform = 'scale(1.2)'; }}
        onMouseOut={e  => { if (iconOnly) e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <ListPlus size={iconOnly ? 15 : 13} />
        {!iconOnly && <span style={{ marginLeft: 5 }}>Add to Playlist</span>}
      </button>

      {dropdown}
    </div>
  );
}