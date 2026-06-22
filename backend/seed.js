require('dotenv').config();
const mongoose = require('mongoose');
const Admin    = require('./models/Admin');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  MongoDB connected');

    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (existing) {
      console.log('⚠️   Admin already exists:', existing.email);
      process.exit(0);
    }

    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
      console.error('❌  ADMIN_PASSWORD must be set in .env and be at least 8 characters.');
      process.exit(1);
    }

    const admin = await Admin.create({
      name:     process.env.ADMIN_NAME || 'Admin',
      email:    process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role:     'admin',
    });

    console.log('🎉  Admin created successfully!');
    console.log('📧  Email:', admin.email);
    console.log('👤  Role: ', admin.role);
    process.exit(0);
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  }
}

seed();