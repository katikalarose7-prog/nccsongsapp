import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ExternalLink, BookOpen, ChevronLeft, ChevronRight, Music, Heart, Play, Pause, LogIn } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchSongs, fetchSong, resolveAudioUrl, toggleFavourite, fetchFavourites } from '../services/api';
import { useUserAuth } from '../context/Userauthcontext';
import Footer from '../components/Footer';
import VoiceSearchButton from '../components/Voicesearchbutton';
import ShareButton from '../components/Sharebutton';
import AddToPlaylistButton from '../components/Addtoplaylistbutton';
import AccountMenu from '../components/AccountMenu';
import InstallAppButton from '../components/InstallAppButton';

const LANGUAGES  = ['All','English','Telugu','Hindi','Multilingual'];
const CATEGORIES = ['All','Worship','Praise','Christmas','Resurrection','Communion','Wedding','Death','Thanksgiving','Other'];

// Guest favourites (not logged in) still persist locally so the feature
// works without forcing an account; once logged in we use the server list.
const GUEST_FAV_KEY  = 'ncc_guest_favourites';
const getGuestFavs  = () => { try { return JSON.parse(localStorage.getItem(GUEST_FAV_KEY) || '[]'); } catch { return []; } };
const saveGuestFavs = (ids) => localStorage.setItem(GUEST_FAV_KEY, JSON.stringify(ids));

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ── Skeleton loader ───────────────────────────────────────────────
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

// ── Ad Banner ─────────────────────────────────────────────────────
function AdBanner() {
  return (
    <div className="ad-banner">
      <div>
        <div className="ad-banner-label">Sponsored</div>
        <div className="ad-banner-title">🙏 Support This Ministry</div>
        <div className="ad-banner-sub">Your gift keeps NCC Songs free for all churches worldwide</div>
      </div>
      <a href="https://yourdonationlink.com" target="_blank" rel="noreferrer">
        <button className="ad-banner-btn">Donate ❤️</button>
      </a>
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
const [data, setData] = useState({
  songs: [],
  page: 1,
  pages: 1,
  total: 0,
});  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [tab, setTab]                 = useState('english');
  const [showChords, setShowChords]   = useState(false);
  const [favs, setFavs]               = useState(getGuestFavs); // array of song IDs, source depends on login state
  const [showFavs, setShowFavs]       = useState(false);
  const [favSongs, setFavSongs]       = useState([]);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);
  const searchRef = useRef(null);
  const dq = useDebounce(query, 380);

  // ── Sync favourites source: server list when logged in, else guest localStorage ──
  useEffect(() => {
    if (user) {
      fetchFavourites().then(r => setFavs(r.songs.map(s => s._id))).catch(() => {});
    } else {
      setFavs(getGuestFavs());
    }
  }, [user]);

  // ── Load songs ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 18, sort };
      if (dq)           params.q        = dq;
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

  // ── Load fav details ───────────────────────────────────────────
  useEffect(() => {
    if (!showFavs || !favs.length) { setFavSongs([]); return; }
    Promise.all(favs.map(id => fetchSong(id).then(r => r.song).catch(() => null)))
      .then(r => setFavSongs(r.filter(Boolean)));
  }, [showFavs, favs]);

  // ── Favourites ─────────────────────────────────────────────────
  const toggleFav = async (e, id) => {
    e.stopPropagation();
    if (user) {
      // Optimistic update, then confirm with server
      setFavs(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
      try {
        const res = await toggleFavourite(id);
        setFavs(res.favourites);
      } catch {
        // revert on failure
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

  // ── Modal open/close ───────────────────────────────────────────
  const openSong = useCallback(async (id) => {
    setSelected(id); setTab('english'); setShowChords(false); setAudioPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    document.body.style.overflow = 'hidden';
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('song', id); return p; }, { replace: true });
    const res = await fetchSong(id);
    setDetail(res.song);
  }, [setSearchParams]);

  const closeSong = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSelected(null);
    setDetail(null);
    setShowChords(false);
    setAudioPlaying(false);
    document.body.style.overflow = '';
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('song'); return p; }, { replace: true });
  }, [setSearchParams]);

  // ── Deep-link support: ?song=<id> opens that song automatically.
  // This is what makes WhatsApp/social shares open the right song. ──
  useEffect(() => {
    const songParam = searchParams.get('song');
    if (songParam && songParam !== selected) {
      openSong(songParam);
    }
  }, [searchParams]);

  // close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && selected) closeSong(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, closeSong]);

  // ── Audio ──────────────────────────────────────────────────────
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

  // ── Voice search result handler ──────────────────────────────────
  const handleVoiceResult = (transcript) => {
    setQuery(transcript);
    setShowFavs(false);
  };

 // const totalPages = data ? Math.ceil(data.total / 18) : 1;
// fix
const songs = Array.isArray(data) ? data : (data.songs ?? []);
const total  = Array.isArray(data) ? data.length : (data?.total ?? 0);
const totalPages = total ? Math.ceil(total / 18) : 1;
  // ── Song Card ──────────────────────────────────────────────────
  const SongCard = ({ song }) => (
    <div className="song-card" onClick={() => openSong(song._id)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && openSong(song._id)}>
      <div className="song-card-accent" />
      <button
        onClick={(e) => toggleFav(e, song._id)}
        aria-label={favs.includes(song._id) ? 'Remove from favourites' : 'Add to favourites'}
        style={{
          position: 'absolute', top: 13, right: 13,
          background: 'none', border: 'none', cursor: 'pointer', padding: 3,
          color: favs.includes(song._id) ? '#ef4444' : 'var(--text-muted)',
          transition: 'color 0.15s, transform 0.15s',
          borderRadius: '50%',
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'}
        onMouseOut={e  => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Heart size={15} fill={favs.includes(song._id) ? '#ef4444' : 'none'} />
      </button>

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
        {song.key      && <span className="badge badge-lang">♩ {song.key}</span>}
        {song.audioUrl && <span className="badge badge-lang">🎵 Audio</span>}
        {song.youtubeUrl && <span className="badge badge-lang">▶ Video</span>}
      </div>
      {song.lyrics && (
        <div className="song-lyrics-preview">{song.lyrics.slice(0, 110)}…</div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-logo" onClick={() => { setQuery(''); setShowFavs(false); }}>
            <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon" style={{borderRadius:'50%', objectFit:'cover'}} />
            <div>
              <span className="header-logo-name">New Covenant Church</span>
              <span className="header-logo-sub">Songs Collection</span>
            </div>
          </Link>

          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              ref={searchRef}
              className="search-input"
              style={{ paddingRight: 64 }}
              placeholder="Search songs, lyrics, category, language…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search songs"
            />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 2 }}>
              {query && (
                <button className="search-clear" style={{ position: 'static' }} onClick={() => { setQuery(''); searchRef.current?.focus(); }}>
                  <X size={14} />
                </button>
              )}
              <VoiceSearchButton onResult={handleVoiceResult} />
            </div>
          </div>

          <div className="header-actions">
            <button
              onClick={() => { setShowFavs(v => !v); setQuery(''); }}
              className="btn"
              style={{
                background: showFavs ? '#ef4444' : 'rgba(255,255,255,0.12)',
                color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)',
                position: 'relative', padding: '8px 14px',
              }}
              title="My Favourites"
            >
              <Heart size={15} fill={showFavs ? '#fff' : 'none'} />
              {!showFavs && <span style={{ fontSize: 13 }}>Favourites</span>}
              {favs.length > 0 && (
                <span style={{
                  position: 'absolute', top: -7, right: -7,
                  background: '#ef4444', color: '#fff', borderRadius: '50%',
                  width: 19, height: 19, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--brand-deep)',
                }}>{favs.length}</span>
              )}
            </button>

            <InstallAppButton />

            {/* Admin login intentionally removed from header — it now lives only in the footer. */}
            {user ? (
              <AccountMenu />
            ) : (
              <Link to="/login" className="btn btn-gold">
                <LogIn size={14} /> Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1 }}>
        {/* ── FAVOURITES PANEL ────────────────────────────────────── */}
        {showFavs ? (
          <section className="songs-section">
            <div className="container">
              <div className="fav-panel-header">
                <Heart size={20} color="#ef4444" fill="#ef4444" />
                <h2>My Favourites</h2>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
                  {favs.length} song{favs.length !== 1 ? 's' : ''}
                </span>
              </div>
              {!user && (
                <div style={{
                  background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '10px 16px',
                  fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16,
                }}>
                  💡 <Link to="/login" style={{ color: 'var(--brand-light)', fontWeight: 600 }}>Sign in</Link> to sync favourites across devices and build playlists.
                </div>
              )}
              <AdBanner />
              {favs.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon"><Heart size={48} /></div>
                  <h3>No favourites yet</h3>
                  <p>Tap ♥ on any song card to save it here</p>
                </div>
              ) : favSongs.length === 0 ? (
                <SkeletonGrid />
              ) : (
                <div className="songs-grid">
                  {favSongs.map(s => <SongCard key={s._id} song={s} />)}
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* ── HERO ──────────────────────────────────────────── */}
            {!query && (
              <section className="hero">
                <h1>Sing unto the <span>Lord</span> a new song</h1>
                <p>Search and sing along — English, Telugu &amp; Hindi worship songs</p>
                <div className="hero-langs">
                  {['🇬🇧 English', '🇮🇳 తెలుగు', '🕌 हिन्दी'].map(l => (
                    <span key={l} className="hero-lang-pill">{l}</span>
                  ))}
                </div>
              </section>
            )}

            {/* ── FILTERS ─────────────────────────────────────────── */}
            <div className="filters">
              <span className="filter-label">Lang</span>
              {LANGUAGES.map(l => (
                <button key={l} className={`filter-chip ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>{l}</button>
              ))}
              <span className="filter-label" style={{ marginLeft: 6 }}>Cat</span>
              {CATEGORIES.map(c => (
                <button key={c} className={`filter-chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
              <select className="filter-sort" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="songNumber">By No.</option>
                <option value="title">A–Z</option>
                <option value="newest">Newest</option>
              </select>
              {data && !loading && (
                <span className="filter-count">
  {data?.total || 0} song{(data?.total || 0) !== 1 ? 's' : ''}
                  </span>
              )}
            </div>

            {/* ── SONGS GRID ──────────────────────────────────────── */}
            <section className="songs-section">
              <div className="container">
                <AdBanner />
                {loading ? (
                  <SkeletonGrid />
                ) : !data?.songs?.length ? (
                  <div className="empty">
                    <div className="empty-icon"><Music size={48} /></div>
                    <h3>No songs found</h3>
                    <p>Try a different search term or clear your filters</p>
                  </div>
                ) : (
                  <>
                    <div className="songs-grid">
{(data?.songs || []).map(s => <SongCard key={s._id} song={s} />)}</div>

                    {totalPages > 1 && (
                      <div className="pagination">
                        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                          <ChevronLeft size={15} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                          <button key={p} className={`page-btn ${page === p ? 'active' : ''}`}
                            onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            {p}
                          </button>
                        ))}
                        <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                          <ChevronRight size={15} />
                        </button>
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

      {/* ── SONG DETAIL MODAL ───────────────────────────────────── */}
      {selected && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeSong(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal">
            <button className="modal-close-btn" onClick={closeSong} aria-label="Close">
              <X size={15} />
            </button>

            <div className="modal-header">
              {detail ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 44 }}>
                      {detail.songNumber && (
                        <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4, letterSpacing: 1 }}>
                          SONG NO. {detail.songNumber}
                        </div>
                      )}
                      <h2>{detail.title}</h2>
                      {detail.titleTelugu && (
                        <div style={{ fontFamily: 'var(--font-telugu)', fontSize: 15, opacity: 0.7, marginTop: 3 }}>
                          {detail.titleTelugu}
                        </div>
                      )}
                      <p style={{ marginTop: 6 }}>
                        {detail.category} · {detail.language}
                        {detail.key && ` · Key: ${detail.key}`}
                      </p>
                    </div>
                    <button
                      onClick={e => toggleFav(e, detail._id)}
                      style={{
                        marginTop: 28, background: 'rgba(255,255,255,0.12)',
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        borderRadius: '50%', width: 38, height: 38, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: favs.includes(detail._id) ? '#fca5a5' : '#fff',
                        transition: 'background 0.15s',
                      }}
                    >
                      <Heart size={15} fill={favs.includes(detail._id) ? '#fca5a5' : 'none'} />
                    </button>
                  </div>

                  <div className="modal-action-row">
                    {detail.youtubeUrl && (
                      <a href={detail.youtubeUrl} target="_blank" rel="noreferrer" className="btn btn-gold" style={{ fontSize: 13, padding: '7px 14px' }}>
                        <ExternalLink size={13} /> Watch on YouTube
                      </a>
                    )}
                    {detail.audioUrl && (
                      <button className="btn btn-outline" style={{ fontSize: 13, padding: '7px 14px' }} onClick={handlePlayAudio}>
                        {audioPlaying ? <><Pause size={13} fill="currentColor" /> Pause</> : <><Play size={13} fill="currentColor" /> Play Audio</>}
                      </button>
                    )}
                    {detail.chords && (
                      <button className="btn btn-outline" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => setShowChords(v => !v)}>
                        <BookOpen size={13} /> {showChords ? 'Hide Chords' : 'Chords'}
                      </button>
                    )}
                    <AddToPlaylistButton songId={detail._id} />
                    <ShareButton songId={detail._id} title={detail.title} />
                  </div>
                </>
              ) : (
                <div style={{ opacity: 0.6, paddingRight: 44 }}>Loading song…</div>
              )}
            </div>

            {detail && (
              <>
                {showChords && detail.chords && (
                  <div className="chords-panel">
                    <div className="chords-label">Chords</div>
                    <pre className="chords-content">{detail.chords}</pre>
                  </div>
                )}

                <div style={{ padding: '10px 26px 0' }}>
                  <AdBanner />
                </div>

                <div className="modal-tabs">
                  {[['english','English'],['telugu','తెలుగు'],['hindi','हिन्दी']].map(([key, label]) => (
                    (key === 'english' ? detail.lyrics : key === 'telugu' ? detail.lyricsTelugu : detail.lyricsHindi) && (
                      <button key={key} className={`modal-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                        {label}
                      </button>
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