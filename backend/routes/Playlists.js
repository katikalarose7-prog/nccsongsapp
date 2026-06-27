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
   Returns a print-ready HTML page in a new browser tab.
   The user clicks "Print / Save as PDF" to save it.

   Why HTML instead of PDFKit:
   - Browser already has Telugu/Hindi fonts — same ones rendering lyrics now
   - PDFKit cannot shape complex scripts (Telugu conjuncts, Devanagari)
   - Zero extra packages or font files on the server
   - CSP-safe: all JS uses a per-request nonce, no inline handlers
   ─────────────────────────────────────────────────────────────────── */
router.get('/:id/pdf',
  // Accept token from query param since window.open cannot set headers
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

    // Per-request nonce for CSP — prevents inline script attacks
    const nonce = crypto.randomBytes(16).toString('base64');

    res.setHeader('Content-Security-Policy',
      `default-src 'self'; ` +
      `script-src 'nonce-${nonce}'; ` +
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

    const songsHtml = playlist.songs
      .filter(e => e.song)
      .map((entry, i) => {
        const s = entry.song;

        const variants = [
          { lang: 'english',  label: 'English',  cssClass: '',        title: s.title,       lyrics: s.lyrics       },
          { lang: 'telugu',   label: 'తెలుగు',   cssClass: 'telugu',  title: s.titleTelugu, lyrics: s.lyricsTelugu },
          { lang: 'hindi',    label: 'हिन्दी',    cssClass: 'hindi',   title: s.titleHindi,  lyrics: s.lyricsHindi  },
        ].filter(v => v.lyrics && v.lyrics.trim());

        const multiLang = variants.length > 1;

        const lyricBlocks = variants.map(v => `
          <div class="lyric-block">
            ${multiLang ? `<div class="lang-pill ${v.cssClass}-pill">${v.label}</div>` : ''}
            <pre class="lyrics ${v.cssClass}">${esc(v.lyrics)}</pre>
          </div>`).join('');

        const altTitles = [
          s.titleTelugu ? `<div class="title-telugu">${esc(s.titleTelugu)}</div>` : '',
          s.titleHindi  ? `<div class="title-hindi">${esc(s.titleHindi)}</div>`   : '',
        ].join('');

        const meta = [s.category, s.language, s.key ? `Key: ${s.key}` : '', s.tempo || '']
          .filter(Boolean).join(' · ');

        return `
          <div class="song-card">
            <div class="song-header">
              <div class="song-num">${String(i + 1).padStart(2, '0')}</div>
              <div class="song-title-wrap">
                <div class="song-title">${esc(s.title)}${s.songNumber ? ` <span class="song-badge">No.${s.songNumber}</span>` : ''}</div>
                ${altTitles}
                <div class="song-meta">${esc(meta)}</div>
              </div>
            </div>
            <div class="song-lyrics">
              ${lyricBlocks || '<p class="no-lyrics">(No lyrics)</p>'}
            </div>
          </div>`;
      }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(playlist.name)} — NCC Songs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&family=Inter:wght@400;500;600&display=swap">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;background:#f8f6ff;color:#111;font-size:13px}

    /* Print bar */
    .print-bar{position:fixed;top:0;left:0;right:0;z-index:99;background:#1a0533;color:#fff;
      padding:10px 24px;display:flex;align-items:center;justify-content:space-between;
      box-shadow:0 2px 12px rgba(0,0,0,0.3)}
    .print-bar-left{display:flex;align-items:center;gap:12px}
    .print-bar-logo{width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,0.4)}
    .print-bar-title{font-size:14px;font-weight:600}
    .print-bar-sub{font-size:11px;opacity:0.6}
    .print-btn{background:#f0a500;color:#1a0533;border:none;padding:9px 22px;
      border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
    .print-btn:hover{background:#e09600}

    /* Page */
    .page{max-width:800px;margin:0 auto;padding:72px 40px 60px}

    /* Document cover header */
    .doc-cover{background:#1a0533;color:#fff;border-radius:14px;padding:32px;
      text-align:center;margin-bottom:32px}
    .doc-cover img{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.3);
      background:#fff;display:block;margin:0 auto 16px}
    .doc-cover-church{font-size:11px;letter-spacing:2px;text-transform:uppercase;
      color:rgba(255,255,255,0.55);margin-bottom:6px}
    .doc-cover-name{font-size:24px;font-weight:700;color:#f0a500;margin-bottom:6px}
    .doc-cover-desc{font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:8px}
    .doc-cover-meta{font-size:11px;color:rgba(255,255,255,0.4)}

    /* Song card */
    .song-card{background:#fff;border-radius:12px;border:1.5px solid #e0d4ff;
      margin-bottom:20px;overflow:hidden}

    /* Song header bar */
    .song-header{background:#f5f0ff;border-bottom:1.5px solid #e0d4ff;
      padding:14px 20px;display:flex;align-items:flex-start;gap:14px}
    .song-num{background:#1a0533;color:#f0a500;border-radius:8px;
      min-width:36px;height:36px;display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;flex-shrink:0;letter-spacing:0.5px}
    .song-title-wrap{flex:1}
    .song-title{font-size:16px;font-weight:700;color:#1a0533;line-height:1.3}
    .song-badge{font-size:10px;font-weight:600;background:#e0d4ff;color:#3b0f6e;
      padding:2px 7px;border-radius:4px;margin-left:6px;vertical-align:middle}
    .title-telugu{font-family:'Noto Sans Telugu',sans-serif;font-size:13px;color:#1a5fb4;margin-top:3px}
    .title-hindi{font-family:'Noto Sans Devanagari',sans-serif;font-size:13px;color:#c2410c;margin-top:3px}
    .song-meta{font-size:11px;color:#888;margin-top:6px;text-transform:capitalize;letter-spacing:0.3px}

    /* Lyrics body */
    .song-lyrics{padding:16px 20px 20px 70px}
    .lyric-block{margin-bottom:16px}
    .lyric-block:last-child{margin-bottom:0}

    /* Language pills */
    .lang-pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;
      text-transform:uppercase;padding:2px 9px;border-radius:4px;margin-bottom:7px}
    .english-pill{background:#f0ebff;color:#3b0f6e}
    .telugu-pill{background:#e8f0fe;color:#1a5fb4}
    .hindi-pill{background:#fff1f0;color:#c2410c}
    .-pill{background:#f0ebff;color:#3b0f6e}

    /* Lyrics text */
    pre.lyrics{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#222;
      white-space:pre-wrap;word-break:break-word;line-height:1.9}
    pre.lyrics.telugu{font-family:'Noto Sans Telugu',sans-serif;font-size:14px;line-height:2.1}
    pre.lyrics.hindi{font-family:'Noto Sans Devanagari',sans-serif;font-size:14px;line-height:2.1}
    .no-lyrics{color:#bbb;font-style:italic;font-size:12px}

    /* Footer */
    .doc-footer{text-align:center;padding:24px 0 8px;
      font-size:11px;color:#aaa;border-top:1.5px solid #e0d4ff;margin-top:8px}

    /* Print styles */
    @media print{
      body{background:#fff;font-size:12px}
      .print-bar{display:none!important}
      .page{padding:20px 32px;margin:0;max-width:100%}
      .doc-cover{border-radius:0;margin:-20px -32px 24px;padding:24px 32px}
      .song-card{page-break-inside:avoid;border:1px solid #ccc;border-radius:8px;margin-bottom:16px}
      .song-card+.song-card{page-break-before:always}
      .song-lyrics{padding:14px 16px 16px 56px}
      pre.lyrics{font-size:11.5px;line-height:1.8}
      pre.lyrics.telugu,pre.lyrics.hindi{font-size:12.5px;line-height:2.0}
      .song-title{font-size:14px}
      .song-num{min-width:30px;height:30px;font-size:11px;border-radius:6px}
    }

    @media(max-width:600px){
      .page{padding:60px 14px 40px}
      .song-lyrics{padding:14px 14px 16px}
      pre.lyrics{font-size:12.5px}
    }
  </style>
</head>
<body>

<div class="print-bar">
  <div class="print-bar-left">
    <img class="print-bar-logo" src="/icons/icon-192.png" alt="NCC" onerror="this.style.display='none'">
    <div>
      <div class="print-bar-title">${esc(playlist.name)}</div>
      <div class="print-bar-sub">${playlist.songs.filter(e=>e.song).length} songs · NCC Songs</div>
    </div>
  </div>
  <button class="print-btn" id="printBtn">🖨 Print / Save as PDF</button>
</div>

<div class="page">

  <div class="doc-cover">
    <img src="/icons/icon-192.png" alt="New Covenant Church Logo" onerror="this.style.display='none'">
    <div class="doc-cover-church">New Covenant Church · Full Gospel</div>
    <div class="doc-cover-name">${esc(playlist.name)}</div>
    ${playlist.description ? `<div class="doc-cover-desc">${esc(playlist.description)}</div>` : ''}
    <div class="doc-cover-meta">
      ${playlist.songs.filter(e=>e.song).length} song${playlist.songs.filter(e=>e.song).length !== 1 ? 's' : ''}
      &nbsp;·&nbsp; ${date}
      &nbsp;·&nbsp; nccsongsapp.vercel.app
    </div>
  </div>

  ${songsHtml}

  <div class="doc-footer">
    New Covenant Church Songs &nbsp;·&nbsp; nccsongsapp.vercel.app &nbsp;·&nbsp; Generated ${date}
  </div>

</div>

<script nonce="${nonce}">
  document.getElementById('printBtn').addEventListener('click', function() {
    window.print();
  });
</script>

</body>
</html>`;

    res.send(html);
  }
);

module.exports = router;
