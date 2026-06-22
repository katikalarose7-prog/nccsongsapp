import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Search, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchSongs, deleteSong } from '../../services/api';

export default function SongsAdmin() {
  const [songs, setSongs]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [q, setQ]             = useState('');
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (q) params.q = q;
      const res = await fetchSongs(params);
      setSongs(res.songs); setTotal(res.total);
    } catch { toast.error('Failed to load songs'); }
    finally { setLoading(false); }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Remove "${title}"?`)) return;
    await deleteSong(id);
    toast.success('Song removed');
    load();
  };

  const totalPages = Math.ceil(total / 15);

  return (
    <>
      <div className="admin-topbar">
        <h1>Songs ({total})</h1>
        <Link to="/admin/songs/add" className="btn btn-primary">
          <PlusCircle size={15} /> Add Song
        </Link>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search songs…"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Title</th><th>Language</th><th>Category</th><th>Audio</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((s) => (
                  <tr key={s._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{s.songNumber || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      {s.titleTelugu && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-telugu)' }}>{s.titleTelugu}</div>}
                    </td>
                    <td><span className="badge badge-lang">{s.language}</span></td>
                    <td><span className="badge badge-cat">{s.category}</span></td>
                    <td>{s.audioUrl ? '🎵' : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/admin/songs/edit/${s._id}`} className="btn btn-ghost" style={{ padding: '6px 10px' }}>
                          <Edit size={14} />
                        </Link>
                        <button className="btn btn-ghost" style={{ padding: '6px 10px', color: '#ef4444' }}
                          onClick={() => handleDelete(s._id, s.title)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}