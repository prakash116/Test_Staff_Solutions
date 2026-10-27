import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, shadow, space, type } from '../theme';
import type { BookingStatus } from '../lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---- Pressable with a gentle press scale -------------------------------------

interface PressProps {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'radio';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
}

export function Press({ onPress, disabled, style, children, ...a11y }: PressProps) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 300 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 300 }))}
      style={[anim, style]}
      {...a11y}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---- Button -----------------------------------------------------------------

interface ButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, disabled, loading, variant = 'primary', icon, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.primarySoft : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.primaryDeep;
  return (
    <Press
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[styles.button, { backgroundColor: bg, opacity: isDisabled ? 0.45 : 1 }, variant === 'ghost' && styles.ghost, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[type.bodyStrong, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Press>
  );
}

// ---- Chip -------------------------------------------------------------------

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'suggest';
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, tone = 'default', style }: ChipProps) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        tone === 'suggest' && !selected && styles.chipSuggest,
        selected && styles.chipSelected,
        style,
      ]}
    >
      <Text style={[type.smallStrong, { color: selected ? '#fff' : colors.ink }]}>{label}</Text>
    </Press>
  );
}

// ---- Card -------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---- Status pill --------------------------------------------------------------

export function StatusPill({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, { bg: string; fg: string; label: string }> = {
    confirmed: { bg: colors.primarySoft, fg: colors.primaryDeep, label: 'Confirmed' },
    cancelled: { bg: colors.dangerSoft, fg: colors.danger, label: 'Cancelled' },
    pending: { bg: colors.warnSoft, fg: colors.warn, label: 'Pending' },
  };
  const m = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <Text style={[type.caption, { color: m.fg }]}>{m.label}</Text>
    </View>
  );
}

// ---- Section label ------------------------------------------------------------

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.heading, { color: colors.ink, marginBottom: space.sm }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.small, { color: colors.muted }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ghost: { borderWidth: 1, borderColor: colors.borderStrong },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSuggest: { borderColor: colors.warnBorder, backgroundColor: colors.warnSoft },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
