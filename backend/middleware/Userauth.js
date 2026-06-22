const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/* Strict — requires a valid logged-in user, blocks otherwise */
const requireUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Please log in to continue' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'user')
      return res.status(401).json({ success: false, message: 'Invalid session' });

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: 'Account not found or disabled' });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Session expired, please log in again' });
  }
};

/* Optional — attaches req.user if a valid token is present, but never blocks.
   Used on public song routes so we can log history for logged-in users
   without forcing guests to log in just to browse. */
const optionalUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'user') {
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    }
  } catch {
    /* invalid/expired token on an optional route — just proceed as guest */
  }
  next();
};

module.exports = { requireUser, optionalUser };