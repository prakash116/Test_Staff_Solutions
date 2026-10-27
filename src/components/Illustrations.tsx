import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/** Brand mark: a chef's toque drawn as three soft arcs, with a turmeric spark. */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect x="2" y="2" width="44" height="44" rx="14" fill={colors.primary} />
      <Path
        d="M15 30v-5.5a6.5 6.5 0 0 1 2.3-12.5 7.5 7.5 0 0 1 13.4 0A6.5 6.5 0 0 1 33 24.5V30"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M15 30h18M16.5 35h15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <Circle cx="37" cy="12" r="3.2" fill={colors.turmeric} />
    </Svg>
  );
}

/** Line drawing used in the home header: a serving cloche with steam. */
export function HeroCloche({ width = 150 }: { width?: number }) {
  const h = width * 0.78;
  return (
    <Svg width={width} height={h} viewBox="0 0 150 117" fill="none">
      <Path d="M22 92h106" stroke={colors.turmeric} strokeWidth="4" strokeLinecap="round" />
      <Path
        d="M30 90c0-26 20-47 45-47s45 21 45 47"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="rgba(255,255,255,0.06)"
      />
      <Circle cx="75" cy="39" r="4.5" fill={colors.turmeric} />
      <Path d="M56 26c-4-7 4-10 0-17M75 22c-4-7 4-10 0-17M94 26c-4-7 4-10 0-17" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />
      <Path d="M52 92v8a6 6 0 0 0 6 6h34a6 6 0 0 0 6-6v-8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

/** Success check drawn as a ring with a tick; the parent animates it in. */
export function CheckBadge({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle cx="48" cy="48" r="44" fill={colors.primarySoft} />
      <Circle cx="48" cy="48" r="34" fill={colors.primary} />
      <Path d="M32 49l11 11 21-24" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Empty state: an outline of a clipboard with a magnifier. */
export function EmptySearch({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Rect x="24" y="18" width="60" height="78" rx="10" stroke={colors.borderStrong} strokeWidth="3" />
      <Rect x="44" y="12" width="20" height="12" rx="4" fill={colors.turmeric} />
      <Path d="M36 44h36M36 58h24M36 72h18" stroke={colors.borderStrong} strokeWidth="3" strokeLinecap="round" />
      <Circle cx="84" cy="80" r="14" stroke={colors.primary} strokeWidth="3.5" fill={colors.card} />
      <Path d="M94 90l12 12" stroke={colors.primary} strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  );
}
