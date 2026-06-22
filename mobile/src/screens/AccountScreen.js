import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  StyleSheet, StatusBar, Switch, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from '../components/Toast';
import {
  updateUserProfile, fetchRecentlyPlayed, fetchRecommended,
  fetchPlaylists, createPlaylist, deletePlaylist,
} from '../api';
import { useUserAuth } from '../context/UserAuthContext';
import { colors } from '../theme';

const TABS = [
  { key: 'playlists',   label: 'Playlists',  icon: 'folder-open-outline' },
  { key: 'recent',      label: 'Recent',     icon: 'time-outline' },
  { key: 'recommended', label: 'For You',    icon: 'sparkles-outline' },
  { key: 'profile',     label: 'Profile',    icon: 'person-outline' },
];

const LANGUAGES = [
  { value: '', label: 'No preference' },
  { value: 'english', label: 'English' },
  { value: 'telugu', label: 'Telugu' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'multilingual', label: 'Multilingual' },
];

export default function AccountScreen() {
  const nav = useNavigation();
  const { user, logoutUser, refreshUser } = useUserAuth();
  const [tab, setTab] = useState(useRoute().params?.tab || 'playlists');
  const [toast, setToast] = useState(null);

  const [recent, setRecent] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    emailNotifications: user?.emailNotifications ?? true,
    preferredLanguage: user?.preferredLanguage || '',
  });

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    if (!user) nav.replace('Login');
  }, [user, nav]);

  const loadPlaylists = useCallback(() => {
    fetchPlaylists().then(r => setPlaylists(r.playlists)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'recent') fetchRecentlyPlayed().then(r => setRecent(r.songs)).catch(() => {});
    if (tab === 'recommended') fetchRecommended().then(r => setRecommended(r.songs)).catch(() => {});
    if (tab === 'playlists') loadPlaylists();
  }, [tab, loadPlaylists]);

  const handleProfileSave = async () => {
    try {
      await updateUserProfile(profileForm);
      await refreshUser();
      showToast('Profile updated');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save changes', 'error');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    try {
      await createPlaylist({ name: newPlaylistName.trim() });
      setNewPlaylistName('');
      showToast('Playlist created');
      loadPlaylists();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not create playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = (id, name) => {
    Alert.alert('Delete playlist', `Delete "${name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deletePlaylist(id);
          showToast('Playlist deleted');
          loadPlaylists();
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDeep} />
      {toast && <Toast {...toast} onHide={() => setToast(null)} />}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          {!user.emailVerified && <Text style={styles.unverified}>⚠ Email not verified</Text>}
        </View>
        <TouchableOpacity onPress={() => { logoutUser(); nav.replace('Home'); }}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon} size={14} color={tab === t.key ? colors.brandMid : colors.textMuted} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'playlists' && (
        <View style={{ flex: 1 }}>
          <View style={styles.createRow}>
            <TextInput style={styles.createInput} placeholder="e.g. Sunday Song List"
              value={newPlaylistName} onChangeText={setNewPlaylistName} />
            <TouchableOpacity style={styles.createBtn} onPress={handleCreatePlaylist} disabled={creating}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={playlists}
            keyExtractor={p => p._id}
            contentContainerStyle={{ padding: 16, paddingTop: 4 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="folder-open-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No playlists yet</Text>
                <Text style={styles.emptyText}>Create a folder like "Sunday Song List"</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.playlistCard} onPress={() => nav.navigate('PlaylistDetail', { id: item._id, name: item.name })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playlistName}>{item.name}</Text>
                  <Text style={styles.playlistCount}>{item.songCount} song{item.songCount !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeletePlaylist(item._id, item.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {tab === 'recent' && (
        <FlatList
          data={recent}
          keyExtractor={s => s._id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No listening history yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.songRow} onPress={() => nav.navigate('SongDetail', { id: item._id })}>
              <Text style={styles.songRowTitle}>{item.title}</Text>
              <Text style={styles.songRowMeta}>{item.language} · {item.category}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {tab === 'recommended' && (
        <FlatList
          data={recommended}
          keyExtractor={s => s._id}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={<Text style={styles.hint}>Based on what you've been listening to</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Listen to a few songs first</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.songRow} onPress={() => nav.navigate('SongDetail', { id: item._id })}>
              <Text style={styles.songRowTitle}>{item.title}</Text>
              <Text style={styles.songRowMeta}>{item.language} · {item.category}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {tab === 'profile' && (
        <View style={styles.profileForm}>
          <Text style={styles.formLabel}>Name</Text>
          <TextInput style={styles.formInput} value={profileForm.name}
            onChangeText={v => setProfileForm(f => ({ ...f, name: v }))} />

          <Text style={styles.formLabel}>Preferred Language</Text>
          <View style={styles.pickerBox}>
            <Picker selectedValue={profileForm.preferredLanguage}
              style={{ height: 48, paddingHorizontal: 10, color: colors.textPrimary }}
              onValueChange={v => setProfileForm(f => ({ ...f, preferredLanguage: v }))}>
              {LANGUAGES.map(l => <Picker.Item key={l.value} label={l.label} value={l.value} />)}
            </Picker>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.formLabel}>Email me about new songs</Text>
            <Switch
              value={profileForm.emailNotifications}
              onValueChange={v => setProfileForm(f => ({ ...f, emailNotifications: v }))}
              trackColor={{ true: colors.brandLight }}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleProfileSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface1 },
  header: {
    backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 40, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { padding: 2 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', margin: 16, marginBottom: 8, padding: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  profileEmail: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  unverified: { fontSize: 11, color: '#d97706', marginTop: 2 },

  tabBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 6 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 11, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff',
  },
  tabBtnActive: { borderColor: colors.brandLight, backgroundColor: colors.surface2 },
  tabText: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandMid },

  createRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  createInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  createBtn: { backgroundColor: colors.brandLight, borderRadius: 10, width: 42, alignItems: 'center', justifyContent: 'center' },

  playlistCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  playlistName: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  playlistCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  songRow: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    padding: 14, marginBottom: 8,
  },
  songRowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  songRowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  hint: { fontSize: 12.5, color: colors.textMuted, marginBottom: 10 },

  empty: { alignItems: 'center', paddingTop: 50 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textSec, marginTop: 10 },
  emptyText: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },

  profileForm: { padding: 16 },
  formLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textSec, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  pickerBox: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, justifyContent: 'center', minHeight: 48 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  saveBtn: { backgroundColor: colors.brandLight, borderRadius: 10, paddingVertical: 14, marginTop: 26 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});