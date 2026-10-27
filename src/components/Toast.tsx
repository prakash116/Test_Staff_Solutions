import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookings } from '../state/BookingsContext';
import { colors, radius, space, type } from '../theme';

/** Mock notification banner. Stands in for a push notification. */
export function Toast() {
  const { toast, clearToast } = useBookings();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 3200);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + space.sm }]}
    >
      <View style={styles.toast}>
        <View style={styles.icon}>
          <Ionicons name="notifications" size={16} color={colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: 'rgba(255,255,255,0.7)' }]}>Notification</Text>
          <Text style={[type.smallStrong, { color: '#fff' }]}>{toast.message}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 50 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: space.md,
  },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.turmeric, alignItems: 'center', justifyContent: 'center' },
});
