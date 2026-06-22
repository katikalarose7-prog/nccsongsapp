const express     = require('express');
const jwt          = require('jsonwebtoken');
const rateLimit     = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const Admin        = require('../models/Admin');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const signAdminToken = (id) =>
  jwt.sign({ id, type: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });

// Strict rate limit on login attempts to slow brute force / credential stuffing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

/* POST /api/auth/register
   Only allowed:
   - When there are ZERO admins in the system (very first bootstrap), OR
   - By an already-authenticated admin with role 'admin' (not 'editor') creating another account.
   This closes the previous gap where ANY bearer token (even a regular user's)
   could pass the check and create a new admin account. */
router.post('/register',
  [
    body('name').trim().isLength({ min: 2, max: 80 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['admin', 'editor']),
  ],
  validate,
  async (req, res) => {
    try {
      const count = await Admin.countDocuments();

      if (count > 0) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer '))
          return res.status(403).json({ success: false, message: 'Only an existing admin can create new admin accounts' });

        let decoded;
        try { decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
        catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }

        if (decoded.type !== 'admin')
          return res.status(403).json({ success: false, message: 'Admin access required' });

        const requester = await Admin.findById(decoded.id);
        if (!requester || requester.role !== 'admin')
          return res.status(403).json({ success: false, message: 'Only a full admin can create new accounts' });
      }

      const { name, email, password, role } = req.body;
      const admin = await Admin.create({ name, email, password, role: count > 0 ? (role || 'editor') : 'admin' });
      const token = signAdminToken(admin._id);
      res.status(201).json({ success: true, token, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      res.status(400).json({ success: false, message: 'Could not create account' });
    }
  }
);

// POST /api/auth/login — with brute-force lockout after repeated failures
router.post('/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

      // Generic message regardless of which check fails — avoids leaking which emails exist
      const genericFail = () => res.status(401).json({ success: false, message: 'Invalid credentials' });

      if (!admin) return genericFail();

      if (admin.lockUntil && admin.lockUntil > Date.now()) {
        return res.status(423).json({ success: false, message: 'Account temporarily locked due to repeated failed attempts. Try again later.' });
      }

      const ok = await admin.comparePassword(password);
      if (!ok) {
        admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
        if (admin.failedLoginAttempts >= 6) {
          admin.lockUntil = Date.now() + 15 * 60 * 1000; // lock 15 min
          admin.failedLoginAttempts = 0;
        }
        await admin.save();
        return genericFail();
      }

      admin.failedLoginAttempts = 0;
      admin.lockUntil = undefined;
      await admin.save();

      const token = signAdminToken(admin._id);
      res.json({ success: true, token, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Login failed, please try again' });
    }
  }
);

// GET /api/auth/me
router.get('/me', requireAdmin, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

module.exports = router;