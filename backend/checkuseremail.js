// Diagnostic — run with: node check_user_email.js rosekatikala7@gmail.com
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function check() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node check_user_email.js <email>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.log(`\n❌ No user found with email: ${email}`);
    console.log('   → The account may not have actually been created, or was created with a different email.\n');
    process.exit(0);
  }

  console.log('\n=== User found ===');
  console.log('Name:               ', user.name);
  console.log('Email:              ', user.email);
  console.log('isActive:           ', user.isActive);
  console.log('emailVerified:      ', user.emailVerified);
  console.log('emailNotifications: ', user.emailNotifications);

  console.log('\n=== Would this user receive new-song emails? ===');
  const wouldReceive = user.isActive && user.emailVerified && user.emailNotifications;
  console.log(wouldReceive ? '✅ YES — all conditions met' : '❌ NO — see which flag is false above');

  if (!user.emailVerified) {
    console.log('\n👉 emailVerified is FALSE. This is almost certainly the reason.');
    console.log('   The account must click the verification link sent at registration,');
    console.log('   or SMTP must be configured for that email to have actually been sent.');
  }

  console.log('\n=== SMTP configuration check ===');
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log('SMTP_HOST set:', Boolean(process.env.SMTP_HOST));
  console.log('SMTP_USER set:', Boolean(process.env.SMTP_USER));
  console.log('SMTP_PASS set:', Boolean(process.env.SMTP_PASS));
  console.log(smtpConfigured
    ? '✅ SMTP looks configured — emails should actually send (not just log to console)'
    : '❌ SMTP is NOT configured — all emails are being printed to the backend console instead of sent. This includes the verification email itself, so you may never have received THAT either.');

  console.log('');
  process.exit(0);
}

check().catch((err) => { console.error(err); process.exit(1); });