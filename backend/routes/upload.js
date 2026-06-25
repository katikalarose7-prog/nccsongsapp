const express = require('express');
const multer  = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const auth   = require('../middleware/auth');

const router = express.Router();

/* Cloudinary v2 — direct stream upload, no adapter package needed.
   Works with cloudinary@^2.x which is the current SDK.

   FREE SETUP (2 minutes, no credit card):
   1. Sign up at https://cloudinary.com
   2. Dashboard → copy Cloud Name, API Key, API Secret
   3. Add to Railway env vars:
        CLOUDINARY_CLOUD_NAME = your_cloud_name
        CLOUDINARY_API_KEY    = your_api_key
        CLOUDINARY_API_SECRET = your_api_secret          */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Always use memory storage — for Cloudinary we pipe the buffer via
// stream; for local disk we write it ourselves. This avoids needing
// any adapter package and works with any Cloudinary SDK version.
const memStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMime = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/aac',
    'audio/x-aac', 'video/mp4',
  ];
  const allowedExt = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only MP3, WAV, M4A, OGG or AAC files are allowed'));
  }
};

const upload = multer({
  storage: memStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter,
});

/* Upload a buffer to Cloudinary via stream — no temp file on disk,
   no adapter package, works with cloudinary v2 SDK. */
function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

// POST /api/upload/audio
router.post('/audio', auth, (req, res) => {
  upload.single('audio')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ success: false, message: 'File too large. Maximum 25 MB.' });
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
      let fileUrl, filename;

      if (isCloudinaryConfigured) {
        // Upload buffer to Cloudinary via stream
        const publicId = `ncc-songs-audio/audio_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
        const result = await uploadBufferToCloudinary(req.file.buffer, {
          resource_type: 'video', // Cloudinary uses 'video' for audio files
          public_id: publicId,
          folder: 'ncc-songs-audio',
          overwrite: false,
        });
        fileUrl  = result.secure_url;
        filename = result.public_id;
        console.log(`✅ Audio uploaded to Cloudinary: ${fileUrl}`);
      } else {
        // Local disk fallback for development
        const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audio');
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(req.file.originalname).toLowerCase()}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
        fileUrl = `/uploads/audio/${filename}`;
        console.log(`⚠️  Audio saved locally (set Cloudinary env vars for production): ${fileUrl}`);
      }

      res.status(201).json({
        success: true,
        url: fileUrl,
        filename,
        size: req.file.size,
      });
    } catch (uploadErr) {
      console.error('Upload error:', uploadErr.message);
      res.status(500).json({ success: false, message: 'Upload failed: ' + uploadErr.message });
    }
  });
});

// DELETE /api/upload/audio/:filename
router.delete('/audio/:filename', auth, async (req, res) => {
  const { filename } = req.params;
  if (isCloudinaryConfigured) {
    try {
      // filename stored as Cloudinary public_id (e.g. ncc-songs-audio/audio_xxx)
      await cloudinary.uploader.destroy(filename, { resource_type: 'video' });
      return res.json({ success: true, message: 'Deleted from Cloudinary' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  } else {
    const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audio');
    const filePath   = path.join(UPLOAD_DIR, filename);
    if (!filePath.startsWith(UPLOAD_DIR))
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT')
        return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Deleted' });
    });
  }
});

module.exports = router;
