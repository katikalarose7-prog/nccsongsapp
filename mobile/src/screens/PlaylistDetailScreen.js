import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from '../components/Toast';
import { fetchPlaylist, removeSongFromPlaylist } from '../api';
import { colors } from '../theme';

// Builds the same kind of clean printable layout as the web app's
// server-generated PDF, but rendered locally via expo-print (HTML → PDF)
// since that's the standard, reliable way to generate PDFs on-device
// without needing a native PDF library.
function buildPlaylistHtml(playlist) {
  const songsHtml = playlist.songs
    .filter(e => e.song)
    .map((entry, i) => {
      const s = entry.song;
      return `
        <div style="margin-bottom:22px;${i > 0 ? 'border-top:1px solid #ddd;padding-top:18px;' : ''}">
          <div style="font-size:16px;font-weight:700;color:#1a0533;">
            ${i + 1}. ${s.title}${s.songNumber ? ` (No. ${s.songNumber})` : ''}
          </div>
          <div style="font-size:11px;color:#888;margin-bottom:8px;">
            ${s.category} · ${s.language}${s.key ? ` · Key: ${s.key}` : ''}
          </div>
          <div style="font-size:13px;color:#222;white-space:pre-wrap;line-height:1.7;">
            ${(s.lyrics || '(No lyrics available)').replace(/</g, '&lt;')}
          </div>
        </div>`;
    }).join('');

  return `
    <html>
      <body style="font-family:-apple-system,Helvetica,sans-serif;padding:36px;">
        <h1 style="color:#3b0f6e;text-align:center;font-size:22px;">${playlist.name}</h1>
        ${playlist.description ? `<p style="text-align:center;color:#666;font-size:12px;">${playlist.description}</p>` : ''}
        <p style="text-align:center;color:#999;font-size:10px;">
          New Covenant Church Songs · ${playlist.songs.length} songs · Generated ${new Date().toLocaleDateString()}
        </p>
        <div style="margin-top:24px;">${songsHtml}</div>
      </body>
    </html>`;
}

export default function PlaylistDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const load = useCallback(() => {
    setLoading(true);
    fetchPlaylist(id)
      .then(r => setPlaylist(r.playlist))
      .catch(() => showToast('Could not load playlist', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = (songId, title) => {
    Alert.alert('Remove song', `Remove "${title}" from this playlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await removeSongFromPlaylist(id, songId);
          showToast('Removed');
          load();
        },
      },
    ]);
  };

  const handleExportPdf = async () => {
    if (!playlist || playlist.songs.length === 0) {
      showToast('Add some songs first', 'error');
      return;
    }
    setExporting(true);
    try {
      const html = buildPlaylistHtml(playlist);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: playlist.name });
      } else {
        showToast('Sharing is not available on this device', 'error');
      }
    } catch (err) {
      showToast('Could not generate PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.brandLight} size="large" /></View>
  );
  if (!playlist) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDeep} />
      {toast && <Toast {...toast} onHide={() => setToast(null)} />}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{playlist.name}</Text>
          <Text style={styles.headerSub}>{playlist.songs.length} songs</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPdf} disabled={exporting}>
          {exporting
            ? <ActivityIndicator size="small" color={colors.brandDeep} />
            : <><Ionicons name="download-outline" size={15} color={colors.brandDeep} /><Text style={styles.exportBtnText}>PDF</Text></>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlist.songs.filter(e => e.song)}
        keyExtractor={e => e.song._id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No songs in this playlist yet</Text>
            <Text style={styles.emptyText}>Open any song and tap "Add to Playlist"</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.songCard} onPress={() => nav.navigate('SongDetail', { id: item.song._id })}>
            <View style={{ flex: 1 }}>
              {item.song.songNumber ? <Text style={styles.songNum}>No. {item.song.songNumber}</Text> : null}
              <Text style={styles.songTitle}>{item.song.title}</Text>
              <View style={styles.badges}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.song.language}</Text></View>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.song.category}</Text></View>
              </View>
            </View>
            <TouchableOpacity onPress={() => handleRemove(item.song._id, item.song.title)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 40, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { padding: 2 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.brandGold, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
  },
  exportBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.brandDeep },

  songCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  songNum: { fontSize: 10.5, fontWeight: '700', color: colors.textMuted, marginBottom: 3 },
  songTitle: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  badge: { backgroundColor: colors.surface2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.brandMid, textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textSec, marginTop: 10 },
  emptyText: { fontSize: 12.5, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});