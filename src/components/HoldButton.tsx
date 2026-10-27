import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius, type } from '../theme';

interface Props {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  durationMs?: number;
}

/**
 * Press-and-hold confirm. A fill sweeps across while held; letting go early
 * cancels. Deliberately slower than a tap so a confirmation cannot be an
 * accident, and the moving fill draws the eye back to the summary above it.
 */
export function HoldButton({ label, onConfirm, disabled, durationMs = 700 }: Props) {
  const progress = useSharedValue(0);
  const firedRef = useRef(false);

  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm();
  };

  const start = () => {
    if (disabled) return;
    firedRef.current = false;
    Haptics.selectionAsync().catch(() => {});
    progress.value = withTiming(1, { duration: durationMs }, (finished) => {
      if (finished) runOnJS(fire)();
    });
  };

  const stop = () => {
    cancelAnimation(progress);
    if (!firedRef.current) progress.value = withTiming(0, { duration: 160 });
  };

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint="Press and hold to confirm"
      style={[styles.button, disabled && { opacity: 0.45 }]}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
      <View style={styles.content}>
        <Text style={[type.bodyStrong, { color: '#fff' }]}>{label}</Text>
        <Text style={[type.caption, { color: 'rgba(255,255,255,0.75)' }]}>Press and hold</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDeep,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.primary },
  content: { alignItems: 'center', gap: 2 },
});
