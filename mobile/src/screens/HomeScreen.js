import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorageLib from '@react-native-async-storage/async-storage';
import { fetchSongs, toggleFavourite, fetchFavourites } from '../api';
import { useUserAuth } from '../context/UserAuthContext';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { colors } from '../theme';

const LANGUAGES  = ['All','English','Telugu','Hindi','Multilingual'];
const CATEGORIES = ['All','Worship','Praise','Christmas','Resurrection','Communion','Wedding','Death','Thanksgiving','Other'];

// Guest favourites (not logged in) persist locally so the feature still
// works without forcing an account — mirrors the web app's behaviour.
const GUEST_FAV_KEY = 'ncc_guest_favourites';

function useDebounce(v, d) {
  const [dv, setDv] = useState(v);
  useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

// ── Ad Banner ─────────────────────────────────────────────────────
function AdBanner() {
  return (
    <TouchableOpacity
      style={styles.adBanner}
      onPress={() => Linking.openURL('https://yourdonationlink.com')}
      activeOpacity={0.85}
    >
      <View style={styles.adInner}>
        <View>
          <Text style={styles.adLabel}>SPONSORED</Text>
          <Text style={styles.adTitle}>🙏 Support NCC Songs</Text>
          <Text style={styles.adSub}>Keep this app free for all churches</Text>
        </View>
        <View style={styles.adBtn}><Text style={styles.adBtnText}>Donate ❤️</Text></View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const nav = useNavigation();
  const { user } = useUserAuth();
  const [q, setQ]           = useState('');
  const [lang, setLang]     = useState('All');
  const [cat, setCat]       = useState('All');
  const [songs, setSongs]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [favs, setFavs]     = useState([]);
  const [showFavs, setShowFavs] = useState(false);
  const dq = useDebounce(q, 400);

  // Favourites source: server (synced to account) when logged in, else local guest storage
  useEffect(() => {
    if (user) {
      fetchFavourites().then(r => setFavs(r.songs.map(s => s._id))).catch(() => {});
    } else {
      AsyncStorageLib.getItem(GUEST_FAV_KEY).then(v => setFavs(v ? JSON.parse(v) : []));
    }
  }, [user]);

  const toggleFav = async (id) => {
    if (user) {
      setFavs(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]); // optimistic
      try {
        const res = await toggleFavourite(id);
        setFavs(res.favourites);
      } catch {
        setFavs(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]); // revert
      }
    } else {
      const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
      setFavs(next);
      await AsyncStorageLib.setItem(GUEST_FAV_KEY, JSON.stringify(next));
    }
  };

  const loadingRef = useRef(false); // synchronous in-flight guard — see note below

  const load = useCallback(async (reset = false) => {
    // Use a ref instead of the `loading` state to guard against
    // double-fires: FlatList's onEndReached can call this twice in quick
    // succession before a state update re-renders, since `loading` (state)
    // is only updated asynchronously. A ref updates immediately, so the
    // second call is reliably blocked instead of racing through and
    // fetching + appending the same page of songs twice (which was
    // producing duplicate _id keys in the list).
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = { page: reset ? 1 : page, limit: 20 };
      if (dq) params.q = dq;
      if (lang !== 'All') params.language = lang.toLowerCase();
      if (cat  !== 'All') params.category  = cat.toLowerCase();
      const res = await fetchSongs(params);
      if (reset) {
        setSongs(res.songs);
        setPage(2);
      } else {
        // De-duplicate as a safety net in case of any other edge case
        // (e.g. a song being re-sorted between page fetches).
        setSongs(prev => {
          const seen = new Set(prev.map(s => s._id));
          const fresh = res.songs.filter(s => !seen.has(s._id));
          return [...prev, ...fresh];
        });
        setPage(p => p + 1);
      }
      setTotal(res.total);
      setHasMore(res.songs.length === 20);
    } catch (e) { console.error(e); }
    finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [dq, lang, cat, page]);

  useEffect(() => { load(true); }, [dq, lang, cat]);

  const handleVoiceResult = (transcript) => {
    setQ(transcript);
    setShowFavs(false);
  };

  const renderSong = ({ item, index }) => (
    <>
      {index > 0 && index % 10 === 0 && <AdBanner />}
      <TouchableOpacity
        style={[styles.card, favs.includes(item._id) && styles.cardFav]}
        onPress={() => nav.navigate('SongDetail', { id: item._id })}
        activeOpacity={0.75}
      >
        <View style={styles.cardRow}>
          {item.songNumber ? <Text style={styles.cardNum}>#{item.songNumber}</Text> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {item.titleTelugu ? <Text style={styles.cardSub} numberOfLines={1}>{item.titleTelugu}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => toggleFav(item._id)} style={styles.favBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={favs.includes(item._id) ? 'heart' : 'heart-outline'}
              size={18}
              color={favs.includes(item._id) ? '#ef4444' : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.badges}>
          <View style={[styles.badge, styles.badgeLang]}><Text style={styles.badgeText}>{item.language}</Text></View>
          <View style={[styles.badge, styles.badgeCat]}><Text style={[styles.badgeText, { color: '#92400e' }]}>{item.category}</Text></View>
          {item.key      ? <View style={[styles.badge, styles.badgeLang]}><Text style={styles.badgeText}>♩ {item.key}</Text></View> : null}
          {item.audioUrl ? <View style={[styles.badge, styles.badgeLang]}><Text style={styles.badgeText}>🎵</Text></View> : null}
        </View>
        {item.lyrics ? <Text style={styles.preview} numberOfLines={2}>{item.lyrics}</Text> : null}
      </TouchableOpacity>
    </>
  );

  const favSongsList = songs.filter(s => favs.includes(s._id));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDeep} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}><Text style={{ fontSize: 22 }}>✝</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logoName}>New Covenant Church</Text>
            <Text style={styles.logoSub}>SONGS COLLECTION</Text>
          </View>

          {/* Account / Sign in */}
          <TouchableOpacity
            style={styles.accountBtn}
            onPress={() => nav.navigate(user ? 'Account' : 'Login')}
          >
            {user
              ? <View style={styles.avatarSmall}><Text style={styles.avatarSmallText}>{user.name.charAt(0).toUpperCase()}</Text></View>
              : <Ionicons name="log-in-outline" size={18} color={colors.brandGold} />}
          </TouchableOpacity>

          {/* Favourites toggle */}
          <TouchableOpacity style={[styles.favToggle, showFavs && styles.favToggleActive]} onPress={() => setShowFavs(v => !v)}>
            <Ionicons name={showFavs ? 'heart' : 'heart-outline'} size={18} color={showFavs ? '#fff' : colors.brandGold} />
            {favs.length > 0 && (
              <View style={styles.favBadge}><Text style={styles.favBadgeText}>{favs.length}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search title, lyrics, category…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={q} onChangeText={setQ}
          />
          {q ? <TouchableOpacity onPress={() => setQ('')} style={{ padding: 4 }}>
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity> : null}
          <VoiceSearchButton onResult={handleVoiceResult} />
        </View>

        {!user && (
          <TouchableOpacity onPress={() => nav.navigate('Login')} style={{ marginTop: 10 }}>
            <Text style={styles.signInHint}>Sign in to sync favourites & build playlists →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Favourites panel */}
      {showFavs ? (
        <View style={{ flex: 1 }}>
          <View style={styles.favHeader}>
            <Ionicons name="heart" size={18} color="#ef4444" />
            <Text style={styles.favHeaderText}>My Favourites ({favs.length})</Text>
          </View>
          <AdBanner />
          {favs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>♥</Text>
              <Text style={styles.emptyTitle}>No favourites yet</Text>
              <Text style={styles.emptyText}>Tap ♥ on any song to save it here</Text>
            </View>
          ) : (
            <FlatList
              data={favSongsList}
              keyExtractor={i => i._id}
              renderItem={renderSong}
              contentContainerStyle={{ padding: 18, paddingBottom: 80 }}
            />
          )}
        </View>
      ) : (
        <>
          {/* Dropdowns */}
          <View style={styles.filterRow}>
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Language</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={lang} onValueChange={v => setLang(v)}
                  style={styles.picker} itemStyle={styles.pickerItem}
                  dropdownIconColor={colors.brandLight} mode="dropdown">
                  {LANGUAGES.map(l => <Picker.Item key={l} label={l} value={l} />)}
                </Picker>
              </View>
            </View>
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Category</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={cat} onValueChange={v => setCat(v)}
                  style={styles.picker} itemStyle={styles.pickerItem}
                  dropdownIconColor={colors.brandLight} mode="dropdown">
                  {CATEGORIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
                </Picker>
              </View>
            </View>
          </View>

          {total > 0 && <Text style={styles.count}>{total} songs found</Text>}

          <FlatList
            data={songs}
            keyExtractor={i => i._id}
            renderItem={renderSong}
            contentContainerStyle={{ padding: 18, paddingBottom: 80 }}
            onEndReached={() => hasMore && !loading && load()}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={<AdBanner />}
            ListFooterComponent={
              loading ? <ActivityIndicator color={colors.brandLight} style={{ margin: 20 }} />
                : <Text style={styles.footerLinks} onPress={() => nav.navigate('Legal', { page: 'privacy' })}>Privacy Policy · Terms · Contact</Text>
            }
            ListEmptyComponent={!loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🎵</Text>
                <Text style={styles.emptyTitle}>No songs found</Text>
                <Text style={styles.emptyText}>Try different keywords or filters</Text>
              </View>
            ) : null}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface1 },

  header: {
    backgroundColor: colors.brandDeep,
    paddingTop: Platform.OS === 'ios' ? 54 : 42,
    paddingBottom: 18, paddingHorizontal: 18,
  },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logoIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brandGold, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoName: { color: '#fff', fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  logoSub:  { color: colors.brandGoldLt, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },

  accountBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  favToggle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  favToggleActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  favBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.brandGold, borderRadius: 10,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  favBadgeText: { fontSize: 10, fontWeight: '700', color: colors.brandDeep },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },
  signInHint: { color: colors.brandGoldLt, fontSize: 12.5, fontWeight: '600' },

  favHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    padding: 18, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  favHeaderText: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  filterRow: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerWrap:  { flex: 1, minWidth: 0 },
  pickerLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  pickerBox: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface1,
    justifyContent: 'center',
    // Explicit height prevents the box from collapsing too small on
    // devices with larger system font sizes (accessibility settings).
    minHeight: 52,
    height: 52,
  },
  picker: {
    // Picker itself must match the box height exactly or it either
    // gets clipped at the bottom (too short) or overflows (too tall).
    height: 52,
    color: colors.textPrimary,
    // marginHorizontal is more reliably respected than paddingHorizontal
    // across Android OEM skins for the Picker component specifically.
    marginHorizontal: 4,
  },
  pickerItem: {
    fontSize: 14,
    color: colors.textPrimary,
  },

  count: { fontSize: 12.5, color: colors.textMuted, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  footerLinks: { fontSize: 12, color: colors.textMuted, textAlign: 'center', padding: 20, textDecorationLine: 'underline' },

  adBanner: {
    backgroundColor: '#fef3c7', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#f59e0b',
    marginBottom: 12, overflow: 'hidden',
  },
  adInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
  adLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', letterSpacing: 1.5, marginBottom: 2 },
  adTitle: { fontSize: 14, fontWeight: '700', color: '#78350f' },
  adSub:   { fontSize: 11, color: '#92400e' },
  adBtn:   { backgroundColor: '#f59e0b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  adBtnText:{ fontSize: 12, fontWeight: '700', color: '#78350f' },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    padding: 18, marginBottom: 12,
    shadowColor: colors.brandMid, shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { height: 2 },
    elevation: 2,
  },
  cardFav: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardNum:  { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 3, marginBottom: 2 },
  cardTitle:{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, lineHeight: 23, flexShrink: 1 },
  cardSub:  { fontSize: 12.5, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  favBtn:   { padding: 6 },

  badges: { flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap' },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeLang: { backgroundColor: colors.surface2 },
  badgeCat:  { backgroundColor: colors.brandGoldLt },
  badgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.brandMid },

  preview: { fontSize: 13, color: colors.textMuted, marginTop: 10, lineHeight: 19 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon:  { fontSize: 52, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textSec, marginBottom: 4 },
  emptyText:  { fontSize: 14, color: colors.textMuted },
});