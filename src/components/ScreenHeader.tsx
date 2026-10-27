import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  dark?: boolean;
}

export function ScreenHeader({ title, subtitle, right, onBack, dark }: Props) {
  const insets = useSafeAreaInsets();
  const fg = dark ? '#fff' : colors.ink;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm, backgroundColor: dark ? colors.ink : colors.paper }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.back, dark && { backgroundColor: 'rgba(255,255,255,0.12)' }]}
        >
          <Ionicons name="chevron-back" size={22} color={fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: fg }]}>{title}</Text>
          {subtitle ? <Text style={[type.small, { color: dark ? 'rgba(255,255,255,0.7)' : colors.muted }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
