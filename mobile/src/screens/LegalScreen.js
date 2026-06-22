import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme';

const CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      ['What we collect', 'When you create an account, we collect your name and email address. If you use playlists or favourites, we store which songs you\'ve saved. If you\'re logged in, we keep a short listening history to power recommendations.'],
      ['How we use it', 'Your email is used to verify your account, let you reset your password, and — only if you opt in — notify you when new songs are added. We never sell or share your data with third parties.'],
      ['Your rights', 'You can update your profile, turn off email notifications, or request account deletion at any time by contacting us.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    body: [
      ['Using this app', 'NCC Songs is provided for personal and congregational worship use. Song lyrics and recordings remain the property of their respective rights holders where applicable.'],
      ['Accounts', "You're responsible for keeping your account credentials secure. Please don't share your login with others."],
      ['Acceptable use', "Please don't attempt to disrupt the service, scrape content at scale, or upload content you don't have rights to."],
    ],
  },
  contact: {
    title: 'Contact Us',
    body: [
      ['Get in touch', 'For questions, feedback, or song requests, reach out to the church office at hello@nccsongs.church'],
      ['Location', 'New Covenant Church — Andhra Pradesh, India'],
    ],
  },
};

export default function LegalScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const page = route.params?.page || 'privacy';
  const content = CONTENT[page] || CONTENT.privacy;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDeep} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{content.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {content.body.map(([heading, text], i) => (
          <View key={i} style={{ marginBottom: 18 }}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.bodyText}>{text}</Text>
          </View>
        ))}

        <View style={styles.tabRow}>
          {['privacy', 'terms', 'contact'].map(p => (
            <TouchableOpacity key={p} onPress={() => nav.setParams({ page: p })}>
              <Text style={[styles.tabLink, page === p && styles.tabLinkActive]}>
                {CONTENT[p].title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  heading: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  bodyText: { fontSize: 13.5, color: colors.textSec, lineHeight: 21 },
  tabRow: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  tabLink: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  tabLinkActive: { color: colors.brandLight },
});