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
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${esc(playlist.name)} — NCC Songs</title></head><body>${songsHtml}</body></html>`;
    res.send(html);
  }
);

/* ── GET /api/playlists/:id/pdf-download ────────────────────────────
   Generates a real PDF and streams it as a direct file download.
   Uses puppeteer-core + @sparticuz/chromium (Railway-compatible).
   ─────────────────────────────────────────────────────────────────── */
router.get('/:id/pdf-download',
  async (req, res, next) => {
    const jwt  = require('jsonwebtoken');
    const User = require('../models/User');
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'user') return res.status(403).json({ success: false, message: 'Access denied' });
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Account not found' });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ success: false, message: 'Session expired' });
    }
  },
  loadOwnedPlaylist,
  async (req, res) => {
    let browser;
    try {
      const puppeteer = require('puppeteer-core');
      const chromium  = require('@sparticuz/chromium');

      await req.playlist.populate('songs.song');
      const playlist = req.playlist;

      const date = new Date().toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });

      const esc = (str) => (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const songsHtml = playlist.songs
        .filter(e => e.song)
        .map((entry, i) => {
          const s = entry.song;
          const variants = [
            { label: 'English', cssClass: '',       lyrics: s.lyrics       },
            { label: 'తెలుగు', cssClass: 'telugu', lyrics: s.lyricsTelugu },
            { label: 'हिन्दी',  cssClass: 'hindi',  lyrics: s.lyricsHindi  },
          ].filter(v => v.lyrics?.trim());

          const multiLang = variants.length > 1;

          const lyricBlocks = variants.map(v => `
            <div class="lyric-block">
              ${multiLang ? `<span class="lang-tag ${v.cssClass}-tag">${v.label}</span>` : ''}
              <pre class="lyrics ${v.cssClass}">${esc(v.lyrics)}</pre>
            </div>`).join('');

          const altTitles = [
            s.titleTelugu ? `<div class="alt-title telugu">${esc(s.titleTelugu)}</div>` : '',
            s.titleHindi  ? `<div class="alt-title hindi">${esc(s.titleHindi)}</div>`   : '',
          ].join('');

          const meta = [s.category, s.language, s.key ? `Key: ${s.key}` : '', s.tempo]
            .filter(Boolean).join('  ·  ');

          return `
            <div class="song-card">
              <div class="song-header">
                <div class="song-num">${String(i + 1).padStart(2, '0')}</div>
                <div class="song-title-wrap">
                  <div class="song-title">${esc(s.title)}${s.songNumber ? `<span class="badge">№ ${s.songNumber}</span>` : ''}</div>
                  ${altTitles}
                  ${meta ? `<div class="song-meta">${esc(meta)}</div>` : ''}
                </div>
              </div>
              <div class="song-body">${lyricBlocks || '<p class="no-lyrics">No lyrics available</p>'}</div>
            </div>`;
        }).join('\n');

      const songCount = playlist.songs.filter(e => e.song).length;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    background: #ffffff;
    color: #1e1b2e;
    font-size: 12px;
    line-height: 1.6;
  }

  /* ── Cover page ── */
  .cover {
    width: 100%;
    height: 100vh;
    min-height: 842px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 72px 64px;
    background: linear-gradient(145deg, #0f0c29 0%, #1a1060 50%, #24243e 100%);
    color: #fff;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .cover-glow-1 {
    position: absolute;
    top: -120px; right: -120px;
    width: 500px; height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%);
    pointer-events: none;
  }
  .cover-glow-2 {
    position: absolute;
    bottom: -80px; left: 40px;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%);
    pointer-events: none;
  }
  .cover-eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #14b8a6;
    margin-bottom: 20px;
    position: relative;
  }
  .cover-title {
    font-size: 48px;
    font-weight: 700;
    line-height: 1.1;
    color: #ffffff;
    max-width: 540px;
    margin-bottom: 20px;
    position: relative;
  }
  .cover-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    max-width: 400px;
    margin-bottom: 48px;
    position: relative;
  }
  .cover-divider {
    width: 56px;
    height: 3px;
    background: linear-gradient(90deg, #14b8a6, #6366f1);
    border-radius: 2px;
    margin-bottom: 36px;
    position: relative;
  }
  .cover-stats {
    display: flex;
    gap: 48px;
    position: relative;
  }
  .cover-stat-num {
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1;
  }
  .cover-stat-label {
    font-size: 10px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-top: 6px;
  }
  .cover-footer {
    position: absolute;
    bottom: 36px;
    left: 64px;
    right: 64px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.5px;
  }

  /* ── Songs section ── */
  .songs-section { padding: 40px 48px; }

  .section-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 28px;
    padding-bottom: 14px;
    border-bottom: 2px solid #ede9fe;
  }
  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #6366f1;
    white-space: nowrap;
  }
  .section-line { flex: 1; height: 1px; background: #ede9fe; }

  /* ── Song card ── */
  .song-card {
    border: 1.5px solid #ede9fe;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 20px;
    page-break-inside: avoid;
    background: #fafafa;
  }

  .song-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 14px 20px;
    background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%);
    border-bottom: 1.5px solid #ede9fe;
  }

  .song-num {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.3px;
    box-shadow: 0 2px 8px rgba(99,102,241,0.35);
  }

  .song-title-wrap { flex: 1; min-width: 0; }

  .song-title {
    font-size: 15px;
    font-weight: 700;
    color: #1e1b2e;
    line-height: 1.3;
  }

  .badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 600;
    background: #ede9fe;
    color: #4f46e5;
    padding: 2px 8px;
    border-radius: 4px;
    margin-left: 8px;
    vertical-align: middle;
    letter-spacing: 0.3px;
  }

  .alt-title {
    font-size: 12px;
    margin-top: 3px;
    opacity: 0.85;
  }
  .alt-title.telugu { font-family: 'Noto Sans Telugu', sans-serif; color: #0d9488; }
  .alt-title.hindi  { font-family: 'Noto Sans Devanagari', sans-serif; color: #7c3aed; }

  .song-meta {
    font-size: 10px;
    color: #9ca3af;
    margin-top: 6px;
    letter-spacing: 0.3px;
  }

  /* ── Lyrics ── */
  .song-body { padding: 16px 20px 20px 72px; }

  .lyric-block { margin-bottom: 18px; }
  .lyric-block:last-child { margin-bottom: 0; }

  .lang-tag {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 3px;
    margin-bottom: 8px;
  }
  .lang-tag        { background: #f0f9ff; color: #0369a1; }
  .telugu-tag { background: #f0fdfa; color: #0d9488; }
  .hindi-tag  { background: #faf5ff; color: #7c3aed; }

  pre.lyrics {
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    font-size: 12px;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 2;
  }
  pre.lyrics.telugu { font-family: 'Noto Sans Telugu', sans-serif; font-size: 13px; line-height: 2.2; }
  pre.lyrics.hindi  { font-family: 'Noto Sans Devanagari', sans-serif; font-size: 13px; line-height: 2.2; }

  .no-lyrics { color: #d1d5db; font-style: italic; font-size: 11px; }

  /* ── Footer ── */
  .doc-footer {
    margin: 8px 48px 40px;
    padding-top: 20px;
    border-top: 1.5px solid #ede9fe;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    color: #a5b4fc;
    letter-spacing: 0.5px;
  }
  .footer-brand { font-weight: 700; color: #6366f1; }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-glow-1"></div>
  <div class="cover-glow-2"></div>
  <div class="cover-eyebrow">New Covenant Church · Full Gospel</div>
  <div class="cover-title">${esc(playlist.name)}</div>
  ${playlist.description ? `<div class="cover-desc">${esc(playlist.description)}</div>` : ''}
  <div class="cover-divider"></div>
  <div class="cover-stats">
    <div>
      <div class="cover-stat-num">${songCount}</div>
      <div class="cover-stat-label">Songs</div>
    </div>
    <div>
      <div class="cover-stat-num">${new Date().getFullYear()}</div>
      <div class="cover-stat-label">Year</div>
    </div>
  </div>
  <div class="cover-footer">
    <span>NCC Songs App</span>
    <span>${date}</span>
  </div>
</div>

<div class="songs-section">
  <div class="section-header">
    <span class="section-label">Song Lyrics</span>
    <div class="section-line"></div>
  </div>
  ${songsHtml}
</div>

<div class="doc-footer">
  <span class="footer-brand">NCC Songs</span>
  <span>${date}</span>
</div>

</body>
</html>`;

      browser = await puppeteer.launch({
        args:            chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath:  await chromium.executablePath(),
        headless:        chromium.headless,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format:          'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await browser.close();
      browser = null;

      const safeName = (playlist.name || 'playlist')
        .replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);

    } catch (err) {
      if (browser) { try { await browser.close(); } catch (_) {} }
      console.error('PDF generation error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
  }
);

module.exports = router;