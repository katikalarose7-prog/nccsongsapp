// Diagnostic — run with: node check_models_folder.js
// Lists everything actually inside backend/models/ on disk, then reads
// Playlist.js specifically by its full absolute path (not via require
// resolution, to rule out any module-caching or path confusion).
const path = require('path');
const fs   = require('fs');

const modelsDir = path.join(__dirname, 'models');

console.log('\n=== Files actually inside backend/models/ ===');
console.log('Looking in:', modelsDir);
try {
  const files = fs.readdirSync(modelsDir);
  files.forEach(f => console.log(' -', f));
} catch (err) {
  console.log('❌ Could not read models folder:', err.message);
  process.exit(1);
}

const playlistPath = path.join(modelsDir, 'Playlist.js');
console.log('\n=== Reading Playlist.js directly at: ===');
console.log(playlistPath);

if (!fs.existsSync(playlistPath)) {
  console.log('\n❌ Playlist.js does NOT exist at that exact path.');
  console.log('   Check the filename casing and that it is actually inside backend/models/.');
  process.exit(1);
}

const content = fs.readFileSync(playlistPath, 'utf8');
console.log('\n=== Raw content of models/Playlist.js ===\n');
console.log(content);

console.log('\n=== Ends with correct export? ===');
console.log(content.includes("module.exports = mongoose.model('Playlist'")
  ? '✅ YES'
  : '❌ NO — this file is broken/incomplete.');
console.log('');