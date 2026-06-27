const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const { body, validationResult } = require('express-validator');
const Song    = require('../models/Song');
const User    = require('../models/User');
const { requireAdmin } = require('../middleware/auth');
const { optionalUser, requireUser } = require('../middleware/Userauth');
const { sendNewSongEmail, sendBulkNewSongsEmail } = require('../utils/email');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CATEGORIES = ['worship','praise','christmas','resurrection','communion','wedding','death','thanksgiving','SundaySchool','other'];
const LANGUAGES  = ['english','telugu','hindi','multilingual'];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

// Escapes regex special characters so user search input can never be
// interpreted as a regex pattern — prevents ReDoS (catastrophic backtracking)
// and unintended pattern injection via the search box.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ─── PUBLIC ROUTES ────────────────────────────────────────────── */

// GET /api/songs  — list + search + filter
router.get('/', async (req, res) => {
  try {
    const { q, language, category, page = 1, limit = 20, sort = 'songNumber' } = req.query;

    const safePage  = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { isActive: true };
    if (language && LANGUAGES.includes(language)) filter.language = language;
    if (category && CATEGORIES.includes(category)) filter.category = category;

    let songs, total;

    if (q && q.trim()) {
      const safeQuery = escapeRegex(q.trim().slice(0, 100)); // cap length too
      const regex = new RegExp(safeQuery, 'i');

      const langMatch = LANGUAGES.find(l => l.match(regex));
      const catMatch  = CATEGORIES.find(c => c.match(regex));

      const orConditions = [
        { title:        regex },
        { titleTelugu:  regex },
        { titleHindi:   regex },
        { lyrics:       regex },
        { lyricsTelugu: regex },
        { lyricsHindi:  regex },
        { tags:         regex },
        { category:     regex },
      ];
      if (langMatch) orConditions.push({ language: langMatch });
      if (catMatch)  orConditions.push({ category: catMatch });

      const searchFilter = { ...filter, $or: orConditions };
      total = await Song.countDocuments(searchFilter);
      songs = await Song.find(searchFilter)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select('-__v');
    } else {
      const sortObj = sort === 'title'  ? { title: 1 }
                    : sort === 'newest' ? { createdAt: -1 }
                    : { songNumber: 1 };
      total = await Song.countDocuments(filter);
      songs = await Song.find(filter)
        .sort(sortObj)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select('-__v');
    }

    res.json({ success: true, total, page: safePage, songs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load songs' });
  }
});

// GET /api/songs/recommendations — based on the logged-in user's listening
// history (most-played categories/languages), falls back to most-viewed
// songs overall for guests or new users with no history yet.
router.get('/recommendations', optionalUser, async (req, res) => {
  try {
    let songs;
    if (req.user && req.user.history.length > 0) {
      const recentSongIds = req.user.history.slice(-20).map(h => h.song);
      const recentSongs = await Song.find({ _id: { $in: recentSongIds } }).select('category language');

      const categoryCounts = {};
      const langCounts = {};
      recentSongs.forEach(s => {
        categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
        langCounts[s.language]     = (langCounts[s.language]     || 0) + 1;
      });
      const topCategory = Object.keys(categoryCounts).sort((a,b) => categoryCounts[b]-categoryCounts[a])[0];
      const topLanguage  = Object.keys(langCounts).sort((a,b) => langCounts[b]-langCounts[a])[0];

      const alreadyPlayed = req.user.history.map(h => h.song);

      songs = await Song.find({
        isActive: true,
        _id: { $nin: alreadyPlayed },
        $or: [{ category: topCategory }, { language: topLanguage }],
      }).sort({ viewCount: -1 }).limit(10);

      if (songs.length < 5) {
        const extra = await Song.find({ isActive: true, _id: { $nin: [...alreadyPlayed, ...songs.map(s=>s._id)] } })
          .sort({ viewCount: -1 }).limit(10 - songs.length);
        songs = [...songs, ...extra];
      }
    } else {
      songs = await Song.find({ isActive: true }).sort({ viewCount: -1 }).limit(10);
    }
    res.json({ success: true, songs });
  } catch {
    res.status(500).json({ success: false, message: 'Could not load recommendations' });
  }
});

/* ─── USER-SCOPED: RECENTLY PLAYED ─────────────────────────────────
   IMPORTANT: this must be declared BEFORE the GET /:id route below.
   Express matches routes in declaration order, and /:id would otherwise
   match "me" as an :id value first, making this route unreachable. */
router.get('/me/recent', requireUser, async (req, res) => {
  const recent = [...req.user.history].reverse().slice(0, 20);
  const songIds = recent.map(h => h.song);
  const songs = await Song.find({ _id: { $in: songIds }, isActive: true });
  // preserve most-recent-first order
  const ordered = songIds.map(id => songs.find(s => String(s._id) === String(id))).filter(Boolean);
  res.json({ success: true, songs: ordered });
});

// GET /api/songs/:id
router.get('/:id', optionalUser, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song || !song.isActive) return res.status(404).json({ success: false, message: 'Song not found' });

    song.viewCount += 1;
    await song.save();

    // Record listening history for logged-in users (capped to last 100 entries)
    if (req.user) {
      req.user.history.push({ song: song._id, playedAt: new Date() });
      if (req.user.history.length > 100) req.user.history = req.user.history.slice(-100);
      await req.user.save();
    }

    res.json({ success: true, song });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load song' });
  }
});

/* ─── PROTECTED (ADMIN) ROUTES ─────────────────────────────────── */

const songValidation = [
  body('title').trim().isLength({ min: 1, max: 300 }),
  body('lyrics').trim().isLength({ min: 1 }),
  body('language').optional().isIn(LANGUAGES),
  body('category').optional().isIn(CATEGORIES),
  body('youtubeUrl').optional({ checkFalsy: true }).isURL().withMessage('YouTube URL must be a valid URL'),
  body('audioUrl').optional({ checkFalsy: true }).custom((v) => v.startsWith('/uploads/') || /^https?:\/\//i.test(v))
    .withMessage('Audio URL must be a valid link or an uploaded file path'),
];

// POST /api/songs
router.post('/', requireAdmin, songValidation, validate, async (req, res) => {
  try {
    const song = await Song.create(req.body);

    // Notify subscribed users in the background — never blocks the response
    User.find({ isActive: true, emailVerified: true, emailNotifications: true })
      .select('email name')
      .then((users) => {
        users.forEach((u) => sendNewSongEmail(u.email, u.name, song).catch(() => {}));
      })
      .catch(() => {});

    res.status(201).json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Could not save song — check required fields' });
  }
});

// PUT /api/songs/:id
router.put('/:id', requireAdmin, songValidation, validate, async (req, res) => {
  try {
    const song = await Song.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    res.json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Could not update song' });
  }
});

// DELETE /api/songs/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Song.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Song removed' });
  } catch {
    res.status(500).json({ success: false, message: 'Could not remove song' });
  }
});

// POST /api/songs/bulk-import
router.post('/bulk-import', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const songs = rows.map((row) => ({
      title:        String(row['title']        || row['Title']        || '').slice(0, 300),
      titleTelugu:  String(row['titleTelugu']  || row['Title Telugu'] || '').slice(0, 300),
      titleHindi:   String(row['titleHindi']   || row['Title Hindi']  || '').slice(0, 300),
      lyrics:       String(row['lyrics']       || row['Lyrics']       || ''),
      lyricsTelugu: String(row['lyricsTelugu'] || row['Lyrics Telugu']|| ''),
      lyricsHindi:  String(row['lyricsHindi']  || row['Lyrics Hindi'] || ''),
      language:     LANGUAGES.includes((row['language']||'').toLowerCase()) ? row['language'].toLowerCase() : 'english',
      category:     CATEGORIES.includes((row['category']||'').toLowerCase()) ? row['category'].toLowerCase() : 'worship',
      key:          String(row['key'] || row['Key'] || '').slice(0, 20),
      songNumber:   Number(row['songNumber'] || row['Song Number'] || 0) || undefined,
      tags:         row['tags'] ? String(row['tags']).split(',').map(t => t.trim().slice(0, 40)).slice(0, 20) : [],
      youtubeUrl:   String(row['youtubeUrl'] || row['YouTube URL'] || '').slice(0, 500),
      audioUrl:     String(row['audioUrl']   || row['Audio URL']   || '').slice(0, 500),
    })).filter(s => s.title);

    if (!songs.length) return res.status(400).json({ success: false, message: 'No valid songs found' });
    const inserted = await Song.insertMany(songs, { ordered: false });

    // Notify subscribed users with ONE summary email listing all the
    // newly imported songs — never one email per song, which would
    // flood inboxes (and mail providers) on a large bulk import.
    User.find({ isActive: true, emailVerified: true, emailNotifications: true })
      .select('email name')
      .then((users) => {
        users.forEach((u) => sendBulkNewSongsEmail(u.email, u.name, inserted).catch(() => {}));
      })
      .catch(() => {});

    res.status(201).json({ success: true, message: `${inserted.length} songs imported successfully`, count: inserted.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Import failed — check your file format' });
  }
});

// GET /api/songs/export/template
router.get('/export/template', requireAdmin, (req, res) => {
  const headers = [{
    title: 'Song Title', titleTelugu: 'Telugu Title', titleHindi: 'Hindi Title',
    lyrics: 'Lyrics (English)', lyricsTelugu: 'Lyrics (Telugu)', lyricsHindi: 'Lyrics (Hindi)',
    language: 'english/telugu/hindi/multilingual',
    category: 'worship/praise/christmas/resurrection/communion/wedding/death/thanksgiving/sundayschoolsongs/other',
    key: 'G', songNumber: '1', tags: 'tag1,tag2',
    youtubeUrl: 'https://youtube.com/watch?v=...', audioUrl: 'https://example.com/song.mp3',
  }];
  const ws = XLSX.utils.json_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Songs');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=songs_import_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;