const mongoose = require('mongoose');

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Song title is required'],
      trim: true,
      index: true,
    },
    titleTelugu: { type: String, trim: true },
    titleHindi:  { type: String, trim: true },

    lyrics: {
      type: String,
      required: [true, 'Lyrics are required'],
    },
    lyricsTelugu: { type: String },
    lyricsHindi:  { type: String },

    language: {
      type: String,
      enum: ['english', 'telugu', 'hindi', 'multilingual'],
      default: 'english',
      index: true,
    },

    category: {
      type: String,
      enum: ['worship', 'praise', 'christmas', 'resurrection', 'communion', 'wedding', 'goodfriday', 'thanksgiving','sundayschoolsongs', 'other'],
      default: 'worship',
      index: true,
    },

    tags: [{ type: String, lowercase: true }],

    songNumber: { type: Number, index: true },

    key:   { type: String, trim: true },
    bpm:   { type: Number },
    tempo: { type: String, enum: ['slow', 'medium', 'fast'] },

    youtubeUrl: { type: String, trim: true },
    audioUrl:   { type: String, trim: true },
    chords:     { type: String },

    isActive:  { type: Boolean, default: true, index: true },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Full-text search index — language_override prevents conflict with MongoDB's reserved 'language' field
songSchema.index({
  title:        'text',
  titleTelugu:  'text',
  titleHindi:   'text',
  lyrics:       'text',
  lyricsTelugu: 'text',
  lyricsHindi:  'text',
  tags:         'text',
  category:     'text',
}, {
  language_override: 'searchLanguage',
  default_language:  'none',
});

/* ─── Compound indexes ───────────────────────────────────────────
   Every list query filters on isActive first (it's on virtually every
   request), then sorts or filters by one more field. Single-field
   indexes on isActive/title/language/category individually let Mongo
   use ONE of them but still fall back to an in-memory sort/filter for
   whatever's left. These compound indexes match the actual query
   shapes in routes/songs.js so the DB can satisfy filter + sort from
   the index alone — this is the difference between an indexed lookup
   and a collection scan as the song count grows.

   isActive is first in each because it's always present in the
   filter, giving Mongo the smallest possible starting set before
   applying the second field. */
songSchema.index({ isActive: 1, title: 1 }, { collation: { locale: 'en', strength: 2 } }); // default homepage sort (A–Z)
songSchema.index({ isActive: 1, songNumber: 1 });          // "By No." sort
songSchema.index({ isActive: 1, createdAt: -1 });          // "Newest" sort
songSchema.index({ isActive: 1, language: 1, category: 1 }); // combined language+category filters

module.exports = mongoose.model('Song', songSchema);