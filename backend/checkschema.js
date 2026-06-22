// Diagnostic — run with: node check_schema.js
// Prints every field Mongoose actually thinks exists on the Song model,
// straight from the loaded models/Song.js file. This tells us definitively
// whether audioUrl is really registered in the schema your server is running.
require('dotenv').config();
const Song = require('./models/Song');

console.log('\n=== Song schema paths (what Mongoose actually knows about) ===');
Object.keys(Song.schema.paths).forEach((p) => {
  console.log(' -', p);
});
console.log('');

const hasAudioUrl = Object.keys(Song.schema.paths).includes('audioUrl');
console.log(hasAudioUrl
  ? '✅ audioUrl IS registered in the schema.'
  : '❌ audioUrl is MISSING from the schema — this is the bug.');
console.log('');
process.exit();