const express  = require('express');
const multer   = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const auth = require('../middleware/auth');

const router = express.Router();

/* Cloudinary handles all file storage in production — files are stored
   on Cloudinary's servers permanently, surviving Railway redeploys/restarts.
   Railway's local filesystem is ephemeral (resets on every deploy), so
   saving files to disk there is NOT a viable production approach.

   FREE CLOUDINARY SETUP (2 minutes):
   1. Sign up at https://cloudinary.com (free, no credit card)
   2. Go to Dashboard → copy Cloud Name, API Key, API Secret
   3. Add to Railway env vars:
        CLOUDINARY_CLOUD_NAME = your_cloud_name
        CLOUDINARY_API_KEY    = your_api_key
        CLOUDINARY_API_SECRET = your_api_secret */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// In development (Cloudinary not configured), fall back to local disk storage
// so you can still test audio upload locally without needing a Cloudinary account.
let storage;
if (isCloudinaryConfigured) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'ncc-songs-audio',
      resource_type: 'video', // Cloudinary uses 'video' type for audio files
      allowed_formats: ['mp3', 'wav', 'm4a', 'ogg', 'aac'],
      // Use a unique public_id so filenames never collide
      public_id: (req, file) => `audio_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    },
  });
  console.log('✅ Audio uploads → Cloudinary');
} else {
  // Local disk fallback for development
  const path = require('path');
  const fs   = require('fs');
  const crypto = require('crypto');
  const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audio');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });
  console.log('⚠️  Audio uploads → local disk (dev mode, set Cloudinary env vars for production)');
}

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
                     'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/aac',
                     'audio/x-aac', 'video/mp4']; // some browsers send video/mp4 for m4a
    const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    const allowedExt = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];

    if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Upload MP3, WAV, M4A, OGG, or AAC files only.`));
    }
  },
});

// POST /api/upload/audio
router.post('/audio', auth, (req, res) => {
  upload.single('audio')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum size is 25MB.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // Cloudinary returns req.file.path as the full HTTPS URL
    // Local disk returns a relative path that we prefix
    const fileUrl = isCloudinaryConfigured
      ? req.file.path   // e.g. https://res.cloudinary.com/your-cloud/video/upload/ncc-songs-audio/audio_xxx.mp3
      : `/uploads/audio/${req.file.filename}`;

    console.log(`✅ Audio uploaded: ${fileUrl}`);

    res.status(201).json({
      success: true,
      url: fileUrl,
      filename: req.file.filename || req.file.public_id,
      size: req.file.size,
    });
  });
});

// DELETE /api/upload/audio/:filename
router.delete('/audio/:filename', auth, async (req, res) => {
  const { filename } = req.params;

  if (isCloudinaryConfigured) {
    try {
      // Cloudinary public_id is the filename without extension
      const publicId = `ncc-songs-audio/${filename.replace(/\.[^.]+$/, '')}`;
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
      return res.json({ success: true, message: 'File removed from Cloudinary' });
    } catch (err) {
      console.error('Cloudinary delete error:', err.message);
      return res.status(500).json({ success: false, message: 'Could not delete file' });
    }
  } else {
    // Local disk delete
    const path = require('path');
    const fs   = require('fs');
    const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audio');
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json({ success: true, message: 'File removed' });
    });
  }
});

module.exports = router;
