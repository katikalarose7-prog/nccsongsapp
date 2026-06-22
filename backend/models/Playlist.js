const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    songs: [{
      song:    { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
      addedAt: { type: Date, default: Date.now },
    }],
    isPublic: { type: Boolean, default: false }, // future-proofing for shareable playlists
  },
  { timestamps: true }
);

playlistSchema.index({ owner: 1, name: 1 });

module.exports = mongoose.model('Playlist', playlistSchema);