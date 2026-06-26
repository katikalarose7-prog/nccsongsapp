import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function LegalLayout({ title, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)' }}>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-logo">
<div>
          <img src="/icons/icon-192.png" alt="NCC" className="header-logo-icon" style={{borderRadius:'50%', objectFit:'cover'}} />
</div>            <div>
              <span className="header-logo-name">New Covenant Church</span>
              <span className="header-logo-sub">{title}</span>
            </div>
          </Link>
          <Link to="/" className="btn btn-ghost" style={{ color: '#fff', marginLeft: 'auto' }}>
            <ArrowLeft size={14} /> Back to Songs
          </Link>
        </div>
      </header>
      <div className="container" style={{ padding: '36px 20px 60px', maxWidth: 760 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--brand-deep)', marginBottom: 20 }}>{title}</h1>
        <div style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p><em>Last updated: {new Date().toLocaleDateString()}</em></p>

      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>What we collect</h3>
      <p>When you create an account, we collect your name and email address. If you use playlists or favourites, we store which songs you've saved. If you're logged in, we keep a short listening history to power recommendations.</p>

      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>How we use it</h3>
      <p>Your email is used to verify your account, let you reset your password, and — only if you opt in — notify you when new songs are added. We never sell or share your data with third parties.</p>

      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>Cookies & local storage</h3>
      <p>We use browser storage to keep you signed in and to remember guest favourites before you create an account.</p>

      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>Your rights</h3>
      <p>You can update your profile, turn off email notifications, or request account deletion at any time by contacting us.</p>

      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>Contact</h3>
      <p>Questions about this policy? Reach out via our <Link to="/contact" style={{ color: 'var(--brand-light)' }}>contact page</Link>.</p>
    </LegalLayout>
  );
}

export function TermsOfUse() {
  return (
    <LegalLayout title="Terms of Use">
      <p><em>Last updated: {new Date().toLocaleDateString()}</em></p>
      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>Using this site</h3>
      <p>NCC Songs is provided for personal and congregational worship use. Song lyrics and recordings remain the property of their respective rights holders where applicable.</p>
      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>Accounts</h3>
      <p>You're responsible for keeping your account credentials secure. Please don't share your login with others.</p>
      <h3 style={{ marginTop: 20, color: 'var(--text-primary)' }}>Acceptable use</h3>
      <p>Please don't attempt to disrupt the service, scrape content at scale, or upload content you don't have rights to.</p>
    </LegalLayout>
  );
}

export function Contact() {
  return (
    <LegalLayout title="Contact Us">
      <p>For questions, feedback, or song requests, reach out to the church office:</p>
      <p style={{ marginTop: 12 }}>
        📧 Email: <a href="mailto:hello@nccsongs.church" style={{ color: 'var(--brand-light)' }}>hello@nccsongs.church</a><br />
        📍 New Covenant Church — Andhra Pradesh, India
      </p>
    </LegalLayout>
  );
}