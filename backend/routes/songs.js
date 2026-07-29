const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const Fuse    = require('fuse.js'); // npm install fuse.js
const { body, validationResult } = require('express-validator');
const Song    = require('../models/Song');
const User    = require('../models/User');
const { requireAdmin } = require('../middleware/auth');
const { optionalUser, requireUser } = require('../middleware/Userauth');
const { sendNewSongEmail, sendBulkNewSongsEmail } = require('../utils/email');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CATEGORIES = ['worship','praise','christmas','resurrection','communion','wedding','goodfriday','thanksgiving','sundayschoolsongs','other'];
const LANGUAGES  = ['english','telugu','hindi','multilingual'];

// Case-insensitive collation so "A–Z" sort produces a real human
// alphabetical order (Aaron, apple, Zebra) instead of Mongo's default
// byte-order sort, which puts every uppercase letter before any
// lowercase one (A, B, ... Z, a, b, ...).
const CASE_INSENSITIVE_COLLATION = { locale: 'en', strength: 2 };

/* ─── List payload trimming ──────────────────────────────────────
   The homepage grid (SongCard) only ever shows a 110-char slice of
   `lyrics` and never touches lyricsTelugu/lyricsHindi/chords at all —
   those are only needed once a user opens a song (GET /songs/:id,
   which is untouched and still returns everything). Sending full
   multilingual lyrics + chords for every song in a paginated list
   was pure wasted bandwidth on every homepage load. This excludes
   the unused fields at the DB layer and truncates the one field the
   card actually previews, before the response goes out. */
const LIST_EXCLUDE = '-__v -lyricsTelugu -lyricsHindi -chords';
const LIST_PREVIEW_LEN = 150;

const trimForList = (songs) =>
  songs.map((s) => ({
    ...s,
    lyrics: s.lyrics ? s.lyrics.slice(0, LIST_PREVIEW_LEN) : s.lyrics,
  }));

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

// Escapes regex special characters so user search input can never be
// interpreted as a regex pattern — kept around for the songNumber /
// exact-tag lookups below, which are cheap enough to stay as regex.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ─── FUZZY SEARCH INDEX (typo-tolerant fallback only) ─────────────
   $text search (see below) now handles the normal case — exact and
   near-exact matches — using a real MongoDB index, so it's fast even
   as the collection grows. Fuse.js is kept ONLY as a fallback for
   genuine typos that $text's stemming/tokenizing won't catch
   (e.g. "worhsip", transposed letters).

   The Fuse index used to pull full lyrics fields for every song into
   memory, which made cache (re)builds slow and memory-heavy. Since
   $text now covers lyrics search with an index, Fuse only needs
   title/tag/metadata fields — much smaller payload, much faster to
   build. */

const FUSE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let fuseCache = { instance: null, builtAt: 0 };

async function getFuseIndex() {
  const isFresh = fuseCache.instance && (Date.now() - fuseCache.builtAt) < FUSE_TTL_MS;
  if (isFresh) return fuseCache.instance;

  const songs = await Song.find({ isActive: true })
    .select('title titleTelugu titleHindi tags category language songNumber')
    .lean();

  const fuse = new Fuse(songs, {
    includeScore: true,
    ignoreLocation: true,   // match anywhere in the field, not just near the start
    minMatchCharLength: 2,
    threshold: 0.38,        // 0.0 = exact match only, 1.0 = match anything. 0.38 tolerates a couple typos on short titles.
    keys: [
      { name: 'title',       weight: 0.45 },
      { name: 'titleTelugu', weight: 0.25 },
      { name: 'titleHindi',  weight: 0.25 },
      { name: 'tags',        weight: 0.05 },
    ],
  });

  fuseCache = { instance: fuse, builtAt: Date.now() };
  return fuse;
}

// Call this after any create/update/delete so fuzzy results reflect
// the change immediately instead of waiting up to FUSE_TTL_MS.
const invalidateFuseCache = () => { fuseCache.instance = null; };

/* ─── PUBLIC ROUTES ────────────────────────────────────────────── */

// GET /api/songs  — list + search (indexed text search, with fuzzy fallback) + filter
router.get('/', async (req, res) => {
  try {
    const { q, language, category, page = 1, limit = 20, sort = 'title', fuzzy } = req.query;

    const safePage  = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { isActive: true };
    if (language && LANGUAGES.includes(language)) filter.language = language;
    if (category && CATEGORIES.includes(category)) filter.category = category;

    let songs, total, usedFuzzy = false;

    if (q && q.trim()) {
      const trimmedQ = q.trim().slice(0, 100);
      const forceFuzzy = fuzzy === 'true' || fuzzy === '1';

      if (!forceFuzzy) {
        // Indexed text search — uses the 'SongTextIndex' text index
        // (see models/Song.js) instead of a full-collection regex scan.
        // Also lets a query like "worship" or "telugu" match the
        // language/category fields directly via the small $or below,
        // which stays index-friendly since it's an equality check,
        // not a regex scan.
        const langMatch = LANGUAGES.find(l => l === trimmedQ.toLowerCase());
        const catMatch  = CATEGORIES.find(c => c === trimmedQ.toLowerCase());

        const searchFilter = { ...filter };
        if (langMatch || catMatch) {
          searchFilter.$or = [
            { $text: { $search: trimmedQ } },
            ...(langMatch ? [{ language: langMatch }] : []),
            ...(catMatch  ? [{ category: catMatch }]  : []),
          ];
        } else {
          searchFilter.$text = { $search: trimmedQ };
        }

        total = await Song.countDocuments(searchFilter);
        songs = await Song.find(searchFilter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .skip((safePage - 1) * safeLimit)
          .limit(safeLimit)
          .select(LIST_EXCLUDE)
          .lean();
      }

      // Fuzzy path: either explicitly requested, or the indexed text
      // search came up completely empty (e.g. a typo $text's stemming
      // couldn't bridge).
      if (forceFuzzy || !total) {
        usedFuzzy = true;
        const fuse = await getFuseIndex();
        let results = fuse.search(trimmedQ);

        // Fuse doesn't know about our language/category filters, apply them here.
        results = results.filter(({ item }) =>
          (!filter.language || item.language === filter.language) &&
          (!filter.category || item.category === filter.category)
        );

        total = results.length;
        const pageSlice = results.slice((safePage - 1) * safeLimit, safePage * safeLimit);

        // Fuse index only holds a lean projection — re-fetch full docs,
        // preserving Fuse's relevance order.
        const ids = pageSlice.map(r => r.item._id);
        const fullDocs = await Song.find({ _id: { $in: ids } }).select(LIST_EXCLUDE).lean();
        songs = ids
          .map(id => fullDocs.find(d => String(d._id) === String(id)))
          .filter(Boolean);
      }
    } else {
      const sortObj = sort === 'title'  ? { title: 1 }
                    : sort === 'newest' ? { createdAt: -1 }
                    : { songNumber: 1 };

      // Only the title sort needs the case-insensitive collation —
      // songNumber and createdAt are numeric/date fields, unaffected
      // by letter casing.
      let songsQuery = Song.find(filter)
        .sort(sortObj)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select(LIST_EXCLUDE)
        .lean();
      if (sort === 'title') songsQuery = songsQuery.collation(CASE_INSENSITIVE_COLLATION);

      total = await Song.countDocuments(filter);
      songs = await songsQuery;
    }

    res.json({ success: true, total, page: safePage, fuzzy: usedFuzzy, songs: trimForList(songs) });
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
      const recentSongs = await Song.find({ _id: { $in: recentSongIds } }).select('category language').lean();

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
      }).select(LIST_EXCLUDE).sort({ viewCount: -1 }).limit(10).lean();

      if (songs.length < 5) {
        const extra = await Song.find({ isActive: true, _id: { $nin: [...alreadyPlayed, ...songs.map(s=>s._id)] } })
          .select(LIST_EXCLUDE).sort({ viewCount: -1 }).limit(10 - songs.length).lean();
        songs = [...songs, ...extra];
      }
    } else {
      songs = await Song.find({ isActive: true }).select(LIST_EXCLUDE).sort({ viewCount: -1 }).limit(10).lean();
    }
    res.json({ success: true, songs: trimForList(songs) });
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
  const songs = await Song.find({ _id: { $in: songIds }, isActive: true }).select(LIST_EXCLUDE).lean();
  // preserve most-recent-first order
  const ordered = songIds.map(id => songs.find(s => String(s._id) === String(id))).filter(Boolean);
  res.json({ success: true, songs: trimForList(ordered) });
});

// GET /api/songs/:id — full detail view, unchanged: returns every field
// including chords and all-language lyrics, since this is the only
// route where the user actually needs them.
router.get('/:id', optionalUser, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song || !song.isActive) return res.status(404).json({ success: false, message: 'Song not found' });

    // View count / history updates don't need to block the response —
    // the client just needs the song data as fast as possible.
    song.viewCount += 1;
    song.save().catch(() => {});

    if (req.user) {
      req.user.history.push({ song: song._id, playedAt: new Date() });
      if (req.user.history.length > 100) req.user.history = req.user.history.slice(-100);
      req.user.save().catch(() => {});
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
    invalidateFuseCache(); // new song should be findable right away, even via fuzzy search

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
    invalidateFuseCache(); // edited title/lyrics/tags should be reflected immediately
    res.json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Could not update song' });
  }
});

// DELETE /api/songs/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Song.findByIdAndUpdate(req.params.id, { isActive: false });
    invalidateFuseCache(); // removed song shouldn't still surface via fuzzy search
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
    invalidateFuseCache(); // bulk-imported songs should be searchable immediately

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
    category: 'worship/praise/christmas/resurrection/communion/wedding/goodfriday/thanksgiving/sundayschoolsongs/other',
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