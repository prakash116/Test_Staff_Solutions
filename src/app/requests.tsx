import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import partnersJson from '../data/partners.json';
import { EmptySearch } from '../components/Illustrations';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, Chip, Muted, StatusPill } from '../components/ui';
import { dateRangeLabel, timeRangeLabel } from '../lib/dates';
import type { Booking, BookingStatus, Partner } from '../lib/types';
import { useBookings } from '../state/BookingsContext';
import { colors, space, type } from '../theme';

const PARTNERS = partnersJson as Partner[];
type Filter = 'all' | BookingStatus;

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, cancelBooking, notify } = useBookings();
  const [filter, setFilter] = useState<Filter>('all');

  const data = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const askCancel = (b: Booking) => {
    Alert.alert('Cancel this request?', b.summary, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () => {
          cancelBooking(b.id);
          notify(`Cancelled: ${b.summary}`);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="My requests" subtitle={`${bookings.filter((b) => b.status === 'confirmed').length} confirmed`} />
      <View style={styles.filters}>
        {(['all', 'confirmed', 'cancelled'] as Filter[]).map((f) => (
          <Chip key={f} label={f === 'all' ? 'All' : f === 'confirmed' ? 'Confirmed' : 'Cancelled'} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.md }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: space.xxl, gap: space.md }}>
            <EmptySearch />
            <Text style={[type.bodyStrong, { color: colors.ink }]}>No requests here</Text>
            <Muted>Confirmed bookings will show up in this list.</Muted>
          </View>
        }
        renderItem={({ item }) => {
          const names = item.partnerIds.map((id) => PARTNERS.find((p) => p.id === id)?.name ?? id);
          return (
            <Animated.View layout={LinearTransition.springify().damping(18)}>
              <Card style={{ gap: space.sm, opacity: item.status === 'cancelled' ? 0.7 : 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{item.summary}</Text>
                  <StatusPill status={item.status} />
                </View>
                <View style={styles.meta}>
                  <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                  <Muted>
                    {dateRangeLabel(item.draft)}, {timeRangeLabel(item.draft)}
                  </Muted>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="people-outline" size={14} color={colors.muted} />
                  <Muted>{names.length ? names.join(', ') : 'No partner assigned'}</Muted>
                </View>
                {item.status === 'confirmed' ? (
                  <Pressable onPress={() => askCancel(item)} hitSlop={8} style={styles.cancel} accessibilityRole="button">
                    <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                    <Text style={[type.smallStrong, { color: colors.danger }]}>Cancel request</Text>
                  </Pressable>
                ) : null}
              </Card>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space.xs },
});
