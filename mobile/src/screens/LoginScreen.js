import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from '../components/Toast';
import { userLogin, userRegister, userForgotPassword } from '../api';
import { useUserAuth } from '../context/UserAuthContext';
import { colors } from '../theme';

export default function LoginScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const { loginUser } = useUserAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await userForgotPassword(form.email);
        showToast('If that email is registered, a reset link has been sent.');
        setMode('login');
        return;
      }
      const res = mode === 'login'
        ? await userLogin({ email: form.email, password: form.password })
        : await userRegister(form);
      await loginUser(res.token, res.user);
      showToast(mode === 'login' ? `Welcome back, ${res.user.name}!` : `Welcome, ${res.user.name}!`);
      const redirectTo = route.params?.redirectTo || 'Home';
      nav.reset({ index: 0, routes: [{ name: redirectTo }] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDeep} />
      <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
        {toast && <Toast {...toast} onHide={() => setToast(null)} />}

        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSec} />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.logoIcon}><Text style={{ fontSize: 24 }}>✝</Text></View>
          <Text style={styles.title}>
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to access your playlists & favourites'
              : mode === 'register' ? 'Save favourites, build playlists, get notified of new songs'
              : "We'll email you a reset link"}
          </Text>

          {mode === 'register' && (
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Your name" value={form.name} onChangeText={set('name')} />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address"
              value={form.email} onChangeText={set('email')} />
          </View>

          {mode !== 'forgot' && (
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="••••••••" secureTextEntry
                value={form.password} onChangeText={set('password')} />
            </View>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitBtnText}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            {mode === 'login' && (
              <>
                <TouchableOpacity onPress={() => setMode('forgot')}>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Text style={styles.muted}>New here? </Text>
                  <TouchableOpacity onPress={() => setMode('register')}>
                    <Text style={styles.link}>Create an account</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {mode === 'register' && (
              <View style={{ flexDirection: 'row' }}>
                <Text style={styles.muted}>Already have an account? </Text>
                <TouchableOpacity onPress={() => setMode('login')}>
                  <Text style={styles.link}>Sign in</Text>
                </TouchableOpacity>
              </View>
            )}
            {mode === 'forgot' && (
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.link}>← Back to sign in</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brandDeep },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  backBtn: { position: 'absolute', top: 52, left: 20, zIndex: 10, backgroundColor: '#fff', borderRadius: 20, padding: 8 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, marginTop: 60 },
  logoIcon: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brandGold,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14,
  },
  title: { fontSize: 21, fontWeight: '800', color: colors.brandDeep, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 12, backgroundColor: colors.surface1,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },
  submitBtn: { backgroundColor: colors.brandLight, borderRadius: 10, paddingVertical: 14, marginTop: 6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  footerLinks: { alignItems: 'center', marginTop: 18 },
  link: { color: colors.brandLight, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 13 },
});