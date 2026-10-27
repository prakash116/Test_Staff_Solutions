import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import partnersJson from '../data/partners.json';
import { EmptySearch } from '../components/Illustrations';
import { HoldButton } from '../components/HoldButton';
import { PartnerCard } from '../components/PartnerCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Muted } from '../components/ui';
import { dateRangeLabel, timeRangeLabel } from '../lib/dates';
import { rankPartners, WEIGHTS } from '../lib/score';
import type { Partner, StaffLine } from '../lib/types';
import { ROLE_LABEL, SUBCATEGORY_LABEL } from '../lib/types';
import { summarize } from '../lib/validate';
import { useBookings } from '../state/BookingsContext';
import { colors, radius, space, type } from '../theme';

const PARTNERS = partnersJson as Partner[];

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const { currentDraft: draft, confirmBooking, notify } = useBookings();
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  // Ranking is synchronous and local, but a real app would fetch it. The short
  // skeleton keeps the loading state honest rather than flashing.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!draft) router.replace('/');
    const t = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(t);
  }, [draft]);

  const results = useMemo(() => (draft ? draft.lines.map((line) => ({ line, ...rankPartners(draft, line, PARTNERS) })) : []), [draft]);
  if (!draft) return null;

  const lineTitle = (line: StaffLine) =>
    `${line.count.value ?? 1} × ${line.subcategory.value ? SUBCATEGORY_LABEL[line.subcategory.value] : `${ROLE_LABEL[line.role.value ?? 'chef']} (any)`}`;

  const toggle = (lineId: string, partnerId: string, max: number) => {
    setPicked((prev) => {
      const cur = prev[lineId] ?? [];
      if (cur.includes(partnerId)) return { ...prev, [lineId]: cur.filter((id) => id !== partnerId) };
      if (cur.length >= max) return prev;
      return { ...prev, [lineId]: [...cur, partnerId] };
    });
  };

  const totalPicked = Object.values(picked).reduce((n, arr) => n + arr.length, 0);
  const everyLineHasOne = results.every((r) => (picked[r.line.id]?.length ?? 0) > 0);
  const anyMatches = results.some((r) => r.ranked.length > 0);
  const totalNeeded = draft.lines.reduce((n, l) => n + (l.count.value ?? 1), 0);

  const confirm = () => {
    const ids = results.flatMap((r) => picked[r.line.id] ?? []);
    const booking = confirmBooking(draft, ids, summarize(draft));
    const names = ids.map((id) => PARTNERS.find((p) => p.id === id)?.name ?? id);
    notify(`${names.join(', ')} notified: ${booking.summary}`);
    router.replace('/done');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="Best matches" subtitle={`${dateRangeLabel(draft)}, ${timeRangeLabel(draft)}, ${draft.location.value ?? 'area not set'}`} />

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 150, gap: space.lg }}>
        <Muted>
          Ranked by skill fit ({Math.round(WEIGHTS.fit * 100)}%), availability ({Math.round(WEIGHTS.availability * 100)}%), distance (
          {Math.round(WEIGHTS.distance * 100)}%) and reliability ({Math.round(WEIGHTS.reliability * 100)}%). The score out of 100 is that weighted sum.
        </Muted>

        {loading ? (
          <Animated.View exiting={FadeOut.duration(150)} style={{ gap: space.md }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton}>
                <View style={styles.skelAvatar} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skelLine, { width: '55%' }]} />
                  <View style={[styles.skelLine, { width: '85%' }]} />
                </View>
              </View>
            ))}
            <Muted style={{ textAlign: 'center' }}>Checking who is free</Muted>
          </Animated.View>
        ) : (
          results.map((r, idx) => {
            const max = r.line.count.value ?? 1;
            const sel = picked[r.line.id] ?? [];
            return (
              <View key={r.line.id} style={{ gap: space.md }}>
                <View style={styles.lineHead}>
                  <Text style={[type.heading, { color: colors.ink }]}>{lineTitle(r.line)}</Text>
                  <Text style={[type.smallStrong, { color: sel.length === max ? colors.primary : colors.muted }]}>
                    {sel.length} of {max} picked
                  </Text>
                </View>

                {r.distanceApproximate ? <Muted>Distances are measured from central Delhi because the area was not recognised.</Muted> : null}

                {r.ranked.length === 0 ? (
                  <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
                    <EmptySearch size={96} />
                    <Text style={[type.bodyStrong, { color: colors.ink, textAlign: 'center' }]}>Nobody matches this slot</Text>
                    <Muted style={{ textAlign: 'center' }}>{explainEmpty(r.excluded, r.line)}</Muted>
                    <Button label="Change date, time or area" variant="secondary" onPress={() => router.back()} style={{ marginTop: space.sm, alignSelf: 'stretch' }} />
                  </Card>
                ) : (
                  r.ranked.map((item, i) => (
                    <Animated.View key={item.partner.id} entering={FadeInDown.delay(idx * 120 + i * 60).duration(320)}>
                      <PartnerCard
                        rank={i + 1}
                        item={item}
                        selected={sel.includes(item.partner.id)}
                        disabled={sel.length >= max}
                        onToggle={() => toggle(r.line.id, item.partner.id, max)}
                      />
                    </Animated.View>
                  ))
                )}
                {r.ranked.length > 0 && r.ranked.length < max ? (
                  <View style={styles.shortfall}>
                    <Ionicons name="alert-circle" size={16} color={colors.warn} />
                    <Text style={[type.small, { color: colors.warn, flex: 1 }]}>
                      Only {r.ranked.length} available for {max} slots. Operations will fill the rest by phone.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {!loading && anyMatches ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Text style={[type.small, { color: colors.muted, textAlign: 'center' }]}>
            {everyLineHasOne
              ? `${summarize(draft)}`
              : `Pick at least one partner for each line (${totalPicked} of ${totalNeeded} chosen)`}
          </Text>
          <HoldButton label={totalPicked > 1 ? `Confirm ${totalPicked} partners` : 'Confirm booking'} onConfirm={confirm} disabled={!everyLineHasOne} />
        </View>
      ) : null}
    </View>
  );
}

function explainEmpty(excluded: Array<{ partner: Partner; reason: string }>, line: StaffLine): string {
  const sameRole = excluded.filter((e) => e.reason !== 'Different role');
  if (sameRole.length === 0) {
    return `We have no ${line.subcategory.value ? SUBCATEGORY_LABEL[line.subcategory.value].toLowerCase() : 'partner of this type'} on the roster yet.`;
  }
  return `${sameRole.length} ${sameRole.length === 1 ? 'partner is' : 'partners are'} busy or blocked then. ${sameRole[0].reason}.`;
}

const styles = StyleSheet.create({
  lineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skeleton: { flexDirection: 'row', gap: space.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, alignItems: 'center' },
  skelAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: colors.border },
  shortfall: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.warnSoft, padding: space.md, borderRadius: radius.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
