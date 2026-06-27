const express = require('express');
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
    if (String(playlist.owner) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this playlist' });
    }
    req.playlist = playlist;
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid playlist id' });
  }
};

// GET /api/playlists — list the logged-in user's playlists
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

/* ── GET /api/playlists/:id/pdf ────────────────────────────────────
   Returns a print-ready HTML page instead of a PDF binary.
   The frontend opens this in a new tab — the user presses Ctrl+P
   (desktop) or Share→Print (mobile) to save/print as PDF.

   Why HTML instead of PDFKit:
   - Browser already has Telugu/Hindi/English fonts built in
   - PDFKit cannot render complex scripts (Telugu conjuncts etc.)
   - Zero extra packages or font files needed on the server
   - Better layout, page breaks, and print styling
   ──────────────────────────────────────────────────────────────── */
// PDF route accepts token via query param (?token=...) because
// window.open() in the browser cannot set Authorization headers.
// We validate it the same way requireUser does.
router.get('/:id/pdf', async (req, res, next) => {
  const jwt  = require('jsonwebtoken');
  const User = require('../models/User');
  // Check Authorization header first, then fall back to ?token= query param
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).send('<h2>Not authenticated</h2>');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'user') return res.status(403).send('<h2>Access denied</h2>');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).send('<h2>Account not found</h2>');
    req.user = user;
    next();
  } catch {
    return res.status(401).send('<h2>Session expired — please log in again</h2>');
  }
}, loadOwnedPlaylist, async (req, res) => {
  await req.playlist.populate('songs.song');

  const playlist = req.playlist;
  const date = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Escape HTML special characters to prevent XSS in song content
  const esc = (str) => (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Build each song's HTML block
  const songsHtml = playlist.songs
    .filter(e => e.song)
    .map((entry, i) => {
      const s = entry.song;

      const titleLine = esc(s.title);
      const titleTelugu = s.titleTelugu ? `<div class="title-alt">${esc(s.titleTelugu)}</div>` : '';
      const titleHindi  = s.titleHindi  ? `<div class="title-alt">${esc(s.titleHindi)}</div>`  : '';

      const metaParts = [
        s.category, s.language,
        s.key ? `Key: ${s.key}` : '',
        s.tempo || '',
      ].filter(Boolean).join(' · ');

      // Build lyrics sections — only show languages that have content
      const lyricsSections = [];

      if (s.lyrics && s.lyrics.trim()) {
        lyricsSections.push(`
          <div class="lyrics-section">
            ${s.lyricsTelugu || s.lyricsHindi ? '<div class="lang-label">English</div>' : ''}
            <pre class="lyrics">${esc(s.lyrics)}</pre>
          </div>`);
      }

      if (s.lyricsTelugu && s.lyricsTelugu.trim()) {
        lyricsSections.push(`
          <div class="lyrics-section">
            <div class="lang-label telugu-label">తెలుగు</div>
            <pre class="lyrics telugu">${esc(s.lyricsTelugu)}</pre>
          </div>`);
      }

      if (s.lyricsHindi && s.lyricsHindi.trim()) {
        lyricsSections.push(`
          <div class="lyrics-section">
            <div class="lang-label hindi-label">हिन्दी</div>
            <pre class="lyrics hindi">${esc(s.lyricsHindi)}</pre>
          </div>`);
      }

      if (lyricsSections.length === 0) {
        lyricsSections.push('<p class="no-lyrics">(No lyrics available)</p>');
      }

      return `
        <div class="song" ${i > 0 ? 'style="page-break-before: auto"' : ''}>
          <div class="song-header">
            <div class="song-number">${i + 1}</div>
            <div class="song-titles">
              <div class="song-title">${titleLine}${s.songNumber ? ` <span class="song-num-badge">No. ${s.songNumber}</span>` : ''}</div>
              ${titleTelugu}${titleHindi}
              <div class="song-meta">${esc(metaParts)}</div>
            </div>
          </div>
          <div class="song-body">
            ${lyricsSections.join('')}
          </div>
        </div>`;
    }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(playlist.name)} — NCC Songs</title>

  <!-- Google Fonts: Telugu + Devanagari + English — loads in browser -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Serif:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    /* ── Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Noto Serif', Georgia, serif;
      background: #fff;
      color: #111;
      font-size: 13px;
      line-height: 1.6;
    }

    /* ── Screen wrapper ── */
    .page { max-width: 780px; margin: 0 auto; padding: 32px 40px 60px; }

    /* ── Document header ── */
    .doc-header {
      text-align: center;
      border-bottom: 3px solid #1a0533;
      padding-bottom: 20px;
      margin-bottom: 32px;
    }
    .doc-header .church-name {
      font-size: 13px;
      font-weight: 600;
      color: #888;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .doc-header h1 {
      font-size: 26px;
      font-weight: 700;
      color: #1a0533;
      margin-bottom: 6px;
    }
    .doc-header .desc {
      font-size: 13px;
      color: #666;
      margin-bottom: 6px;
    }
    .doc-header .meta {
      font-size: 11px;
      color: #aaa;
    }

    /* ── Song block ── */
    .song {
      margin-bottom: 0;
      padding: 24px 0;
      border-bottom: 1.5px solid #e0d4ff;
    }
    .song:last-child { border-bottom: none; }

    /* ── Song header ── */
    .song-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
    }
    .song-number {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      background: #1a0533;
      color: #f0a500;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      margin-top: 2px;
    }
    .song-titles { flex: 1; }
    .song-title {
      font-size: 17px;
      font-weight: 700;
      color: #1a0533;
      line-height: 1.3;
    }
    .song-num-badge {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      background: #f0ebff;
      padding: 2px 7px;
      border-radius: 4px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .title-alt {
      font-size: 14px;
      color: #555;
      margin-top: 3px;
    }
    .song-meta {
      font-size: 11px;
      color: #999;
      margin-top: 5px;
      text-transform: capitalize;
      letter-spacing: 0.3px;
    }

    /* ── Lyrics ── */
    .song-body { padding-left: 46px; }

    .lyrics-section { margin-bottom: 16px; }
    .lyrics-section:last-child { margin-bottom: 0; }

    .lang-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #7c3aed;
      margin-bottom: 6px;
      padding: 2px 8px;
      background: #f0ebff;
      border-radius: 4px;
      display: inline-block;
    }
    .telugu-label { color: #1a5fb4; background: #e8f0fe; }
    .hindi-label  { color: #c2410c; background: #fff1f0; }

    pre.lyrics {
      font-family: 'Inter', 'Noto Serif', Georgia, serif;
      font-size: 13px;
      color: #222;
      line-height: 1.85;
      white-space: pre-wrap;
      word-break: break-word;
    }
    pre.lyrics.telugu {
      font-family: 'Noto Sans Telugu', 'Noto Serif', sans-serif;
      font-size: 14px;
      line-height: 2.0;
    }
    pre.lyrics.hindi {
      font-family: 'Noto Sans Devanagari', 'Noto Serif', sans-serif;
      font-size: 14px;
      line-height: 2.0;
    }
    .no-lyrics { color: #bbb; font-style: italic; font-size: 12px; }

    /* ── Print button (hidden when printing) ── */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1a0533;
      color: #fff;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    }
    .print-bar span { font-size: 14px; font-weight: 600; }
    .print-bar button {
      background: #f0a500;
      color: #1a0533;
      border: none;
      padding: 9px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .print-bar button:hover { background: #e09600; }

    /* ── Print styles ── */
    @media print {
      .print-bar { display: none !important; }
      .page { padding: 20px 32px; margin: 0; max-width: 100%; }
      body { font-size: 12px; }

      .song { page-break-inside: avoid; }

      /* Force page break before every song except the first */
      .song + .song { page-break-before: always; }

      .song-title { font-size: 15px; }
      pre.lyrics   { font-size: 12px; line-height: 1.75; }
      pre.lyrics.telugu,
      pre.lyrics.hindi { font-size: 13px; }

      .doc-header h1 { font-size: 22px; }
    }

    @media (max-width: 600px) {
      .page { padding: 60px 16px 40px; }
      .song-body { padding-left: 0; }
      pre.lyrics { font-size: 12.5px; }
    }
  </style>
</head>
<body>

  <!-- Print bar — hidden when actually printing -->
  <div class="print-bar">
    <span>📄 ${esc(playlist.name)}</span>
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>

  <div class="page">

    <!-- Document header -->
    <div class="doc-header">
      <div class="church-name">New Covenant Church · Full Gospel</div>
      <h1>${esc(playlist.name)}</h1>
      ${playlist.description ? `<div class="desc">${esc(playlist.description)}</div>` : ''}
      <div class="meta">
        ${playlist.songs.filter(e => e.song).length} song${playlist.songs.filter(e => e.song).length !== 1 ? 's' : ''}
        &nbsp;·&nbsp; Generated ${date}
        &nbsp;·&nbsp; NCC Songs
      </div>
    </div>

    <!-- Songs -->
    ${songsHtml}

  </div>

  <script>
    // Auto-trigger print dialog after fonts load
    // Small delay lets Google Fonts finish loading so Telugu/Hindi renders correctly
    window.addEventListener('load', () => {
      setTimeout(() => {
        // Don't auto-print — let user see the preview first and click the button
        // window.print();
      }, 500);
    });
  </script>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

module.exports = router;
