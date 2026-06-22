import React, { useState } from 'react';
import { Share2, Check, MessageCircle } from 'lucide-react';

/* Generates a shareable deep link like https://yoursite.com/?song=<id>
   so that opening it (from WhatsApp, etc.) takes the visitor straight
   to that specific song's modal — see the ?song= handling in HomePage. */
export default function ShareButton({ songId, title, style }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/?song=${songId}`;
  const shareText = `🎵 ${title} — New Covenant Church Songs\n${shareUrl}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Check out this song: ${title}`, url: shareUrl });
      } catch {
        /* user cancelled share sheet — no action needed */
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — fall back to WhatsApp link below */
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      <a href={whatsappUrl} target="_blank" rel="noreferrer"
        className="btn btn-outline" style={{ fontSize: 13, padding: '7px 12px' }}
        title="Share on WhatsApp">
        <MessageCircle size={13} /> WhatsApp
      </a>
      <button
        type="button"
        onClick={navigator.share ? handleNativeShare : handleCopy}
        className="btn btn-outline" style={{ fontSize: 13, padding: '7px 12px' }}
        title="Copy share link"
      >
        {copied ? <Check size={13} /> : <Share2 size={13} />}
        {copied ? 'Copied!' : 'Share'}
      </button>
    </div>
  );
}