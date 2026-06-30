import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ExternalLink, BookOpen, ChevronLeft, ChevronRight, Music, Heart, Play, Pause, LogIn, ListPlus, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchSongs, fetchSong, resolveAudioUrl, toggleFavourite, fetchFavourites, fetchPlaylists, addSongToPlaylist, createPlaylist } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';
import Footer from '../components/Footer';
import VoiceSearchButton from '../components/Voicesearchbutton';
import ShareButton from '../components/Sharebutton';
import AddToPlaylistButton from '../components/Addtoplaylistbutton';
import AccountMenu from '../components/AccountMenu';
import InstallAppButton from '../components/InstallAppButton';

const LANGUAGES  = ['All','English','Telugu','Hindi','Multilingual'];
const CATEGORIES = ['All','Worship','Praise','Christmas','Resurrection','Communion','Wedding','Death','Thanksgiving','SundaySchoolSongs','Other'];

const GUEST_FAV_KEY  = 'ncc_guest_favourites';
const getGuestFavs  = () => { try { return JSON.parse(localStorage.getItem(GUEST_FAV_KEY) || '[]'); } catch { return []; } };
const saveGuestFavs = (ids) => localStorage.setItem(GUEST_FAV_KEY, JSON.stringify(ids));

const BIBLE_VERSES = [
  { text: "Sing to the LORD a new song; sing to the LORD, all the earth.", ref: "Psalm 96:1" },
  { text: "Let everything that has breath praise the LORD. Praise the LORD!", ref: "Psalm 150:6" },
  { text: "The LORD is my strength and my song; he has given me victory.", ref: "Exodus 15:2" },
  { text: "Speak to one another with psalms, hymns, and songs from the Spirit.", ref: "Ephesians 5:19" },
  { text: "Shout for joy to the LORD, all the earth. Worship the LORD with gladness.", ref: "Psalm 100:1-2" },
  { text: "I will sing of the LORD's great love forever; with my mouth I will make your faithfulness known.", ref: "Psalm 89:1" },
  { text: "He put a new song in my mouth, a hymn of praise to our God.", ref: "Psalm 40:3" },
  { text: "Praise the LORD. How good it is to sing praises to our God, how pleasant and fitting to praise him!", ref: "Psalm 147:1" },
  { text: "Come, let us sing for joy to the LORD; let us shout aloud to the Rock of our salvation.", ref: "Psalm 95:1" },
  { text: "Let the message of Christ dwell among you richly as you teach and admonish one another with all wisdom through psalms, hymns, and songs from the Spirit.", ref: "Colossians 3:16" },
  { text: "Is anyone happy? Let them sing songs of praise.", ref: "James 5:13" },
  { text: "About midnight Paul and Silas were praying and singing hymns to God.", ref: "Acts 16:25" },
  { text: "I will praise you, LORD, with all my heart; before the gods I will sing your praise.", ref: "Psalm 138:1" },
  { text: "The LORD your God is with you, the Mighty Warrior who saves. He will take great delight in you; in his love he will no longer rebuke you, but will rejoice over you with singing.", ref: "Zephaniah 3:17" },
  { text: "My heart, O God, is steadfast; I will sing and make music with all my soul.", ref: "Psalm 108:1" },
  { text: "I will sing to the LORD all my life; I will sing praise to my God as long as I live.", ref: "Psalm 104:33" },
  { text: "Praise him with timbrel and dancing, praise him with the strings and pipe.", ref: "Psalm 150:4" },
  { text: "Enter his gates with thanksgiving and his courts with praise; give thanks to him and praise his name.", ref: "Psalm 100:4" },
  { text: "Make a joyful noise to the LORD, all the earth; break forth into joyous song and sing praises!", ref: "Psalm 98:4" },
  { text: "Glorify the LORD with me; let us exalt his name together.", ref: "Psalm 34:3" },
];

const SESSION_VERSE = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-line short" style={{ width: 40, marginBottom: 8 }} />
          <div className="skeleton-line title" />
          <div className="skeleton-line sub" />
          <div className="skeleton-line" style={{ width: '90%', marginTop: 12 }} />
          <div className="skeleton-line" style={{ width: '75%' }} />
        </div>
      ))}
    </div>
  );
}

function AdBanner() {
  const { text, ref } = SESSION_VERSE;
  return (
    <div className="ad-banner">
      <div>
        <div className="ad-banner-label" style={{textAlign:'center'}}>Verse of the Day</div>
        <div className="ad-banner-title" style={{ fontStyle: 'italic', fontWeight: 400 }}>
          "{text}"
        </div>
        <div className="ad-banner-sub" style={{ marginTop: 4, fontWeight: 600, display: "flex",
        alignItems: "center", justifyContent: "space-between", width: "100%" }}>
         <span>— {ref}</span>
          <a href="https://www.youtube.com/@newcovenantchurches" target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
            <button className="ad-banner-btn">Visit Youtube ▶</button>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Inline playlist picker — lightweight dropdown used directly on
   song cards so users can add to playlist without opening the song.
   Separate from AddToPlaylistButton (which is used in the modal) so
   the card stays compact. Closes on outside click. ── */
function CardPlaylistPicker({ songId, onClose }) {
  const { user } = useUserAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [added, setAdded] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetchPlaylists()
      .then(r => setPlaylists(r.playlists))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    // slight delay so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const handleAdd = async (playlistId, name) => {
    setAdding(playlistId);
    try {
      await addSongToPlaylist(playlistId, songId);
      setAdded(playlistId);
      setTimeout(onClose, 800); // close after brief success flash
    } catch {
      // silent — toast would be intrusive on a card
    } finally {
      setAdding(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createPlaylist({ name: newName.trim() });
      await addSongToPlaylist(res.playlist._id, songId);
      setAdded(res.playlist._id);
      setTimeout(onClose, 800);
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} style={{
      position: 'absolute',
      // Position below the playlist icon (top-right area of card)
      top: 36, right: 8,
      zIndex: 50,
      background: '#fff',
      borderRadius: 12,
      border: '1.5px solid var(--border)',
      boxShadow: '0 8px 32px rgba(26,5,51,0.18)',
      width: 220,
      padding: 10,
      animation: 'fadeIn 0.12s ease',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
        Add to playlist
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Loading…</div>
      ) : playlists.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0 8px' }}>No playlists yet</div>
      ) : (
        <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
          {playlists.map(p => (
            <button key={p._id} onClick={() => handleAdd(p._id, p.name)} disabled={!!adding || added === p._id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', background: added === p._id ? 'var(--surface-2)' : 'none',
                border: 'none', padding: '7px 6px', borderRadius: 7,
                cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-primary)',
              }}
              onMouseOver={e => { if (added !== p._id) e.currentTarget.style.background = 'var(--surface-1)'; }}
              onMouseOut={e => { if (added !== p._id) e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{p.name}</span>
              {adding === p._id
                ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>…</span>
                : added === p._id
                  ? <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓</span>
                  : <Plus size={13} color="var(--text-muted)" />}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New playlist…"
          style={{
            flex: 1, padding: '6px 8px', fontSize: 12,
            border: '1.5px solid var(--border)', borderRadius: 7, outline: 'none',
          }}
          onClick={e => e.stopPropagation()}
        />
        <button type="submit" disabled={creating}
          style={{
            background: 'var(--brand-light)', color: '#fff', border: 'none',
            borderRadius: 7, padding: '6px 9px', cursor: 'pointer',
          }}>
          {creating ? '…' : <Plus size={13} />}
        </button>
      </form>
    </div>
  );
}

export default function HomePage() {
  const { user } = useUserAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery]             = useState('');
  const [lang, setLang]               = useState('All');
  const [cat, setCat]                 = useState('All');
  const [sort, setSort]               = useState('songNumber');
  const [page, setPage]               = useState(1);
  const [data, setData] = useState({ songs: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [tab, setTab]                 = useState('english');
  const [showChords, setShowChords]   = useState(false);
  const [favs, setFavs]               = useState(getGuestFavs);
  const [showFavs, setShowFavs]       = useState(false);
  const [favSongs, setFavSongs]       = useState([]);
  const [audioPlaying, setAudioPlaying] = useState(false);
  // Track which song card has its playlist picker open (by song _id or null)
  const [playlistPickerFor, setPlaylistPickerFor] = useState(null);
  const audioRef = useRef(null);
  const searchRef = useRef(null);
  const dq = useDebounce(query, 380);

  useEffect(() => {
    if (user) {
      fetchFavourites().then(r => setFavs(r.songs.map(s => s._id))).catch(() => {});
    } else {
      setFavs(getGuestFavs());
    }
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 18, sort };
      if (dq)             params.q        = dq;
      if (lang !== 'All') params.language = lang.toLowerCase();
      if (cat  !== 'All') params.category = cat.toLowerCase();
      const res = await fetchSongs(params);
      const normalized = Array.isArray(res) ? { songs: res, total: res.length } : res;
      setData(normalized);
    } catch (e) { console.error(e); setData({ songs: [], total: 0 }); }
    finally { setLoading(false); }
  }, [dq, lang, cat, sort, page]);

  useEffect(() => { setPage(1); }, [dq, lang, cat, sort]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showFavs || !favs.length) { setFavSongs([]); return; }
    Promise.all(favs.map(id => fetchSong(id).then(r => r.song).catch(() => null)))
      .then(r => setFavSongs(r.filter(Boolean)));
  }, [showFavs, favs]);

  const toggleFav = async (e, id) => {
    e.stopPropagation();
    if (user) {
      setFavs(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
      try {
        const res = await toggleFavourite(id);
        setFavs(res.favourites);
      } catch {
        setFavs(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
      }
    } else {
      setFavs(prev => {
        const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
        saveGuestFavs(next);
        return next;
      });
    }
  };

  const openSong = useCallback(async (id) => {
    setSelected(id); setTab('english'); setShowChords(false); setAudioPlaying(false);
    setPlaylistPickerFor(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    document.body.style.overflow = 'hidden';
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('song', id); return p; }, { replace: true });
    const res = await fetchSong(id);
    setDetail(res.song);
  }, [setSearchParams]);

  const closeSong = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSelected(null); setDetail(null); setShowChords(false); setAudioPlaying(false);
    document.body.style.overflow = '';
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('song'); return p; }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const songParam = searchParams.get('song');
    if (songParam && songParam !== selected) openSong(songParam);
  }, [searchParams]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && selected) closeSong(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, closeSong]);

  const handlePlayAudio = () => {
    if (!detail?.audioUrl) return;
    if (audioRef.current) {
      if (!audioRef.current.paused) { audioRef.current.pause(); setAudioPlaying(false); }
      else                          { audioRef.current.play();  setAudioPlaying(true);  }
      return;
    }
    const a = new Audio(resolveAudioUrl(detail.audioUrl));
    a.play();
    a.onended = () => setAudioPlaying(false);
    audioRef.current = a;
    setAudioPlaying(true);
  };

  const handleVoiceResult = (transcript) => { setQuery(transcript); setShowFavs(false); };

  const songs = Array.isArray(data) ? data : (data.songs ?? []);
  const total  = Array.isArray(data) ? data.length : (data?.total ?? 0);
  const totalPages = total ? Math.ceil(total / 18) : 1;

  // ── Song Card ──────────────────────────────────────────────────
  const SongCard = ({ song }) => {
    const isPickerOpen = playlistPickerFor === song._id;

    return (
      <div className="song-card" onClick={() => { setPlaylistPickerFor(null); openSong(song._id); }}
        role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && openSong(song._id)}>
        <div className="song-card-accent" />

        {/* Favourite button — top right */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFav(e, song._id); }}
          aria-label={favs.includes(song._id) ? 'Remove from favourites' : 'Add to favourites'}
          style={{
            position: 'absolute', top: 13, right: 13,
            background: 'none', border: 'none', cursor: 'pointer', padding: 3,
            color: favs.includes(song._id) ? '#ef4444' : 'var(--text-muted)',
            transition: 'color 0.15s, transform 0.15s', borderRadius: '50%',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseOut={e  => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Heart size={15} fill={favs.includes(song._id) ? '#ef4444' : 'none'} />
        </button>

        {/* Add to Playlist button — only shows when user is logged in, sits left of heart */}
        {user && (
          <div style={{ position: 'absolute', top: 10, right: 38 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPlaylistPickerFor(isPickerOpen ? null : song._id);
              }}
              aria-label="Add to playlist"
              title="Add to playlist"
              style={{
                background: isPickerOpen ? 'var(--brand-light)' : 'none',
                border: 'none', cursor: 'pointer', padding: 3, borderRadius: '50%',
                color: isPickerOpen ? '#fff' : 'var(--text-muted)',
                transition: 'color 0.15s, background 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseOver={e => { if (!isPickerOpen) { e.currentTarget.style.color = 'var(--brand-light)'; }}}
              onMouseOut={e  => { if (!isPickerOpen) { e.currentTarget.style.color = 'var(--text-muted)'; }}}
            >
              <ListPlus size={15} />
            </button>

            {/* Inline playlist picker dropdown */}
            {isPickerOpen && (
              <CardPlaylistPicker
                songId={song._id}
                onClose={() => setPlaylistPickerFor(null)}
              />
            )}
          </div>
        )}

        {song.songNumber && <div className="song-number">No. {song.songNumber}</div>}
        <div className="song-title">{song.title}</div>
        {(song.titleTelugu || song.titleHindi) && (
          <div className="song-title-alt">
            {song.titleTelugu && <span style={{ fontFamily: 'var(--font-telugu)' }}>{song.titleTelugu}</span>}
            {song.titleTelugu && song.titleHindi && ' · '}
            {song.titleHindi  && <span style={{ fontFamily: 'var(--font-hindi)' }}>{song.titleHindi}</span>}
          </div>
        )}
        <div className="song-meta" style={{ marginTop: 10 }}>
          <span className="badge badge-lang">{song.language}</span>
          <span className="badge badge-cat">{song.category}</span>
          {song.key       && <span className="badge badge-lang">♩ {song.key}</span>}
          {song.audioUrl  && <span className="badge badge-lang">🎵 Audio</span>}
          {song.youtubeUrl && <span className="badge badge-lang">▶ Video</span>}
        </div>
        {song.lyrics && (
          <div className="song-lyrics-preview">{song.lyrics.slice(0, 110)}…</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-logo" onClick={() => { setQuery(''); setShowFavs(false); }}>
            <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon"
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span className="header-logo-name">New Covenant Church</span>
              <span className="header-logo-sub">Songs Collection</span>
            </div>
          </Link>

          <div className="search-wrap header-search-desktop">
            <Search size={15} className="search-icon" />
            <input ref={searchRef} className="search-input" style={{ paddingRight: 64 }}
              placeholder="Search songs, lyrics, category, language…"
              value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search songs" />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 2 }}>
              {query && <button className="search-clear" style={{ position: 'static' }} onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={14} /></button>}
              <VoiceSearchButton onResult={handleVoiceResult} />
            </div>
          </div>

          <div className="header-actions">
            <button onClick={() => { setShowFavs(v => !v); setQuery(''); }} className="btn header-fav-btn"
              style={{ background: showFavs ? '#ef4444' : 'rgba(255,255,255,0.12)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)', position: 'relative', padding: '8px 14px' }} title="My Favourites">
              <Heart size={15} fill={showFavs ? '#fff' : 'none'} />
              <span className="fav-label">Favourites</span>
              {favs.length > 0 && (
                <span style={{ position: 'absolute', top: -7, right: -7, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 19, height: 19, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--brand-deep)' }}>{favs.length}</span>
              )}
            </button>
            <InstallAppButton />
            {user ? <AccountMenu /> : <Link to="/login" className="btn btn-gold"><LogIn size={14} /> <span className="signin-label">Sign In</span></Link>}
          </div>
        </div>

        <div className="header-search-mobile">
          <div className="search-wrap" style={{ margin: 0 }}>
            <Search size={15} className="search-icon" />
            <input className="search-input" style={{ paddingRight: 64 }} placeholder="Search songs, lyrics…"
              value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search songs" />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 2 }}>
              {query && <button className="search-clear" style={{ position: 'static' }} onClick={() => setQuery('')}><X size={14} /></button>}
              <VoiceSearchButton onResult={handleVoiceResult} />
            </div>
          </div>
        </div>
      </header>

      <div style={{ flex: 1 }}>
        {showFavs ? (
          <section className="songs-section">
            <div className="container">
              <div className="fav-panel-header">
                <Heart size={20} color="#ef4444" fill="#ef4444" />
                <h2>My Favourites</h2>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>{favs.length} song{favs.length !== 1 ? 's' : ''}</span>
              </div>
              {!user && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  💡 <Link to="/login" style={{ color: 'var(--brand-light)', fontWeight: 600 }}>Sign in</Link> to sync favourites across devices and build playlists.
                </div>
              )}
              <AdBanner />
              {favs.length === 0 ? (
                <div className="empty"><div className="empty-icon"><Heart size={48} /></div><h3>No favourites yet</h3><p>Tap ♥ on any song card to save it here</p></div>
              ) : favSongs.length === 0 ? <SkeletonGrid /> : (
                <div className="songs-grid">{favSongs.map(s => <SongCard key={s._id} song={s} />)}</div>
              )}
            </div>
          </section>
        ) : (
          <>
            {!query && (
              <section className="hero">
                <h1>Sing unto the <span>Lord</span> a new song</h1>
                <p>Search and sing along — English, Telugu &amp; Hindi worship songs</p>
                <div className="hero-langs">
                  {['English', 'తెలుగు', 'हिन्दी'].map(l => <span key={l} className="hero-lang-pill">{l}</span>)}
                </div>
              </section>
            )}

            <div className="filters">
              <div className="filters-scroll">
                <div className="desktop-filters">
                  <span className="filter-label">Lang</span>
                  {LANGUAGES.map(l => <button key={l} className={`filter-chip ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>{l}</button>)}
                  <span className="filter-divider" />
                  <span className="filter-label">Cat</span>
                  {CATEGORIES.map(c => <button key={c} className={`filter-chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
                </div>
                <div className="mobile-filters">
                  <select className="filter-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <select className="filter-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <select className="filter-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="songNumber">By No.</option>
                  <option value="title">A–Z</option>
                  <option value="newest">Newest</option>
                </select>
                {!loading && <span className="filter-count">{data?.total || 0} song{(data?.total || 0) !== 1 ? "s" : ""}</span>}
              </div>
            </div>

            <section className="songs-section">
              <div className="container">
                <AdBanner />
                {loading ? <SkeletonGrid /> : !data?.songs?.length ? (
                  <div className="empty"><div className="empty-icon"><Music size={48} /></div><h3>No songs found</h3><p>Try a different search term or clear your filters</p></div>
                ) : (
                  <>
                    <div className="songs-grid">
                      {(data?.songs || []).map(s => <SongCard key={s._id} song={s} />)}
                    </div>
                    {totalPages > 1 && (
                      <div className="pagination">
                        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15} /></button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                          <button key={p} className={`page-btn ${page === p ? 'active' : ''}`}
                            onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{p}</button>
                        ))}
                        <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={15} /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <Footer />

      {/* ── SONG DETAIL MODAL ─────────────────────────────────── */}
      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeSong(); }} role="dialog" aria-modal="true">
          <div className="modal" style={{ maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            <button className="modal-close-btn" onClick={closeSong} aria-label="Close"><X size={15} /></button>
            <div className="modal-header">
              {detail ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 44 }}>
                      {detail.songNumber && <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4, letterSpacing: 1 }}>SONG NO. {detail.songNumber}</div>}
                      <h2>{detail.title}</h2>
                      {detail.titleTelugu && <div style={{ fontFamily: 'var(--font-telugu)', fontSize: 15, opacity: 0.7, marginTop: 3 }}>{detail.titleTelugu}</div>}
                      <p style={{ marginTop: 6 }}>{detail.category} · {detail.language}{detail.key && ` · Key: ${detail.key}`}</p>
                    </div>
                    <button onClick={e => toggleFav(e, detail._id)}
                      style={{ marginTop: 28, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: '50%', width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: favs.includes(detail._id) ? '#fca5a5' : '#fff', transition: 'background 0.15s' }}>
                      <Heart size={15} fill={favs.includes(detail._id) ? '#fca5a5' : 'none'} />
                    </button>
                  </div>
                  <div className="modal-action-row">
                    {detail.youtubeUrl && <a href={detail.youtubeUrl} target="_blank" rel="noreferrer" className="btn btn-gold" style={{ fontSize: 13, padding: '7px 14px' }}><ExternalLink size={13} /> Watch on YouTube</a>}
                    {detail.audioUrl && <button className="btn btn-outline" style={{ fontSize: 13, padding: '7px 14px' }} onClick={handlePlayAudio}>{audioPlaying ? <><Pause size={13} fill="currentColor" /> Pause</> : <><Play size={13} fill="currentColor" /> Play Audio</>}</button>}
                    {detail.chords && <button className="btn btn-outline" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => setShowChords(v => !v)}><BookOpen size={13} /> {showChords ? 'Hide Chords' : 'Chords'}</button>}
                    <AddToPlaylistButton songId={detail._id} />
                    <ShareButton songId={detail._id} title={detail.title} />
                  </div>
                </>
              ) : <div style={{ opacity: 0.6, paddingRight: 44 }}>Loading song…</div>}
            </div>
            {detail && (
              <>
                {showChords && detail.chords && <div className="chords-panel"><div className="chords-label">Chords</div><pre className="chords-content">{detail.chords}</pre></div>}
                <div style={{ padding: '10px 26px 0' }}><AdBanner /></div>
                <div className="modal-tabs">
                  {[['english','English'],['telugu','తెలుగు'],['hindi','हिन्दी']].map(([key, label]) => (
                    (key === 'english' ? detail.lyrics : key === 'telugu' ? detail.lyricsTelugu : detail.lyricsHindi) && (
                      <button key={key} className={`modal-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
                    )
                  ))}
                </div>
                <div className="modal-body">
                  {tab === 'english' && <pre className="lyrics-block">{detail.lyrics}</pre>}
                  {tab === 'telugu'  && <pre className="lyrics-block telugu">{detail.lyricsTelugu}</pre>}
                  {tab === 'hindi'   && <pre className="lyrics-block hindi">{detail.lyricsHindi}</pre>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}