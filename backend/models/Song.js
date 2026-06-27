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
      enum: ['worship', 'praise', 'christmas', 'resurrection', 'communion', 'wedding', 'death', 'thanksgiving','SundaySchoolSongs', 'other'],
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

module.exports = mongoose.model('Song', songSchema);