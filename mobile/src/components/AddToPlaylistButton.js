import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchPlaylists, addSongToPlaylist, createPlaylist } from '../api';
import { useUserAuth } from '../context/UserAuthContext';
import { colors } from '../theme';

export default function AddToPlaylistButton({ songId, style, onToast }) {
  const { user } = useUserAuth();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      fetchPlaylists().then(r => setPlaylists(r.playlists)).catch(() => {}).finally(() => setLoading(false));
    }
  }, [open, user]);

  if (!user) return null; // playlists require an account

  const handleAdd = async (playlistId, name) => {
    setAdding(playlistId);
    try {
      await addSongToPlaylist(playlistId, songId);
      onToast?.(`Added to "${name}"`);
      setOpen(false);
    } catch (err) {
      onToast?.(err.response?.data?.message || 'Could not add to playlist', 'error');
    } finally {
      setAdding(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createPlaylist({ name: newName.trim() });
      await addSongToPlaylist(res.playlist._id, songId);
      onToast?.(`Created "${newName.trim()}" and added song`);
      setNewName('');
      setOpen(false);
    } catch (err) {
      onToast?.(err.response?.data?.message || 'Could not create playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={[styles.triggerBtn, style]} onPress={() => setOpen(true)}>
        <Ionicons name="list-outline" size={14} color={colors.brandDeep} />
        <Text style={styles.triggerBtnText}>Add to Playlist</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to Playlist</Text>

            {loading ? (
              <ActivityIndicator color={colors.brandLight} style={{ marginVertical: 30 }} />
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={p => p._id}
                style={{ maxHeight: 220 }}
                ListEmptyComponent={<Text style={styles.emptyText}>No playlists yet — create one below</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.playlistRow} onPress={() => handleAdd(item._id, item.name)} disabled={adding === item._id}>
                    <Text style={styles.playlistRowText}>{item.name}</Text>
                    {adding === item._id
                      ? <ActivityIndicator size="small" color={colors.brandLight} />
                      : <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />}
                  </TouchableOpacity>
                )}
              />
            )}

            <View style={styles.createRow}>
              <TextInput
                style={styles.createInput}
                placeholder="New playlist name"
                value={newName}
                onChangeText={setNewName}
              />
              <TouchableOpacity style={styles.createBtn} onPress={handleCreateAndAdd} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  triggerBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.brandDeep },

  overlay: { flex: 1, backgroundColor: 'rgba(10,0,25,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },

  playlistRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.surface1,
  },
  playlistRowText: { fontSize: 14.5, color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },

  createRow: { flexDirection: 'row', gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.surface1, paddingTop: 14 },
  createInput: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  createBtn: { backgroundColor: colors.brandLight, borderRadius: 10, width: 42, alignItems: 'center', justifyContent: 'center' },
});