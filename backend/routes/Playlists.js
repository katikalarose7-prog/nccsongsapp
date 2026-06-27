const express = require('express');
const crypto  = require('crypto');
const { body, validationResult } = require('express-validator');
const Playlist = require('../models/Playlist');
const Song     = require('../models/Song');
const { requireUser } = require('../middleware/Userauth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

const loadOwnedPlaylist = async (req, res, next) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });
    if (String(playlist.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'You do not have access to this playlist' });
    req.playlist = playlist;
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid playlist id' });
  }
};

// GET /api/playlists
router.get('/', requireUser, async (req, res) => {
  const playlists = await Playlist.find({ owner: req.user._id })
    .sort({ updatedAt: -1 })
    .select('name description songs createdAt updatedAt');
  res.json({
    success: true,
    playlists: playlists.map(p => ({
      _id: p._id, name: p.name, description: p.description,
      songCount: p.songs.length, createdAt: p.createdAt, updatedAt: p.updatedAt,
    })),
  });
});

// POST /api/playlists
router.post('/',
  requireUser,
  [body('name').trim().isLength({ min: 1, max: 120 }).escape()],
  validate,
  async (req, res) => {
    try {
      const playlist = await Playlist.create({
        name: req.body.name,
        description: req.body.description || '',
        owner: req.user._id,
      });
      res.status(201).json({ success: true, playlist });
    } catch {
      res.status(400).json({ success: false, message: 'Could not create playlist' });
    }
  }
);

// GET /api/playlists/:id
router.get('/:id', requireUser, loadOwnedPlaylist, async (req, res) => {
  await req.playlist.populate('songs.song');
  res.json({ success: true, playlist: req.playlist });
});

// PUT /api/playlists/:id
router.put('/:id',
  requireUser, loadOwnedPlaylist,
  [body('name').optional().trim().isLength({ min: 1, max: 120 }).escape()],
  validate,
  async (req, res) => {
    if (req.body.name !== undefined) req.playlist.name = req.body.name;
    if (req.body.description !== undefined) req.playlist.description = req.body.description;
    await req.playlist.save();
    res.json({ success: true, playlist: req.playlist });
  }
);

// DELETE /api/playlists/:id
router.delete('/:id', requireUser, loadOwnedPlaylist, async (req, res) => {
  await req.playlist.deleteOne();
  res.json({ success: true, message: 'Playlist deleted' });
});

// POST /api/playlists/:id/songs
router.post('/:id/songs',
  requireUser, loadOwnedPlaylist,
  [body('songId').isMongoId()],
  validate,
  async (req, res) => {
    const song = await Song.findById(req.body.songId);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    const already = req.playlist.songs.some(s => String(s.song) === String(song._id));
    if (!already) req.playlist.songs.push({ song: song._id });
    await req.playlist.save();
    res.json({ success: true, playlist: req.playlist });
  }
);

// DELETE /api/playlists/:id/songs/:songId
router.delete('/:id/songs/:songId', requireUser, loadOwnedPlaylist, async (req, res) => {
  req.playlist.songs = req.playlist.songs.filter(s => String(s.song) !== String(req.params.songId));
  await req.playlist.save();
  res.json({ success: true, playlist: req.playlist });
});

/* ── GET /api/playlists/:id/pdf ─────────────────────────────────────
   Returns a print-ready HTML page that auto-downloads as PDF via
   html2pdf.js (CDN). No logo, professional songbook design.
   ─────────────────────────────────────────────────────────────────── */
router.get('/:id/pdf',
  async (req, res, next) => {
    const jwt  = require('jsonwebtoken');
    const User = require('../models/User');
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }
    if (!token) return res.status(401).send('<h2 style="font-family:sans-serif;padding:40px">Not authenticated. Please log in.</h2>');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'user') return res.status(403).send('<h2 style="font-family:sans-serif;padding:40px">Access denied.</h2>');
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) return res.status(401).send('<h2 style="font-family:sans-serif;padding:40px">Account not found.</h2>');
      req.user = user;
      next();
    } catch {
      return res.status(401).send('<h2 style="font-family:sans-serif;padding:40px">Session expired — please log in again.</h2>');
    }
  },
  loadOwnedPlaylist,
  async (req, res) => {
    await req.playlist.populate('songs.song');
    const playlist = req.playlist;

    const nonce = crypto.randomBytes(16).toString('base64');

    res.setHeader('Content-Security-Policy',
      `default-src 'self'; ` +
      `script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com; ` +
      `style-src 'unsafe-inline' https://fonts.googleapis.com; ` +
      `font-src https://fonts.gstatic.com; ` +
      `img-src 'self' data: https:; ` +
      `connect-src 'none'`
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const esc = (str) => (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const songCount = playlist.songs.filter(e => e.song).length;

    const songsHtml = playlist.songs
      .filter(e => e.song)
      .map((entry, i) => {
        const s = entry.song;

        const variants = [
          { lang: 'english', label: 'English',  cssClass: '',       title: s.title,       lyrics: s.lyrics       },
          { lang: 'telugu',  label: 'తెలుగు',  cssClass: 'telugu', title: s.titleTelugu, lyrics: s.lyricsTelugu },
          { lang: 'hindi',   label: 'हिन्दी',   cssClass: 'hindi',  title: s.titleHindi,  lyrics: s.lyricsHindi  },
        ].filter(v => v.lyrics && v.lyrics.trim());

        const multiLang = variants.length > 1;

        const lyricBlocks = variants.map(v => `
          <div class="lyric-block">
            ${multiLang ? `<div class="lang-tag ${v.lang}-tag">${v.label}</div>` : ''}
            <pre class="lyrics ${v.cssClass}">${esc(v.lyrics)}</pre>
          </div>`).join('');

        const altTitles = [
          s.titleTelugu ? `<span class="alt-title telugu">${esc(s.titleTelugu)}</span>` : '',
          s.titleHindi  ? `<span class="alt-title hindi">${esc(s.titleHindi)}</span>`   : '',
        ].filter(Boolean).join('');

        const metaParts = [s.category, s.language, s.key ? `Key: ${s.key}` : '', s.tempo || ''].filter(Boolean);

        return `
<div class="song-card" id="song-${i+1}">
  <div class="song-header">
    <div class="song-index">${String(i + 1).padStart(2, '0')}</div>
    <div class="song-info">
      <div class="song-title">${esc(s.title)}${s.songNumber ? `<span class="song-num-badge">#${s.songNumber}</span>` : ''}</div>
      ${altTitles ? `<div class="alt-titles">${altTitles}</div>` : ''}
      ${metaParts.length ? `<div class="song-meta">${metaParts.map(esc).join('<span class="sep">·</span>')}</div>` : ''}
    </div>
  </div>
  <div class="song-body">
    ${lyricBlocks || '<p class="no-lyrics">No lyrics available</p>'}
  </div>
</div>`;
      }).join('\n');

    const safeFilename = (playlist.name || 'playlist').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'playlist';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(playlist.name)} — NCC Songs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --navy:    #0f1c3f;
      --navy-mid:#1b2f5e;
      --gold:    #b8963e;
      --gold-lt: #d4ae5c;
      --ink:     #1a1a2e;
      --muted:   #5a6480;
      --rule:    #d0d5e8;
      --bg:      #f7f8fc;
      --card-bg: #ffffff;
      --telugu-c:#1e4a8a;
      --hindi-c: #8a2020;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      font-size: 13.5px;
      line-height: 1.6;
    }

    /* ── Toolbar ── */
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: var(--navy);
      padding: 0 32px;
      height: 56px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 2px 16px rgba(0,0,0,0.25);
    }
    .toolbar-left {
      display: flex; flex-direction: column; gap: 1px;
    }
    .toolbar-title {
      font-family: 'Lora', Georgia, serif;
      font-size: 15px; font-weight: 600;
      color: #ffffff; letter-spacing: 0.01em;
    }
    .toolbar-sub {
      font-size: 11px; color: rgba(255,255,255,0.45); letter-spacing: 0.03em;
    }
    .download-btn {
      display: flex; align-items: center; gap: 8px;
      background: var(--gold);
      color: #fff;
      border: none;
      padding: 9px 20px;
      border-radius: 6px;
      font-family: 'Inter', sans-serif;
      font-size: 13px; font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: background 0.15s;
    }
    .download-btn:hover { background: var(--gold-lt); }
    .download-btn svg { flex-shrink: 0; }
    .btn-label { display: inline; }
    .btn-spinner { display: none; }
    .download-btn.loading .btn-label { display: none; }
    .download-btn.loading .btn-spinner { display: inline; }

    /* ── Page wrapper ── */
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 80px 40px 60px;
    }

    /* ── Document header ── */
    .doc-header {
      padding: 36px 0 28px;
      border-bottom: 2px solid var(--navy);
      margin-bottom: 36px;
    }
    .doc-eyebrow {
      font-size: 21px; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase;
      color: #172d7cbf; margin-bottom: 10px;
      text-align:center;
    }
    .doc-title {
      font-family: 'Lora', Georgia, serif;
      font-size: 20px; font-weight: 700;
      color: var(--navy); line-height: 1.2;
      margin-bottom: 8px;
    }
    .doc-desc {
      font-size: 13px; color: var(--muted);
      margin-bottom: 14px;
    }
    .doc-rule {
      width: 48px; height: 3px;
      background: var(--gold); border-radius: 2px;
      margin-bottom: 14px;
    }
    .doc-meta {
      font-size: 11.5px; color: var(--muted);
      display: flex; gap: 146px; flex-wrap: wrap;justify-content:center;
    }
    .doc-meta span { display: flex; align-items: center; gap: 5px; }

    /* ── Song card ── */
    .song-card {
      background: var(--card-bg);
      border: 1px solid var(--rule);
      border-radius: 10px;
      margin-bottom: 20px;
      overflow: hidden;
    }

    .song-header {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--rule);
      background: #f2f4fb;
    }

    .song-index {
      font-family: 'Lora', Georgia, serif;
      font-size: 22px; font-weight: 700;
      color: var(--gold);
      min-width: 36px;
      line-height: 1;
      padding-top: 3px;
    }

    .song-info { flex: 1; min-width: 0; }

    .song-title {
      font-family: 'Lora', Georgia, serif;
      font-size: 16px; font-weight: 700;
      color: var(--navy); line-height: 1.3;
      display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
    }
    .song-num-badge {
      font-family: 'Inter', sans-serif;
      font-size: 10px; font-weight: 600;
      color: var(--gold); border: 1px solid var(--gold);
      padding: 1px 6px; border-radius: 3px;
      letter-spacing: 0.04em;
    }

    .alt-titles {
      display: flex; flex-wrap: wrap; gap: 10px;
      margin-top: 4px;
    }
    .alt-title {
      font-size: 12.5px;
    }
    .alt-title.telugu {
      font-family: 'Noto Sans Telugu', sans-serif;
      color: var(--telugu-c);
    }
    .alt-title.hindi {
      font-family: 'Noto Sans Devanagari', sans-serif;
      color: var(--hindi-c);
    }

    .song-meta {
      font-size: 11px; color: var(--muted);
      margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;
      text-transform: capitalize; letter-spacing: 0.02em;
    }
    .sep { margin: 0 2px; color: var(--rule); }

    /* ── Lyrics body ── */
    .song-body {
      padding: 18px 22px 20px 74px;
    }

    .lyric-block { margin-bottom: 18px; }
    .lyric-block:last-child { margin-bottom: 0; }

    .lang-tag {
      display: inline-block;
      font-size: 9.5px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding: 2px 8px; border-radius: 3px;
      margin-bottom: 8px;
    }
    .english-tag { background: #eef0f8; color: var(--navy-mid); }
    .telugu-tag  { background: #e8f0fe; color: var(--telugu-c); }
    .hindi-tag   { background: #fdeaea; color: var(--hindi-c); }

    pre.lyrics {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 13px; color: #2c2c3e;
      white-space: pre-wrap; word-break: break-word;
      line-height: 1.95;
    }
    pre.lyrics.telugu {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 14px; line-height: 2.15;
    }
    pre.lyrics.hindi {
      font-family: 'Noto Sans Devanagari', sans-serif;
      font-size: 14px; line-height: 2.15;
    }

    .no-lyrics { font-size: 12px; color: #aaa; font-style: italic; }

    /* ── Footer ── */
    .doc-footer {
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid var(--rule);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; color: var(--muted);
    }

    /* ── Print / PDF styles ── */
    @media print {
      body { background: #fff; font-size: 12px; }
      .toolbar { display: none !important; }
      .page { padding: 20px 32px; max-width: 100%; margin: 0; }
      .doc-header { padding: 0 0 20px; margin-bottom: 24px; }
      .doc-title { font-size: 24px; }
      .song-card {
        page-break-inside: avoid;
        border: 1px solid #ccc;
        border-radius: 6px;
        margin-bottom: 16px;
        box-shadow: none;
      }
      .song-card + .song-card { page-break-before: auto; }
      .song-body { padding: 14px 18px 16px 56px; }
      pre.lyrics { font-size: 11.5px; line-height: 1.8; }
      pre.lyrics.telugu, pre.lyrics.hindi { font-size: 12.5px; line-height: 2.0; }
    }

    @media (max-width: 600px) {
      .page { padding: 72px 16px 40px; }
      .song-body { padding: 14px 16px 16px; }
      .btn-label { display: none; }
      .toolbar { padding: 0 16px; }
    }
  </style>
</head>
<body>

<div class="toolbar">
  <div class="toolbar-left">
    <div class="toolbar-title">${esc(playlist.name)}</div>
    <div class="toolbar-sub">${songCount} song${songCount !== 1 ? 's' : ''} &nbsp;·&nbsp; NCC Songs</div>
  </div>
  <button class="download-btn" id="downloadBtn" aria-label="Download PDF">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span class="btn-label">Download PDF</span>
    <span class="btn-spinner">Preparing…</span>
  </button>
</div>

<div class="page" id="pdfContent">

  <div class="doc-header">
    <div class="doc-eyebrow">New Covenant Church</div>
    <div class="doc-eyebrow">Full Gospel</div>
    <div class="doc-title">${esc(playlist.name)}</div>
    ${playlist.description ? `<div class="doc-desc">${esc(playlist.description)}</div>` : ''}
    <div class="doc-rule"></div>
    <div class="doc-meta">
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        ${songCount} song${songCount !== 1 ? 's' : ''}
      </span>
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${date}
      </span>
    </div>
  </div>

  ${songsHtml}

  <div class="doc-footer">
    <span>New Covenant Church Songs</span>
    <span>nccsongsapp.vercel.app</span>
  </div>

</div>

<script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script nonce="${nonce}">
  var btn = document.getElementById('downloadBtn');
  var filename = ${JSON.stringify(safeFilename + '.pdf')};

  btn.addEventListener('click', function() {
    btn.classList.add('loading');
    btn.disabled = true;

    var element = document.getElementById('pdfContent');
    var opt = {
      margin:      [12, 14, 12, 14],
      filename:    filename,
      image:       { type: 'jpeg', quality: 0.97 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css'] }
    };

    html2pdf().set(opt).from(element).save().then(function() {
      btn.classList.remove('loading');
      btn.disabled = false;
    }).catch(function() {
      // Fallback to print dialog if html2pdf fails
      btn.classList.remove('loading');
      btn.disabled = false;
      window.print();
    });
  });
</script>

</body>
</html>`;

    res.send(html);
  }
);

module.exports = router;