const express = require('express');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const auth    = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audio');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const allowedExt = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExt.includes(ext)) cb(null, true);
  else cb(new Error('Only audio files are allowed (mp3, wav, m4a, ogg, aac)'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// POST /api/upload/audio  — upload an MP3/audio file, returns the public URL
router.post('/audio', auth, (req, res) => {
  upload.single('audio')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fileUrl = `/uploads/audio/${req.file.filename}`;
    res.status(201).json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  });
});

// DELETE /api/upload/audio/:filename — remove an uploaded file (cleanup)
router.delete('/audio/:filename', auth, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  // Prevent path traversal
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: 'File removed' });
  });
});

module.exports = router;