// import_songs.js
// Usage: node scripts/import_songs.js   (run from backend folder)
// Requires: npm install mongodb dotenv
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// --- CONFIG ---
// Reads from your existing .env. Update the env var name below if yours is different
// (e.g. MONGODB_URI, MONGO_URL, DATABASE_URL, etc.)
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'test';
const COLLECTION_NAME = 'songs';
const JSON_PATH = path.join(__dirname, 'songs.json');
// ---------------------------

if (!MONGO_URI) {
  console.error('No Mongo connection string found. Check your .env variable name and update MONGO_URI in this script.');
  process.exit(1);
}

async function main() {
  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  const songs = JSON.parse(raw);

  if (!Array.isArray(songs)) {
    throw new Error('Expected songs.json to contain a JSON array');
  }

  console.log(`Loaded ${songs.length} songs from ${JSON_PATH}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // insertMany in batches to avoid overwhelming the connection
    const BATCH_SIZE = 200;
    let inserted = 0;

    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);
      const result = await collection.insertMany(batch, { ordered: false });
      inserted += result.insertedCount;
      console.log(`Inserted ${inserted}/${songs.length}`);
    }

    console.log('Done. Total inserted:', inserted);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});