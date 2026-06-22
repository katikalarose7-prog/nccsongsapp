import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, StatusBar,
  Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from '../components/Toast';
import ShareButton from '../components/ShareButton';
import AddToPlaylistButton from '../components/AddToPlaylistButton';
import { fetchSong, resolveAudioUrl, toggleFavourite, fetchFavourites } from '../api';
import { useUserAuth } from '../context/UserAuthContext';
import { colors } from '../theme';

const TABS = [
  { key: 'english', label: '🇬🇧 English' },
  { key: 'telugu',  label: '🇮🇳 Telugu' },
  { key: 'hindi',   label: '🕌 Hindi' },
];

export default function SongDetailScreen() {
  const nav   = useNavigation();
  const route = useRoute();
  const { user } = useUserAuth();
  const { id } = route.params;

  const [song, setSong]           = useState(null);
  const [tab, setTab]             = useState('english');
  const [showChords, setShowChords] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFav, setIsFav]         = useState(false);
  const [toast, setToast]         = useState(null);
  const soundRef = useRef(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    fetchSong(id).then(r => {
      setSong(r.song);
      if (!r.song.lyrics && r.song.lyricsTelugu) setTab('telugu');
    });
    if (user) {
      fetchFavourites().then(r => setIsFav(r.songs.some(s => s._id === id))).catch(() => {});
    }
    return () => {
      // Cleanup audio on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [id, user]);

  const handleToggleFav = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save favourites to your account.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => nav.navigate('Login') },
      ]);
      return;
    }
    setIsFav(v => !v); // optimistic
    try {
      const res = await toggleFavourite(id);
      setIsFav(res.favourites.includes(id));
    } catch {
      setIsFav(v => !v); // revert
    }
  };

  const handlePlayAudio = async () => {
    if (!song?.audioUrl) return;
    try {
      if (soundRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: resolveAudioUrl(song.audioUrl) },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) setIsPlaying(false);
      });
    } catch (err) {
      Alert.alert('Audio Error', 'Could not play audio. Check the URL.');
    }
  };

  if (!song) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brandLight} size="large" />
    </View>
  );

  const availableTabs = TABS.filter(t =>
    t.key === 'english' ? song.lyrics
    : t.key === 'telugu' ? song.lyricsTelugu
    : song.lyricsHindi
  );

  const currentLyrics = tab === 'english' ? song.lyrics
    : tab === 'telugu' ? song.lyricsTelugu : song.lyricsHindi;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDeep} />

      {/* Header */}
      <View style={styles.header}>
        {toast && <Toast {...toast} onHide={() => setToast(null)} />}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleFav} style={styles.favIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#ef4444' : '#fff'} />
          </TouchableOpacity>
        </View>
        {song.songNumber ? <Text style={styles.headerNum}>#{song.songNumber}</Text> : null}
        <Text style={styles.headerTitle}>{song.title}</Text>
        {song.titleTelugu ? <Text style={styles.headerSub}>{song.titleTelugu}</Text> : null}

        <View style={styles.metaRow}>
          {[song.language, song.category, song.key && `Key: ${song.key}`]
            .filter(Boolean).map((m, i) => (
            <View key={i} style={styles.metaBadge}>
              <Text style={styles.metaText}>{m}</Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {song.youtubeUrl && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(song.youtubeUrl)}>
              <Ionicons name="logo-youtube" size={15} color={colors.brandDeep} />
              <Text style={styles.actionBtnText}>YouTube</Text>
            </TouchableOpacity>
          )}
          {song.audioUrl && (
            <TouchableOpacity
              style={[styles.actionBtn, isPlaying && styles.actionBtnActive]}
              onPress={handlePlayAudio}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color={isPlaying ? '#fff' : colors.brandDeep} />
              <Text style={[styles.actionBtnText, isPlaying && { color: '#fff' }]}>
                {isPlaying ? 'Pause' : 'Play Audio'}
              </Text>
            </TouchableOpacity>
          )}
          {song.chords && (
            <TouchableOpacity
              style={[styles.actionBtn, showChords && styles.actionBtnOutline]}
              onPress={() => setShowChords(v => !v)}>
              <Ionicons name="musical-notes" size={15} color={showChords ? '#fff' : colors.brandDeep} />
              <Text style={[styles.actionBtnText, showChords && { color: '#fff' }]}>
                {showChords ? 'Hide Chords' : 'Chords'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Share & Playlist row */}
        <View style={[styles.actionRow, { marginTop: 8 }]}>
          <AddToPlaylistButton songId={song._id} onToast={showToast} />
          <ShareButton songId={song._id} title={song.title} />
        </View>
      </View>

      {/* Language Tabs */}
      {availableTabs.length > 1 && (
        <View style={styles.tabs}>
          {availableTabs.map(t => (
            <TouchableOpacity key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.lyricsScroll}>
        {/* Chords panel */}
        {showChords && song.chords && (
          <View style={styles.chordsBox}>
            <Text style={styles.chordsLabel}>CHORDS</Text>
            <Text style={styles.chordsText}>{song.chords}</Text>
          </View>
        )}

        {/* Lyrics */}
        <Text style={[
          styles.lyrics,
          (tab === 'telugu' || tab === 'hindi') && styles.lyricsLarge,
        ]}>
          {currentLyrics || 'No lyrics available in this language.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: colors.brandDeep,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 20, paddingHorizontal: 20,
  },
  back:        { marginBottom: 0 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  favIconBtn:  { marginBottom: 0 },
  headerNum:   { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28, marginBottom: 4 },
  headerSub:   { fontSize: 15, color: 'rgba(255,255,255,0.65)', marginBottom: 10 },

  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  metaBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brandGold,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  actionBtnActive: { backgroundColor: colors.brandLight },
  actionBtnOutline:{ backgroundColor: colors.brandMid },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: colors.brandDeep },

  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 16, paddingTop: 4,
  },
  tabBtn:        { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', marginRight: 4 },
  tabActive:     { borderBottomColor: colors.brandLight },
  tabText:       { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandLight },

  lyricsScroll: { padding: 24, paddingBottom: 80 },

  chordsBox: {
    backgroundColor: '#1a0533', borderRadius: 12,
    padding: 16, marginBottom: 20,
  },
  chordsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: colors.brandGoldLt, marginBottom: 8 },
  chordsText:  { fontSize: 14, color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 22 },

  lyrics:      { fontSize: 17, lineHeight: 34, color: colors.textPrimary, fontWeight: '400', letterSpacing: 0.1 },
  lyricsLarge: { fontSize: 18, lineHeight: 36 },
});