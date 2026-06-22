import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';

/* Voice search button using the browser's built-in Web Speech API
   (SpeechRecognition). Works in Chrome, Edge, and Safari; gracefully
   hides itself in browsers without support (e.g. Firefox desktop)
   rather than showing a broken button. No external API key needed. */
export default function VoiceSearchButton({ onResult, lang = 'en-IN' }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      toast.error('Voice search is not supported in this browser. Try Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onend   = () => setListening(false);
    recognition.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        toast.error('Microphone access was denied');
      } else if (e.error !== 'no-speech') {
        toast.error('Voice search failed, please try again');
      }
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognition, lang, onResult]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  if (!SpeechRecognition) return null; // hide entirely if unsupported, rather than show a dead button

  return (
    <button
      type="button"
      onClick={listening ? stopListening : startListening}
      title={listening ? 'Stop listening' : 'Search by voice'}
      aria-label={listening ? 'Stop voice search' : 'Start voice search'}
      style={{
        background: listening ? '#ef4444' : 'transparent',
        border: 'none', cursor: 'pointer', padding: 6,
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: listening ? '#fff' : 'rgba(255,255,255,0.65)',
        transition: 'background 0.15s, color 0.15s',
        animation: listening ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }}
    >
      {listening ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  );
}