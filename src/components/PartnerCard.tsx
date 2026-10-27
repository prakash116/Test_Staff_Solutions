import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RankedPartner } from '../lib/types';
import { SUBCATEGORY_LABEL } from '../lib/types';
import { WEIGHTS } from '../lib/score';
import { colors, radius, shadow, space, type } from '../theme';
import { Avatar } from './Avatar';
import { Press } from './ui';

interface Props {
  rank: number;
  item: RankedPartner;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/** Four tiny bars, one per score component, widths proportional to weight. */
function ScoreBars({ item }: { item: RankedPartner }) {
  const c = item.components;
  const bars: Array<[string, number, number]> = [
    ['Fit', c.fit, WEIGHTS.fit],
    ['Free', c.availability, WEIGHTS.availability],
    ['Near', c.distance, WEIGHTS.distance],
    ['Reliable', c.reliability, WEIGHTS.reliability],
  ];
  return (
    <View style={styles.bars}>
      {bars.map(([label, v, w]) => (
        <View key={label} style={{ flex: w }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(v * 100)}%` }]} />
          </View>
          <Text style={[type.caption, { color: colors.muted, fontSize: 10 }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function PartnerCard({ rank, item, selected, onToggle, disabled }: Props) {
  const p = item.partner;
  return (
    <Press
      onPress={onToggle}
      disabled={disabled && !selected}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.card, selected && styles.cardSelected, disabled && !selected && { opacity: 0.55 }]}
    >
      <View style={styles.top}>
        <View style={styles.rank}>
          <Text style={[type.smallStrong, { color: rank === 1 ? colors.ink : colors.muted }]}>{rank}</Text>
        </View>
        <Avatar seed={p.avatarSeed} sub={p.subcategory} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: colors.ink }]}>{p.name}</Text>
          <Text style={[type.small, { color: colors.muted }]}>
            {SUBCATEGORY_LABEL[p.subcategory]} from {p.area}
          </Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={[type.smallStrong, { color: colors.primaryDeep }]}>{Math.round(item.total * 100)}</Text>
        </View>
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
      </View>

      <Text style={[type.small, { color: colors.inkSoft, marginTop: space.md }]}>{item.explanation}</Text>

      <ScoreBars item={item} />

      <View style={styles.meta}>
        <Text style={[type.caption, { color: colors.muted }]}>₹{p.dayRate}/day</Text>
        <Text style={[type.caption, { color: colors.muted }]}>{p.completedJobs} jobs done</Text>
        {item.components.overBudget ? <Text style={[type.caption, { color: colors.danger }]}>Over budget</Text> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow.card,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: '#F4FAF7' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { width: 22, alignItems: 'center' },
  scorePill: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  bars: { flexDirection: 'row', gap: 6, marginTop: space.md },
  track: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 3 },
  fill: { height: 5, backgroundColor: colors.primary, borderRadius: 3 },
  meta: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
});
