/* Centralised email sending via Nodemailer (free — uses your own SMTP
   account, e.g. Gmail with an App Password, or any SMTP provider like
   Brevo/Zoho/Mailgun's free tier).
   Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM in .env.
   If SMTP credentials are not set, emails are logged to console instead
   of sent — so local development works without any email account. */
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'noreply@nccsongs.church';
const APP_URL    = process.env.APP_URL || 'http://localhost:3000';

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for port 465 (SSL), false for 587/25 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function send({ to, subject, html, text }) {
  if (!isConfigured) {
    console.log('\n📧  [DEV EMAIL — SMTP not configured, printing instead]');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', text || html?.replace(/<[^>]+>/g, ' ').slice(0, 300));
    console.log('');
    return { simulated: true };
  }
  try {
    await transporter.sendMail({ from: EMAIL_FROM, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

const sendVerificationEmail = (toEmail, name, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return send({
    to: toEmail,
    subject: 'Verify your NCC Songs account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3b0f6e">Welcome to NCC Songs, ${name}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Verify Email</a>
        <p style="color:#888;font-size:13px">If you didn't create this account, you can ignore this email.</p>
      </div>`,
  });
};

const sendPasswordResetEmail = (toEmail, name, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return send({
    to: toEmail,
    subject: 'Reset your NCC Songs password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3b0f6e">Password Reset Request</h2>
        <p>Hi ${name}, click below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
};

/* Sends a "new song added" notification for a SINGLE song — used when
   an admin adds one song manually via the Add Song form. */
const sendNewSongEmail = (toEmail, name, song) => {
  const link = `${APP_URL}/?song=${song._id}`;
  return send({
    to: toEmail,
    subject: `New song added: ${song.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3b0f6e">🎵 New Song Added</h2>
        <p>Hi ${name}, a new song was just added to NCC Songs:</p>
        <h3 style="margin-bottom:4px">${song.title}</h3>
        <p style="color:#888;margin-top:0">${song.category} · ${song.language}</p>
        <a href="${link}" style="display:inline-block;background:#f0a500;color:#1a0533;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:bold">View Song</a>
        <p style="color:#888;font-size:12px">You're receiving this because you opted in to new song notifications. You can turn these off anytime in your account settings.</p>
      </div>`,
  });
};

/* Sends a single SUMMARY email listing multiple newly-imported songs —
   used after a bulk import, so a 200-song import sends ONE email per
   user instead of 200. Lists up to 15 songs by name, then "+N more". */
const sendBulkNewSongsEmail = (toEmail, name, songs) => {
  const shown = songs.slice(0, 15);
  const remaining = songs.length - shown.length;

  const listHtml = shown.map(s => `
    <li style="margin-bottom:6px;">
      <a href="${APP_URL}/?song=${s._id}" style="color:#3b0f6e;text-decoration:none;font-weight:600;">${s.title}</a>
      <span style="color:#999;font-size:12px;"> — ${s.category} · ${s.language}</span>
    </li>`).join('');

  return send({
    to: toEmail,
    subject: `${songs.length} new song${songs.length !== 1 ? 's' : ''} added to NCC Songs`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3b0f6e">🎵 ${songs.length} New Song${songs.length !== 1 ? 's' : ''} Added</h2>
        <p>Hi ${name}, the following songs were just added to NCC Songs:</p>
        <ul style="padding-left:18px;">${listHtml}</ul>
        ${remaining > 0 ? `<p style="color:#888;font-size:13px;">…and ${remaining} more song${remaining !== 1 ? 's' : ''}.</p>` : ''}
        <a href="${APP_URL}" style="display:inline-block;background:#f0a500;color:#1a0533;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:bold">Browse All Songs</a>
        <p style="color:#888;font-size:12px">You're receiving this because you opted in to new song notifications. You can turn these off anytime in your account settings.</p>
      </div>`,
  });
};

module.exports = {
  send,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNewSongEmail,
  sendBulkNewSongsEmail,
};