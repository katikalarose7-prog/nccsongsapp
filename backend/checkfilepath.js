// Diagnostic — run with: node check_file_path.js
// Shows the EXACT file path Node is loading for the Song model,
// and prints its raw file content so we can see what's really on disk.
const path = require('path');
const fs   = require('fs');

const modelPath = require.resolve('./models/Song.js');
console.log('\n=== Resolved file path ===');
console.log(modelPath);

console.log('\n=== Raw file content (from disk, not require cache) ===\n');
const content = fs.readFileSync(modelPath, 'utf8');
console.log(content);

console.log('\n=== Does this file contain "audioUrl"? ===');
console.log(content.includes('audioUrl') ? '✅ YES, found in file text' : '❌ NO, not found in file text');
console.log('');