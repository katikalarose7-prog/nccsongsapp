import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSongShareUrl } from '../api';
import { colors } from '../theme';

/* Generates a shareable deep link like https://nccsongs.church/?song=<id>
   — opening it (e.g. from WhatsApp) takes the recipient straight to that
   song on the website. Uses React Native's built-in Share API, which
   surfaces WhatsApp, Messages, email etc. automatically via the native
   share sheet — no extra package needed. */
export default function ShareButton({ songId, title, style }) {
  const shareUrl = getSongShareUrl(songId);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🎵 ${title} — New Covenant Church Songs\n${shareUrl}`,
        url: shareUrl, // used by iOS; Android falls back to message text
        title,
      });
    } catch {
      // user cancelled — no action needed
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`🎵 ${title} — New Covenant Church Songs\n${shareUrl}`);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/?text=${text}`);
    });
  };

  return (
    <>
      <TouchableOpacity style={[styles.btn, style]} onPress={handleWhatsApp}>
        <Ionicons name="logo-whatsapp" size={14} color={colors.brandDeep} />
        <Text style={styles.btnText}>WhatsApp</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, style]} onPress={handleShare}>
        <Ionicons name="share-social-outline" size={14} color={colors.brandDeep} />
        <Text style={styles.btnText}>Share</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  btnText: { fontSize: 12.5, fontWeight: '700', color: colors.brandDeep },
});