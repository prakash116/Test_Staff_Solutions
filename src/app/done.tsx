import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import partnersJson from '../data/partners.json';
import { CheckBadge } from '../components/Illustrations';
import { Button, Card, Muted } from '../components/ui';
import type { Partner } from '../lib/types';
import { useBookings } from '../state/BookingsContext';
import { colors, space, type } from '../theme';

const PARTNERS = partnersJson as Partner[];

export default function DoneScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, session, advance, endSession } = useBookings();
  const booking = bookings[0];
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withDelay(60, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [opacity, scale]);

  const badge = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (!booking) return null;
  const remaining = session ? session.parse.drafts.length - session.index - 1 : 0;
  const names = booking.partnerIds.map((id) => PARTNERS.find((p) => p.id === id)?.name ?? id);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg }]}>
      <Animated.View style={badge}>
        <CheckBadge />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(220).duration(360)} style={{ alignItems: 'center', gap: space.sm }}>
        <Text style={[type.display, { color: colors.ink, textAlign: 'center' }]}>Booked</Text>
        <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center' }]}>{booking.summary}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(360).duration(360)} style={{ alignSelf: 'stretch', gap: space.md }}>
        <Card style={{ gap: space.sm }}>
          <Text style={[type.caption, { color: colors.muted }]}>Coming</Text>
          {names.map((n) => (
            <View key={n} style={styles.row}>
              <Ionicons name="person-circle" size={22} color={colors.primary} />
              <Text style={[type.bodyStrong, { color: colors.ink }]}>{n}</Text>
            </View>
          ))}
          <View style={[styles.row, { marginTop: space.xs }]}>
            <Ionicons name="notifications-outline" size={18} color={colors.muted} />
            <Muted>Partners notified (mock). Real push would go out here.</Muted>
          </View>
        </Card>

        {remaining > 0 ? (
          <Button
            label={`Next: booking ${session!.index + 2} of ${session!.parse.drafts.length}`}
            icon="arrow-forward"
            onPress={() => {
              advance();
              router.replace('/review');
            }}
          />
        ) : (
          <Button
            label="See my requests"
            icon="list"
            onPress={() => {
              endSession();
              router.replace('/requests');
            }}
          />
        )}
        <Button
          label="New request"
          variant="ghost"
          onPress={() => {
            endSession();
            router.replace('/');
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'space-between', padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
