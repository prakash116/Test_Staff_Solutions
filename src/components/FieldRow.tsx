import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import type { Confidence } from '../lib/types';
import { colors, radius, space, type } from '../theme';
import { Press } from './ui';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  confidence: Confidence;
  reason?: string;
  onPress: () => void;
  /** Rendered instead of the icon (e.g. a subcategory glyph). */
  leading?: React.ReactNode;
}

/**
 * One understood field. Three visual states, by confidence:
 *  - high: quiet row, tap to edit.
 *  - medium: small amber dot + reason; tap to change, nothing blocks.
 *  - low / missing: amber card with the question; must be set or confirmed.
 */
export function FieldRow({ icon, label, value, confidence, reason, onPress, leading }: Props) {
  const needsAction = confidence === 'low' || confidence === 'missing';
  const isMedium = confidence === 'medium';
  return (
    <Animated.View layout={LinearTransition.springify().damping(18)}>
      <Press
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. ${needsAction ? 'Needs your answer.' : 'Tap to change.'}`}
        style={[styles.row, needsAction && styles.rowWarn]}
      >
        <View style={[styles.iconWrap, needsAction && { backgroundColor: colors.warnSoft }]}>
          {leading ?? <Ionicons name={icon} size={18} color={needsAction ? colors.warn : colors.primaryDeep} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.labelLine}>
            <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
            {isMedium ? <View style={styles.dot} /> : null}
          </View>
          <Text style={[type.bodyStrong, { color: confidence === 'missing' ? colors.warn : colors.ink }]} numberOfLines={2}>
            {value}
          </Text>
          {reason && confidence !== 'high' ? (
            <Text style={[type.small, { color: needsAction ? colors.warn : colors.muted }]}>{reason}</Text>
          ) : null}
        </View>
        <View style={styles.trailing}>
          {needsAction ? (
            <View style={styles.fixTag}>
              <Text style={[type.caption, { color: '#fff' }]}>{confidence === 'missing' ? 'Set' : 'Check'}</Text>
            </View>
          ) : (
            <Ionicons name="pencil" size={16} color={colors.muted} />
          )}
        </View>
      </Press>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowWarn: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: colors.warnBorder,
    paddingLeft: space.lg - 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warnBorder },
  trailing: { minWidth: 28, alignItems: 'flex-end' },
  fixTag: { backgroundColor: colors.warn, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
