// Diagnostic — run with: node check_telugu_encoding.js <songId>
// Prints the raw bytes/codepoints of a song's Telugu lyrics field exactly
// as MongoDB returns them, so we can see if the data itself is corrupted
// (e.g. double-encoded UTF-8, or saved as Latin-1/Windows-1252 by mistake)
// versus the encoding only breaking later when PDFKit writes it out.
require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('./models/Song');

async function check() {
  const songId = process.argv[2];
  await mongoose.connect(process.env.MONGO_URI);

  let song;
  if (songId) {
    song = await Song.findById(songId);
  } else {
    song = await Song.findOne({ lyricsTelugu: { $exists: true, $ne: '' } });
  }

  if (!song) {
    console.log('No song found with Telugu lyrics.');
    process.exit(0);
  }

  console.log('\n=== Song ===');
  console.log('Title:', song.title);
  console.log('_id:  ', song._id);

  console.log('\n=== titleTelugu — printed directly ===');
  console.log(song.titleTelugu);

  console.log('\n=== titleTelugu — first 20 char codes ===');
  const chars = (song.titleTelugu || '').slice(0, 20).split('');
  chars.forEach(c => {
    console.log(`  '${c}'  →  U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
  });

  console.log('\n=== Is this in the correct Telugu Unicode block? ===');
  // Real Telugu script lives in U+0C00 to U+0C7F.
  const inTeluguBlock = chars.every(c => {
    const code = c.codePointAt(0);
    return code >= 0x0C00 && code <= 0x0C7F || code === 32; // allow spaces
  });
  console.log(inTeluguBlock
    ? '✅ YES — these are real Telugu Unicode codepoints. The DATA is fine; the bug is in PDF rendering.'
    : '❌ NO — these codepoints are NOT in the Telugu Unicode range. The DATA ITSELF is corrupted in MongoDB (likely double-encoded or wrong-encoding import).');

  console.log('');
  process.exit(0);
}

check().catch((err) => { console.error(err); process.exit(1); });