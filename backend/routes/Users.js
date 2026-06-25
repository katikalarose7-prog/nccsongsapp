const express   = require('express');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { requireUser } = require('../middleware/Userauth');

const router = express.Router();

const signUserToken = (id) =>
  jwt.sign({ id, type: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email,
  emailVerified: u.emailVerified, emailNotifications: u.emailNotifications,
  preferredLanguage: u.preferredLanguage,
});

// POST /api/users/register
router.post('/register',
  [
    body('name').trim().isLength({ min: 2, max: 80 }).escape(),
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, all_lowercase: true }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const user = new User({ name, email, password });
      const rawToken = user.createEmailVerifyToken();
      await user.save();

      sendVerificationEmail(user.email, user.name, rawToken).catch(() => {});

      const token = signUserToken(user._id);
      res.status(201).json({ success: true, token, user: publicUser(user) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      res.status(400).json({ success: false, message: 'Could not create account' });
    }
  }
);

// GET /api/users/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Missing token' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ emailVerifyToken: hashed }).select('+emailVerifyToken');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// POST /api/users/login
router.post('/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, all_lowercase: true }), body('password').notEmpty()],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');
      const genericFail = () => res.status(401).json({ success: false, message: 'Invalid email or password' });

      if (!user) return genericFail();
      if (!user.isActive) return res.status(403).json({ success: false, message: 'Account disabled. Contact support.' });

      if (user.isLocked()) {
        return res.status(423).json({ success: false, message: 'Account temporarily locked. Try again in 15 minutes.' });
      }

      const ok = await user.comparePassword(password);
      if (!ok) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 8) {
          user.lockUntil = Date.now() + 15 * 60 * 1000;
          user.failedLoginAttempts = 0;
        }
        await user.save();
        return genericFail();
      }

      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      const token = signUserToken(user._id);
      res.json({ success: true, token, user: publicUser(user) });
    } catch {
      res.status(500).json({ success: false, message: 'Login failed, please try again' });
    }
  }
);

// POST /api/users/forgot-password
router.post('/forgot-password',
  loginLimiter,
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, all_lowercase: true })],
  validate,
  async (req, res) => {
    // Always return success, even if the email doesn't exist — avoids leaking
    // which addresses are registered (user enumeration protection).
    try {
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        const rawToken = user.createPasswordResetToken();
        await user.save();
        sendPasswordResetEmail(user.email, user.name, rawToken).catch(() => {});
      }
    } catch { /* swallow — always respond generically below */ }
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  }
);

// POST /api/users/reset-password
router.post('/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 6 })],
  validate,
  async (req, res) => {
    try {
      const { token, password } = req.body;
      const hashed = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        passwordResetToken: hashed,
        passwordResetExpires: { $gt: Date.now() },
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });

      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch {
      res.status(500).json({ success: false, message: 'Could not reset password' });
    }
  }
);

// GET /api/users/me
router.get('/me', requireUser, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

// PUT /api/users/me — update preferences
router.put('/me',
  requireUser,
  [
    body('name').optional().trim().isLength({ min: 2, max: 80 }).escape(),
    body('emailNotifications').optional().isBoolean(),
    body('preferredLanguage').optional().isIn(['english','telugu','hindi','multilingual','']),
  ],
  validate,
  async (req, res) => {
    try {
      const allowed = ['name', 'emailNotifications', 'preferredLanguage'];
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) req.user[field] = req.body[field];
      });
      await req.user.save();
      res.json({ success: true, user: publicUser(req.user) });
    } catch {
      res.status(400).json({ success: false, message: 'Could not update profile' });
    }
  }
);

// POST /api/users/favourites/:songId — toggle a song in/out of favourites
router.post('/favourites/:songId', requireUser, async (req, res) => {
  try {
    const { songId } = req.params;
    const idx = req.user.favourites.findIndex(f => String(f) === songId);
    if (idx >= 0) req.user.favourites.splice(idx, 1);
    else          req.user.favourites.push(songId);
    await req.user.save();
    res.json({ success: true, favourites: req.user.favourites });
  } catch {
    res.status(400).json({ success: false, message: 'Could not update favourites' });
  }
});

// GET /api/users/favourites — populated list of the user's favourite songs
router.get('/favourites', requireUser, async (req, res) => {
  await req.user.populate({ path: 'favourites', match: { isActive: true } });
  res.json({ success: true, songs: req.user.favourites });
});

module.exports = router;