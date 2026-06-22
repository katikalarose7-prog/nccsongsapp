const express = require('express');
const PDFDocument = require('pdfkit');
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

/* Ownership guard — every playlist route below operates on :id, so we
   centralise the "does this playlist belong to the logged-in user" check
   here to avoid repeating it (and to avoid ever forgetting it). */
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

// POST /api/playlists — create a new folder e.g. "Sunday Song List"
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

// GET /api/playlists/:id — full detail with populated songs
router.get('/:id', requireUser, loadOwnedPlaylist, async (req, res) => {
  await req.playlist.populate('songs.song');
  res.json({ success: true, playlist: req.playlist });
});

// PUT /api/playlists/:id — rename / edit description
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

// POST /api/playlists/:id/songs — add a song to the folder
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

// DELETE /api/playlists/:id/songs/:songId — remove a song from the folder
router.delete('/:id/songs/:songId', requireUser, loadOwnedPlaylist, async (req, res) => {
  req.playlist.songs = req.playlist.songs.filter(s => String(s.song) !== String(req.params.songId));
  await req.playlist.save();
  res.json({ success: true, playlist: req.playlist });
});

// GET /api/playlists/:id/pdf — export the folder's songs as a PDF
router.get('/:id/pdf', requireUser, loadOwnedPlaylist, async (req, res) => {
  await req.playlist.populate('songs.song');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${req.playlist.name.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(22).fillColor('#3b0f6e').text(req.playlist.name, { align: 'center' });
  if (req.playlist.description) {
    doc.moveDown(0.3).fontSize(11).fillColor('#666').text(req.playlist.description, { align: 'center' });
  }
  doc.moveDown(0.3).fontSize(9).fillColor('#999')
     .text(`New Covenant Church Songs · ${req.playlist.songs.length} songs · Generated ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(1.5);

  req.playlist.songs.forEach((entry, i) => {
    const song = entry.song;
    if (!song) return; // song may have been deleted since being added
    if (i > 0) doc.moveDown(1).moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke().moveDown(1);

    doc.fontSize(15).fillColor('#1a0533').font('Helvetica-Bold')
       .text(`${i + 1}. ${song.title}${song.songNumber ? `  (No. ${song.songNumber})` : ''}`);
    doc.fontSize(9).fillColor('#888').font('Helvetica')
       .text(`${song.category} · ${song.language}${song.key ? ` · Key: ${song.key}` : ''}`);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#222').font('Helvetica')
       .text(song.lyrics || '(No lyrics available)', { lineGap: 4 });
  });

  doc.end();
});

module.exports = router;