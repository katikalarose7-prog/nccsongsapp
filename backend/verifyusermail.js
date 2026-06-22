// Diagnostic — run with: node verify_user_manually.js rosekatikala7@gmail.com
// Manually flips emailVerified to true, bypassing the email-click step.
// Useful for testing locally without worrying about a missed/spam-filtered
// verification email. NOT something to expose to real end users — this
// stays a one-off script you run yourself from the backend folder.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node verify_user_manually.js <email>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.log(`❌ No user found with email: ${email}`);
    process.exit(0);
  }

  if (user.emailVerified) {
    console.log(`✅ ${user.email} is already verified — nothing to do.`);
    process.exit(0);
  }

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  await user.save();

  console.log(`✅ ${user.email} is now manually verified.`);
  console.log('   They will now be included in new-song notification emails.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });