/* Email via Brevo HTTP API — NOT SMTP.
   Railway (and most free hosts) block outbound SMTP ports (587, 465)
   as anti-spam. The HTTP API goes over port 443 (HTTPS) which is
   always open. Same free tier: 300 emails/day, no credit card.

   SETUP (get your API key in 2 minutes):
   1. Sign up free at https://app.brevo.com
   2. Go to: top-right avatar → SMTP & API → API Keys tab
   3. Click "Generate a new API key" → name it "NCC Songs"
   4. Copy the key and add to Railway env vars:
        BREVO_API_KEY = xkeysib-xxxxxxxxxxxxxxxxxxxxx
        EMAIL_FROM    = katikalarose7@gmail.com
        APP_URL       = https://nccsongsapp.vercel.app

   NOTE: EMAIL_FROM must be a verified sender in Brevo.
   Go to Brevo → Senders & IPs → Senders → Add a sender
   and verify your email address there first.                     */

const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM    = process.env.EMAIL_FROM || 'noreply@nccsongs.church';
const FROM_NAME     = 'NCC Songs';
const APP_URL       = process.env.APP_URL || 'https://nccsongsapp.vercel.app';

const isConfigured = Boolean(BREVO_API_KEY);

if (!isConfigured) {
  console.warn('⚠️  BREVO_API_KEY not set — emails will be logged to console only.');
  console.warn('   Set BREVO_API_KEY in Railway environment variables to send real emails.');
}

/* Core send function — calls Brevo's transactional email REST API.
   Returns { sent: true } on success, { sent: false, error } on failure. */
async function send({ to, toName, subject, html }) {
  if (!isConfigured) {
    console.log('\n📧 [DEV EMAIL — BREVO_API_KEY not configured]');
    console.log(`To: ${toName} <${to}>`);
    console.log(`Subject: ${subject}`);
    console.log('Set BREVO_API_KEY in Railway to send real emails.\n');
    return { simulated: true };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'api-key':      BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: FROM_NAME, email: EMAIL_FROM },
        to:          [{ email: to, name: toName || to }],
        replyTo:     { name: FROM_NAME, email: EMAIL_FROM },
        subject,
        htmlContent: html,
        // Plain text fallback — emails without this are more likely
        // to be flagged as spam by Gmail/Outlook content filters.
        textContent: html.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim(),
        headers: {
          // Mark as transactional so providers treat it as expected mail,
          // not bulk/marketing which goes to Promotions/Spam tabs.
          'X-Mailin-custom': 'transactional',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Brevo API error (${response.status}):`, JSON.stringify(data));
      return { sent: false, error: data.message || response.statusText };
    }

    console.log(`✅ Email sent to ${to} | MessageId: ${data.messageId}`);
    return { sent: true, messageId: data.messageId };
  } catch (err) {
    console.error(`❌ Email fetch error:`, err.message);
    return { sent: false, error: err.message };
  }
}

/* ── Shared HTML wrapper ─────────────────────────────────────── */
const emailWrap = (body) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f5f0ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
  .outer{padding:32px 16px}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(60,0,100,0.12)}
  .header{background:linear-gradient(135deg,#1a0533 0%,#3b0f6e 100%);padding:28px 32px;text-align:center}
  .logo{display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#f0a500,#f59e0b);border-radius:14px;line-height:52px;font-size:26px;margin-bottom:10px}
  .header h1{color:#f0a500;margin:0;font-size:20px;font-weight:700;letter-spacing:0.5px}
  .header p{color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:13px}
  .body{padding:32px}
  .btn{display:inline-block;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
  .btn-purple{background:#7c3aed;color:#fff}
  .btn-gold{background:#f0a500;color:#1a0533}
  .footer{background:#f5f0ff;padding:16px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #e8deff}
  .footer a{color:#7c3aed;text-decoration:none}
  h2{color:#1a0533;margin-top:0;font-size:20px}
  p{color:#444;line-height:1.65;font-size:14px}
  .song-box{background:#f5f0ff;border-radius:12px;padding:18px 20px;margin:16px 0;border-left:4px solid #7c3aed}
  .song-title{font-size:17px;font-weight:700;color:#1a0533;margin:0 0 4px}
  .song-meta{font-size:13px;color:#7c3aed;text-transform:capitalize}
</style>
</head>
<body><div class="outer"><div class="card">
<div class="header">
  <div class="logo">✝</div>
  <h1>New Covenant Church</h1>
  <p>NCC Songs — Worship &amp; Praise</p>
</div>
<div class="body">${body}</div>
<div class="footer">
  <a href="${APP_URL}">Open NCC Songs</a> &nbsp;·&nbsp;
  New Covenant Church &nbsp;·&nbsp;
  <a href="${APP_URL}/login">Manage Account</a>
</div>
</div></div></body></html>`;

/* ── Email templates ─────────────────────────────────────────── */

const sendVerificationEmail = (toEmail, name, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return send({
    to: toEmail, toName: name,
    subject: '✝ Verify your NCC Songs account',
    html: emailWrap(`
      <h2>Welcome, ${name}! 🎉</h2>
      <p>Thank you for joining NCC Songs. Please verify your email address to activate your account and start receiving song notifications.</p>
      <div style="text-align:center">
        <a href="${link}" class="btn btn-purple">Verify My Email</a>
      </div>
      <p style="color:#888;font-size:13px;margin-top:8px">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
    `),
  });
};

const sendPasswordResetEmail = (toEmail, name, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return send({
    to: toEmail, toName: name,
    subject: 'Reset your NCC Songs password',
    html: emailWrap(`
      <h2>Password Reset Request</h2>
      <p>Hi ${name}, we received a request to reset your NCC Songs password. Click the button below — this link is valid for 1 hour.</p>
      <div style="text-align:center">
        <a href="${link}" class="btn btn-purple">Reset My Password</a>
      </div>
      <p style="color:#888;font-size:13px;margin-top:8px">If you didn't request this, your account is safe — just ignore this email.</p>
    `),
  });
};

const sendNewSongEmail = (toEmail, name, song) => {
  const link = `${APP_URL}/?song=${song._id}`;
  return send({
    to: toEmail, toName: name,
    subject: `🎵 New song added: ${song.title}`,
    html: emailWrap(`
      <h2>New Song Added! 🎵</h2>
      <p>Hi ${name}, a new worship song was just added to NCC Songs:</p>
      <div class="song-box">
        <div class="song-title">${song.title}</div>
        <div class="song-meta">${song.category} · ${song.language}</div>
      </div>
      <div style="text-align:center">
        <a href="${link}" class="btn btn-gold">View Song →</a>
      </div>
      <p style="color:#aaa;font-size:12px;margin-top:20px">You're receiving this because you opted in to song notifications. Turn off anytime in Account → Profile Settings.</p>
    `),
  });
};

const sendBulkNewSongsEmail = (toEmail, name, songs) => {
  const shown     = songs.slice(0, 15);
  const remaining = songs.length - shown.length;

  const listHtml = shown.map(s => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0ebff">
        <a href="${APP_URL}/?song=${s._id}" style="color:#1a0533;text-decoration:none;font-weight:700;font-size:14px">${s.title}</a>
        <br><span style="color:#7c3aed;font-size:12px;text-transform:capitalize">${s.category} · ${s.language}</span>
      </td>
    </tr>`).join('');

  return send({
    to: toEmail, toName: name,
    subject: `🎵 ${songs.length} new song${songs.length !== 1 ? 's' : ''} added to NCC Songs`,
    html: emailWrap(`
      <h2>${songs.length} New Song${songs.length !== 1 ? 's' : ''} Added!</h2>
      <p>Hi ${name}, the following worship songs were just added:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${listHtml}
      </table>
      ${remaining > 0 ? `<p style="color:#888;font-size:13px;margin-top:8px">…and ${remaining} more song${remaining !== 1 ? 's' : ''}.</p>` : ''}
      <div style="text-align:center;margin-top:20px">
        <a href="${APP_URL}" class="btn btn-gold">Browse All Songs →</a>
      </div>
      <p style="color:#aaa;font-size:12px;margin-top:20px">Turn off notifications anytime in Account → Profile Settings.</p>
    `),
  });
};

module.exports = {
  send,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNewSongEmail,
  sendBulkNewSongsEmail,
};
