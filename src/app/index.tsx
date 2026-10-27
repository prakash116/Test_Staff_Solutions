import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, HeroCloche } from '../components/Illustrations';
import { Button, Card, Muted, SectionTitle, StatusPill } from '../components/ui';
import { EXAMPLES } from '../data/examples';
import { formatDate } from '../lib/dates';
import { llmEnabled, parseRequest } from '../lib/llm';
import { useBookings } from '../state/BookingsContext';
import { colors, radius, space, type } from '../theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, startSession } = useBookings();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = text.trim().length >= 3 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const parse = await parseRequest(text.trim());
      startSession(parse);
      router.push('/review');
    } catch (e) {
      setError('Could not read that request. Check your connection and try again.');
      console.warn(e);
    } finally {
      setBusy(false);
    }
  }

  const recent = bookings.slice(0, 3);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ink }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Dark header: brand + the one question the app asks. */}
        <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
          <View style={styles.heroTop}>
            <BrandMark />
            <Pressable onPress={() => router.push('/requests')} style={styles.heroLink} accessibilityRole="button">
              <Ionicons name="list" size={16} color="#fff" />
              <Text style={[type.smallStrong, { color: '#fff' }]}>My requests</Text>
            </Pressable>
          </View>
          <View style={styles.heroBody}>
            <View style={{ flex: 1 }}>
              <Text style={[type.display, { color: '#fff' }]}>Who do you need, and when?</Text>
              <Text style={[type.body, { color: 'rgba(255,255,255,0.72)', marginTop: space.sm }]}>
                Type it the way you would text us. Hinglish is fine.
              </Text>
            </View>
            <HeroCloche width={110} />
          </View>
        </View>

        {/* Light sheet with the composer. */}
        <View style={styles.sheet}>
          <Animated.View entering={FadeInDown.duration(380).springify().damping(20)}>
            <Card style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  if (error) setError(null);
                }}
                placeholder="Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place"
                placeholderTextColor={colors.muted}
                multiline
                editable={!busy}
                style={styles.input}
                accessibilityLabel="Describe the staff you need"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={submit}
              />
              <View style={styles.composerFooter}>
                <Muted>{llmEnabled ? 'Read by Claude' : 'Read by built-in rules'}</Muted>
                {text.length > 0 ? (
                  <Pressable onPress={() => setText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear">
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          </Animated.View>

          {error ? (
            <View style={styles.error}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={[type.small, { color: colors.danger, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={busy ? 'Reading your request' : 'Understand request'}
            icon={busy ? undefined : 'sparkles'}
            onPress={submit}
            disabled={!canSubmit}
            loading={busy}
            style={{ marginTop: space.lg }}
          />

          <SectionTitle style={{ marginTop: space.xl }}>Try one of these</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
            {EXAMPLES.map((ex, i) => (
              <Pressable
                key={ex}
                onPress={() => setText(ex)}
                style={({ pressed }) => [styles.example, pressed && { backgroundColor: colors.primarySoft }]}
                accessibilityRole="button"
              >
                <Text style={[type.caption, { color: colors.muted }]}>Request {i + 1}</Text>
                <Text style={[type.small, { color: colors.ink }]} numberOfLines={2}>
                  {ex}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.recentHead}>
            <SectionTitle style={{ marginBottom: 0 }}>Recent requests</SectionTitle>
            <Pressable onPress={() => router.push('/requests')} hitSlop={8} accessibilityRole="button">
              <Text style={[type.smallStrong, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Muted>Nothing yet. Your first booking will show up here.</Muted>
          ) : (
            <Card style={{ padding: 0 }}>
              {recent.map((b, i) => (
                <View key={b.id} style={[styles.recentRow, i < recent.length - 1 && styles.recentDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.smallStrong, { color: colors.ink }]} numberOfLines={1}>
                      {b.summary}
                    </Text>
                    <Muted>{b.draft.date.value ? formatDate(b.draft.date.value) : ''}</Muted>
                  </View>
                  <StatusPill status={b.status} />
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ink, paddingHorizontal: space.lg, paddingBottom: space.xxl + space.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  heroBody: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.xl },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -space.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  composer: { padding: space.md },
  input: {
    ...type.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 110,
    textAlignVertical: 'top',
    padding: space.sm,
  },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm, paddingTop: space.xs },
  error: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  example: {
    width: 210,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  recentDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
