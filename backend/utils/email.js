/* Centralised email via Nodemailer + Brevo SMTP (free tier: 300/day).
   Brevo is purpose-built for transactional email and delivers reliably
   to ALL providers — Gmail, Yahoo, Outlook, Hotmail, custom domains.
   Unlike Gmail SMTP, it won't get blocked by Google's security filters
   or require "Less secure app" settings.

   FREE SETUP (takes 5 min):
   1. Sign up at https://app.brevo.com (no credit card)
   2. Go to: Settings → SMTP & API → SMTP
   3. Copy Host, Port, Login, Password into your Railway env vars:
      SMTP_HOST = smtp-relay.brevo.com
      SMTP_PORT = 587
      SMTP_USER = (your Brevo login email)
      SMTP_PASS = (the SMTP key Brevo shows, NOT your login password)
      EMAIL_FROM = katikalarose7@gmail.com  (can be any email you own)
*/
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'noreply@nccsongs.church';
const APP_URL    = process.env.APP_URL || 'https://nccsongsapp.vercel.app';

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (isConfigured) {
  console.log({
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  HAS_PASS: !!SMTP_PASS,
});
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // These options help with deliverability
    tls: { rejectUnauthorized: true },
  });

  // Verify connection on startup so we know immediately if SMTP is broken
  transporter.verify((err) => {
  if (err) {
    console.error('FULL SMTP ERROR:');
    console.error(err);
  } else {
    console.log('SMTP Ready');
  }
});
}

async function send({ to, subject, html }) {
  if (!isConfigured) {
    console.log('\n📧 [EMAIL — SMTP not configured]');
    console.log('To:', to, '| Subject:', subject);
    console.log('Set SMTP_HOST, SMTP_USER, SMTP_PASS in Railway env vars to send real emails.\n');
    return { simulated: true };
  }
  try {
    const result = await transporter.sendMail({
      from: `"NCC Songs" <${EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to} | MessageId: ${result.messageId}`);
    return { sent: true };
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

// ── Email templates ─────────────────────────────────────────────

const emailWrap = (body) => `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f5f0ff}
.wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(60,0,100,0.1)}
.header{background:linear-gradient(135deg,#1a0533,#3b0f6e);padding:28px 32px;text-align:center}
.header h1{color:#f0a500;margin:0;font-size:22px}
.header p{color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px}
.body{padding:32px}
.btn{display:inline-block;background:#7c3aed;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
.footer{background:#f5f0ff;padding:16px 32px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="wrap">
<div class="header"><h1>✝ NCC Songs</h1><p>New Covenant Church</p></div>
<div class="body">${body}</div>
<div class="footer">New Covenant Church Songs · <a href="${APP_URL}" style="color:#7c3aed">Open App</a></div>
</div></body></html>`;

const sendVerificationEmail = (toEmail, name, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return send({
    to: toEmail,
    subject: 'Verify your NCC Songs account ✝',
    html: emailWrap(`
      <h2 style="color:#1a0533;margin-top:0">Welcome, ${name}! 🎉</h2>
      <p style="color:#444;line-height:1.6">Thank you for joining NCC Songs. Click the button below to verify your email and activate your account.</p>
      <div style="text-align:center">
        <a href="${link}" class="btn">Verify My Email</a>
      </div>
      <p style="color:#888;font-size:13px">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
    `),
  });
};

const sendPasswordResetEmail = (toEmail, name, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return send({
    to: toEmail,
    subject: 'Reset your NCC Songs password',
    html: emailWrap(`
      <h2 style="color:#1a0533;margin-top:0">Password Reset</h2>
      <p style="color:#444;line-height:1.6">Hi ${name}, we received a request to reset your password. Click below — this link expires in 1 hour.</p>
      <div style="text-align:center">
        <a href="${link}" class="btn">Reset My Password</a>
      </div>
      <p style="color:#888;font-size:13px">If you didn't request this, ignore this email — your password won't change.</p>
    `),
  });
};

const sendNewSongEmail = (toEmail, name, song) => {
  const link = `${APP_URL}/?song=${song._id}`;
  return send({
    to: toEmail,
    subject: `🎵 New song: ${song.title}`,
    html: emailWrap(`
      <h2 style="color:#1a0533;margin-top:0">New Song Added!</h2>
      <p style="color:#444">Hi ${name}, a new worship song was just added:</p>
      <div style="background:#f5f0ff;border-radius:12px;padding:20px;margin:16px 0">
        <h3 style="color:#1a0533;margin:0 0 6px">${song.title}</h3>
        <p style="color:#7c3aed;margin:0;font-size:13px;text-transform:capitalize">${song.category} · ${song.language}</p>
      </div>
      <div style="text-align:center">
        <a href="${link}" class="btn" style="background:#f0a500;color:#1a0533">View Song 🎵</a>
      </div>
      <p style="color:#888;font-size:12px;margin-top:20px">You're receiving this because you opted in to song notifications. Turn off anytime in Account → Profile Settings.</p>
    `),
  });
};

const sendBulkNewSongsEmail = (toEmail, name, songs) => {
  const shown = songs.slice(0, 15);
  const remaining = songs.length - shown.length;
  const listHtml = shown.map(s =>
    `<li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0ebff">
      <a href="${APP_URL}/?song=${s._id}" style="color:#1a0533;text-decoration:none;font-weight:700">${s.title}</a>
      <span style="color:#7c3aed;font-size:12px;margin-left:8px;text-transform:capitalize">${s.category} · ${s.language}</span>
    </li>`
  ).join('');

  return send({
    to: toEmail,
    subject: `🎵 ${songs.length} new song${songs.length !== 1 ? 's' : ''} added to NCC Songs`,
    html: emailWrap(`
      <h2 style="color:#1a0533;margin-top:0">${songs.length} New Song${songs.length !== 1 ? 's' : ''} Added!</h2>
      <p style="color:#444">Hi ${name}, the following songs were just added:</p>
      <ul style="padding-left:0;list-style:none;margin:16px 0">${listHtml}</ul>
      ${remaining > 0 ? `<p style="color:#888;font-size:13px">…and ${remaining} more song${remaining !== 1 ? 's' : ''}.</p>` : ''}
      <div style="text-align:center">
        <a href="${APP_URL}" class="btn" style="background:#f0a500;color:#1a0533">Browse All Songs</a>
      </div>
      <p style="color:#888;font-size:12px;margin-top:20px">Turn off notifications anytime in Account → Profile Settings.</p>
    `),
  });
};

module.exports = { send, sendVerificationEmail, sendPasswordResetEmail, sendNewSongEmail, sendBulkNewSongsEmail };
