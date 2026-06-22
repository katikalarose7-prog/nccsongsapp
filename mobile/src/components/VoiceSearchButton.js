import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/* Voice search using expo-speech-recognition. This requires a native
   module, so it only works in a custom dev client / standalone build —
   NOT in plain Expo Go. We try to load it lazily and hide the button
   entirely if it's unavailable, exactly like the web app hides its mic
   button in browsers without SpeechRecognition support — never show a
   button that can't actually do anything. */
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {
  // Module not installed/available in this build — voice search will be hidden.
}

export default function VoiceSearchButton({ onResult }) {
  const [listening, setListening] = useState(false);

  if (!ExpoSpeechRecognitionModule) return null; // hide entirely if unsupported

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript) onResult(transcript);
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSpeechRecognitionEvent('end', () => setListening(false));
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error !== 'no-speech') {
      Alert.alert('Voice search', 'Could not recognize speech. Please try again.');
    }
  });

  const start = async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone permission needed', 'Please allow microphone access to use voice search.');
      return;
    }
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: false, continuous: false });
  };

  const stop = () => {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  };

  return (
    <TouchableOpacity
      onPress={listening ? stop : start}
      style={[styles.btn, listening && styles.btnActive]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={listening ? 'mic-off' : 'mic-outline'} size={16} color={listening ? '#fff' : 'rgba(255,255,255,0.7)'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 6, borderRadius: 20 },
  btnActive: { backgroundColor: '#ef4444' },
});