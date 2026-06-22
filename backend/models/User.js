const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    password: { type: String, required: true, minlength: 6, select: false },

    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },

    // Preferences
    emailNotifications: { type: Boolean, default: true }, // notify on new songs
    preferredLanguage:  { type: String, enum: ['english','telugu','hindi','multilingual',''], default: '' },

    // Listening history — capped to most recent 100 via $push + $slice in the route
    history: [{
      song:    { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
      playedAt:{ type: Date, default: Date.now },
    }],

    favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],

    // Account security
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil:           { type: Date, select: false },
    passwordResetToken:  { type: String, select: false },
    passwordResetExpires:{ type: Date, select: false },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.createEmailVerifyToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken = crypto.createHash('sha256').update(token).digest('hex');
  return token; // raw token sent via email; hashed version stored
};

userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

module.exports = mongoose.model('User', userSchema);