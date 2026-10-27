import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Subcategory } from '../lib/types';
import { colors, type } from '../theme';

const PALETTE = ['#1F6F5A', '#B45309', '#1D4ED8', '#7C3AED', '#BE185D', '#0F766E', '#92400E', '#4338CA'];

export function subcategoryIcon(sub: Subcategory): { lib: 'ion' | 'mci'; name: string } {
  switch (sub) {
    case 'chinese_chef':
      return { lib: 'mci', name: 'noodles' };
    case 'tandoor_chef':
      return { lib: 'mci', name: 'fire' };
    case 'continental_chef':
      return { lib: 'mci', name: 'silverware-fork-knife' };
    case 'south_indian_chef':
      return { lib: 'mci', name: 'bowl-mix' };
    case 'pastry_chef':
      return { lib: 'mci', name: 'cupcake' };
    case 'kitchen_helper':
      return { lib: 'mci', name: 'hand-heart' };
    case 'waiter':
      return { lib: 'mci', name: 'room-service' };
    case 'deep_cleaner':
      return { lib: 'mci', name: 'spray-bottle' };
    case 'bartender':
      return { lib: 'mci', name: 'glass-cocktail' };
  }
}

export function SubIcon({ sub, size = 18, color = colors.primaryDeep }: { sub: Subcategory | null; size?: number; color?: string }) {
  if (!sub) return <Ionicons name="help" size={size} color={color} />;
  const { name } = subcategoryIcon(sub);
  return <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={color} />;
}

export function Avatar({ seed, sub, size = 48 }: { seed: string; sub: Subcategory; size?: number }) {
  const idx = (seed.charCodeAt(0) + (seed.charCodeAt(1) || 0)) % PALETTE.length;
  const bg = PALETTE[idx];
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={[type.bodyStrong, { color: '#fff', fontSize: size * 0.36 }]}>{seed}</Text>
      </View>
      <View style={styles.badge}>
        <SubIcon sub={sub} size={12} color={colors.ink} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.turmeric,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
});
