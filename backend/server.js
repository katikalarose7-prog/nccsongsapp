require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const rateLimit    = require('express-rate-limit');
const compression  = require('compression');
const helmet       = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp          = require('hpp');

const songRoutes     = require('./routes/songs');
const authRoutes     = require('./routes/auth');     // admin auth
const userRoutes     = require('./routes/Users');    // public user auth
const playlistRoutes = require('./routes/Playlists');
const uploadRoutes   = require('./routes/upload');

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const app  = express();
const PORT = process.env.PORT || 5000;

// Disable trust proxy in local dev — prevents express-rate-limit from
// misreading the X-Forwarded-For header injected by some dev tools/antivirus.
// In production behind a real proxy (Render/Railway/Nginx), set TRUST_PROXY=1 in .env
//app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.set('trust proxy', 1);
// Ensure uploads folder exists
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'audio');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ─── Security middleware ───────────────────────────────────────────
   helmet: sets a broad set of protective HTTP headers (HSTS, no-sniff,
   frame-options, etc). CSP is left to report-only-style defaults here
   since this API serves JSON + uploaded audio, not HTML pages.
   mongoSanitize: strips any key starting with '$' or containing '.' from
   req.body/query/params — blocks NoSQL injection (e.g. {"$gt": ""}).
   hpp: prevents HTTP parameter pollution (duplicate query params used to
   bypass validation, e.g. ?role=user&role=admin). */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow audio files to be fetched by the frontend origin
}));
app.use(mongoSanitize());
app.use(hpp());

// Force HTTPS in production (most hosts like Render terminate TLS at the
// load balancer and forward plain HTTP internally — trust proxy must be
// enabled via TRUST_PROXY=1 for req.secure to be accurate there).
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(compression()); // gzip all responses — big speed win
// CORS: in production, only allow the configured frontend origin(s).
// FRONTEND_URL can be a single URL or a comma-separated list (e.g. if you
// later run a staging site too). Falls back to allow-all only when no
// origin is configured at all, so local/testing deployments don't break
// silently — but you should always set FRONTEND_URL in real production.
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
  : null;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' && allowedOrigins
    ? allowedOrigins
    : true, // true = reflect request origin (safe for dev; for prod always set FRONTEND_URL)
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded audio files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d', // cache audio files in browser for 7 days
}));

// Rate limiting — applied selectively, skips upload routes entirely
// (uploads are already protected by auth + file size limits)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) return next(); // skip general limiter for uploads
  apiLimiter(req, res, next);
});

// Cache-control helper
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/songs')) {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  }
  next();
});

/* ─── Routes ─────────────────────────────────────────────────────── */
app.use('/api/songs',     songRoutes);
app.use('/api/auth',      authRoutes);     // admin login/register
app.use('/api/users',     userRoutes);     // public user login/register/profile
app.use('/api/playlists', playlistRoutes);
app.use('/api/upload',    uploadRoutes);

// Single stats endpoint — replaces 4 separate calls from Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const Song = require('./models/Song');
    const [total, english, telugu, hindi, multilingual] = await Promise.all([
      Song.countDocuments({ isActive: true }),
      Song.countDocuments({ isActive: true, language: 'english' }),
      Song.countDocuments({ isActive: true, language: 'telugu' }),
      Song.countDocuments({ isActive: true, language: 'hindi' }),
      Song.countDocuments({ isActive: true, language: 'multilingual' }),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, total, english, telugu, hindi, multilingual });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load stats' });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// Catch-all 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// Generic error handler — never leak stack traces to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: 'Something went wrong' });
});

/* ─── MongoDB ────────────────────────────────────────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌  MongoDB error:', err.message);
    process.exit(1);
  });