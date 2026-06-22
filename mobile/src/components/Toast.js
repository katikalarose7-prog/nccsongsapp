import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

/* Lightweight toast — mirrors react-hot-toast's role on the web app.
   Auto-dismisses after 2.5s. Usage: const [toast, setToast] = useState(null);
   setToast({ message: 'Saved!', type: 'success' }); render <Toast {...toast} onHide={...} /> */
export default function Toast({ message, type = 'success', onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onHide?.());
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[
      styles.toast,
      type === 'error' ? styles.error : styles.success,
      { opacity },
    ]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 54, left: 16, right: 16, zIndex: 999,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { height: 3 },
    elevation: 6,
  },
  success: { backgroundColor: colors.brandMid },
  error:   { backgroundColor: '#dc2626' },
  text:    { color: '#fff', fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
});