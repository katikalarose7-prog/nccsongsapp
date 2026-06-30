// update_songs.js
// Usage: node scripts/update_songs.js   (run from backend folder)
// Updates existing songs in place, matched by songNumber. Safe to re-run.

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS fallback
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'test';
const COLLECTION_NAME = 'songs';
const JSON_PATH = path.join(__dirname, 'songs.json');

if (!MONGO_URI) {
  console.error('MONGO_URI not found in .env');
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

    const BATCH_SIZE = 200;
    let processed = 0;
    let matched = 0;
    let modified = 0;
    let upserted = 0;

    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);

      const ops = batch.map((song) => ({
        updateOne: {
          filter: { songNumber: song.songNumber },
          update: { $set: { ...song, isActive: true } },
          upsert: true, // if a song wasn't there for some reason, insert it
        },
      }));

      const result = await collection.bulkWrite(ops, { ordered: false });
      matched += result.matchedCount;
      modified += result.modifiedCount;
      upserted += result.upsertedCount;
      processed += batch.length;
      console.log(`Processed ${processed}/${songs.length}`);
    }

    console.log(`Done. Matched: ${matched}, Modified: ${modified}, Upserted (new): ${upserted}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});