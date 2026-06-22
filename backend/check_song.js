// Diagnostic script — run with: node check_song.js
// Shows what's actually saved in MongoDB for your songs, to debug
// whether the audioUrl field is being saved correctly.
require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('./models/Song');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const songs = await Song.find({}).select('title audioUrl youtubeUrl updatedAt').sort({ updatedAt: -1 }).limit(10);
  console.log('\n=== Last 10 updated songs ===');
  if (songs.length === 0) {
    console.log('No songs found in database.');
  }
  songs.forEach(s => {
    console.log(`- "${s.title}"`);
    console.log(`    audioUrl: ${s.audioUrl || '(empty)'}`);
    console.log(`    updated:  ${s.updatedAt}`);
  });
  console.log('');
  process.exit();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});