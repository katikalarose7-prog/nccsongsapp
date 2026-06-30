// fix_isActive.js
// Usage: node scripts/fix_isActive.js   (run from backend folder)
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'test';
const COLLECTION_NAME = 'songs';

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

    const result = await collection.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});