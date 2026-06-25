import React, { useState, useEffect } from 'react';
import { Download, Share, X, PlusSquare, Monitor } from 'lucide-react';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showDesktopInstructions, setShowDesktopInstructions] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsIOS(ios);
    setIsDesktop(!mobile);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    if (isIOS) { setShowIOSInstructions(true); return; }
    // Desktop Chrome/Edge without prompt yet — show manual instructions
    setShowDesktopInstructions(true);
  };

  // Show on: Android/mobile (native prompt or iOS manual), OR desktop Chrome/Edge
  // Only hide if we're truly in a context where nothing can be done
  if (!deferredPrompt && !isIOS && !isDesktop) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="btn"
        style={{
          background: 'rgba(255,255,255,0.12)', color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.2)', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
        title="Install this app on your device"
      >
        <Download size={14} /> Install App
      </button>

      {/* iOS instructions */}
      {showIOSInstructions && (
        <div style={{
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
            <button onClick={() => setShowIOSInstructions(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a0533', marginBottom: 16 }}>
              📱 Install NCC Songs on iPhone
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Share size={18} color="#7c3aed" />
              </div>
              <span style={{ fontSize: 14, color: '#444' }}>
                1. Tap the <strong>Share</strong> button (□↑) in Safari's bottom toolbar
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PlusSquare size={18} color="#7c3aed" />
              </div>
              <span style={{ fontSize: 14, color: '#444' }}>
                2. Scroll down and tap <strong>"Add to Home Screen"</strong>
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#888', marginTop: 16, lineHeight: 1.5 }}>
              The NCC Songs icon will appear on your home screen, just like a real app. No App Store needed!
            </p>
          </div>
        </div>
      )}

      {/* Desktop instructions */}
      {showDesktopInstructions && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,0,25,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={(e) => e.target === e.currentTarget && setShowDesktopInstructions(false)}
        >
          <div style={{
            background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400,
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)', position: 'relative',
          }}>
            <button onClick={() => setShowDesktopInstructions(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
              <X size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Monitor size={24} color="#7c3aed" />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a0533', margin: 0 }}>
                Install on Desktop
              </h3>
            </div>
            <p style={{ fontSize: 14, color: '#444', marginBottom: 16, lineHeight: 1.6 }}>
              In <strong>Chrome or Edge</strong>, look for the install icon (⊕) in the address bar on the right side, then click <strong>"Install"</strong>.
            </p>
            <p style={{ fontSize: 14, color: '#444', marginBottom: 16, lineHeight: 1.6 }}>
              Or go to the browser menu (⋮) → <strong>"Install NCC Songs"</strong>
            </p>
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              Once installed, NCC Songs opens in its own window without the browser bar — just like a desktop app. Works on Windows, Mac, and Linux.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
