const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

/* Verifies the caller is a logged-in Admin (role: admin or editor).
   Token must carry type:'admin' — this prevents a regular User token
   (type:'user') from ever being accepted here, even if somehow replayed. */
const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'admin')
      return res.status(403).json({ success: false, message: 'Admin access required' });

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });

    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/* Restricts a route to specific admin roles, e.g. requireRole('admin')
   to block 'editor' accounts from destructive actions if you add that
   distinction later. Use after requireAdmin. */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireRole  = requireRole;