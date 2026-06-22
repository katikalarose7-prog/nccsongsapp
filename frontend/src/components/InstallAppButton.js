import React, { useState, useEffect } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';

/* Detects platform and install state, then offers the right install path:
   - Android/Chrome/Edge: captures the real native `beforeinstallprompt`
     event and triggers Chrome's actual "Install app" dialog on click.
   - iOS Safari: there is no programmatic install API (Apple deliberately
     does not expose one), so we show a small instruction card pointing
     at the real Share → Add to Home Screen steps instead.
   - Already installed (running in standalone mode): hides itself entirely. */
export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari's own standalone flag
    setIsStandalone(standalone);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone) return null; // already installed, nothing to offer

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null); // the prompt can only be used once
      return;
    }
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    // Neither path available (e.g. desktop browser without PWA support,
    // or Android browser that hasn't fired beforeinstallprompt yet) —
    // hide the button rather than show a dead click.
  };

  // Hide entirely if there's truly nothing to offer (desktop without
  // install support and not iOS) — avoids a button that does nothing.
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="btn"
        style={{
          background: 'rgba(255,255,255,0.12)', color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.2)', fontSize: 13,
        }}
        title="Install this app on your device"
      >
        <Download size={14} /> Install App
      </button>

      {showIOSInstructions && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(10,0,25,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowIOSInstructions(false)}
        >
          <div style={{
            background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380,
            boxShadow: '0 -8px 40px rgba(0,0,0,0.25)', position: 'relative',
          }}>
            <button
              onClick={() => setShowIOSInstructions(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--brand-deep)', marginBottom: 16 }}>
              Install NCC Songs on iPhone
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Share size={16} color="var(--brand-mid)" />
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Tap the <strong>Share</strong> button in Safari's toolbar
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PlusSquare size={16} color="var(--brand-mid)" />
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Scroll down and tap <strong>"Add to Home Screen"</strong>
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
              The app icon will then appear on your home screen, just like any other app.
            </p>
          </div>
        </div>
      )}
    </>
  );
}