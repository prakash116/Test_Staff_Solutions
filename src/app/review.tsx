import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import areasJson from '../data/areas.json';
import { SubIcon } from '../components/Avatar';
import { FieldRow } from '../components/FieldRow';
import { ChipWrap, OptionSheet, SheetLabel } from '../components/OptionSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Chip, Muted } from '../components/ui';
import { addDays, formatDate, formatTime, fromISODate, isPast, toISODate } from '../lib/dates';
import type { DraftRequest, Field, StaffLine, Subcategory } from '../lib/types';
import { ROLE_LABEL, ROLE_OF_SUBCATEGORY, SUBCATEGORIES_BY_ROLE, SUBCATEGORY_LABEL } from '../lib/types';
import { blockers, summarize, type FieldKey } from '../lib/validate';
import { useBookings } from '../state/BookingsContext';
import { colors, radius, space, type } from '../theme';

type Active = { kind: 'field'; key: FieldKey } | { kind: 'line'; id: string } | null;

const AREAS = (areasJson as Array<{ name: string }>).map((a) => a.name);
const HOURS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
const BUDGETS = [800, 1000, 1500, 2000, 2500, 3000];

const confirmed = <T,>(value: T): Field<T> => ({ value, confidence: 'high' });

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { session, currentDraft: draft, updateDraft, setCancelLatest, latestActive } = useBookings();
  const [active, setActive] = useState<Active>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (!draft) router.replace('/');
  }, [draft]);

  const todo = useMemo(() => (draft ? blockers(draft) : []), [draft]);
  if (!draft || !session) return null;

  const total = session.parse.drafts.length;
  const ready = todo.length === 0;

  function patch(p: Partial<DraftRequest>) {
    updateDraft({ ...draft!, ...p });
    Haptics.selectionAsync().catch(() => {});
  }
  function patchLine(id: string, p: Partial<StaffLine>) {
    patch({ lines: draft!.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  }
  function setField<K extends FieldKey>(key: K, value: DraftRequest[K]['value']) {
    patch({ [key]: confirmed(value) } as Partial<DraftRequest>);
    setActive(null);
  }
  function keepField(key: FieldKey) {
    patch({ [key]: { ...draft![key], confidence: 'high', reason: undefined } } as Partial<DraftRequest>);
    setActive(null);
  }

  function onContinue() {
    if (!ready) {
      // Nothing is submitted; point at what is left instead.
      setNudge(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setTimeout(() => setNudge(false), 1600);
      return;
    }
    router.push('/matches');
  }

  const lineValue = (l: StaffLine) => {
    const n = l.count.value ?? 1;
    if (l.subcategory.value) return `${n} × ${SUBCATEGORY_LABEL[l.subcategory.value]}`;
    if (l.role.value) return `${n} × ${ROLE_LABEL[l.role.value]} (any type)`;
    return 'Staff type not set';
  };
  const lineConfidence = (l: StaffLine) => {
    const order = ['high', 'medium', 'low', 'missing'] as const;
    return order[Math.max(order.indexOf(l.subcategory.confidence), order.indexOf(l.count.confidence))];
  };
  const lineReason = (l: StaffLine) => (l.subcategory.confidence !== 'high' ? l.subcategory.reason : l.count.confidence !== 'high' ? l.count.reason : undefined);

  const activeLine = active?.kind === 'line' ? draft.lines.find((l) => l.id === active.id) ?? null : null;
  const activeField = active?.kind === 'field' ? active.key : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title="Check what I understood"
        subtitle={total > 1 ? `Booking ${session.index + 1} of ${total}` : session.parse.engine === 'llm' ? 'Read by Claude' : 'Read by built-in rules'}
      />

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.lg }} keyboardShouldPersistTaps="handled">
        {/* The plain-English readback. This is the sentence the owner must read. */}
        <Animated.View entering={FadeInDown.duration(320)} layout={LinearTransition}>
          <Card style={[styles.summary, nudge && styles.summaryNudge]}>
            <Text style={[type.caption, { color: colors.muted }]}>You asked for</Text>
            <Text style={[type.title, { color: colors.ink, marginTop: 4 }]}>{summarize(draft)}</Text>
            <View style={styles.statusLine}>
              {ready ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[type.smallStrong, { color: colors.primary }]}>Everything is clear. Tap any line to change it.</Text>
                </>
              ) : (
                <>
                  <Ionicons name="help-circle" size={18} color={colors.warn} />
                  <Text style={[type.smallStrong, { color: colors.warn, flex: 1 }]}>
                    {todo.length === 1 ? '1 thing to answer: ' : `${todo.length} things to answer: `}
                    {todo.map((t) => t.label).join(', ')}
                  </Text>
                </>
              )}
            </View>
            <Muted style={{ marginTop: space.sm }}>“{draft.raw}”</Muted>
          </Card>
        </Animated.View>

        {session.parse.warnings.length > 0 ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={18} color={colors.primaryDeep} />
            <View style={{ flex: 1, gap: 2 }}>
              {session.parse.warnings.map((w) => (
                <Text key={w} style={[type.small, { color: colors.primaryDeep }]}>
                  {w}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {session.parse.intent === 'cancel_and_book' && session.index === 0 ? (
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: colors.ink }]}>Also cancel your latest request?</Text>
                <Muted>{latestActive ? latestActive.summary : 'You have no active request to cancel.'}</Muted>
              </View>
              <Switch
                value={session.cancelLatest && Boolean(latestActive)}
                disabled={!latestActive}
                onValueChange={setCancelLatest}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                thumbColor="#fff"
              />
            </View>
          </Card>
        ) : null}

        {/* Staff lines */}
        <View>
          <Text style={styles.groupLabel}>Who</Text>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {draft.lines.map((l, i) => (
              <FieldRow
                key={l.id}
                icon="people"
                leading={<SubIcon sub={l.subcategory.value} color={lineConfidence(l) === 'low' || lineConfidence(l) === 'missing' ? colors.warn : colors.primaryDeep} />}
                label={draft.lines.length > 1 ? `Staff ${i + 1}` : 'Staff'}
                value={lineValue(l)}
                confidence={lineConfidence(l)}
                reason={lineReason(l)}
                onPress={() => setActive({ kind: 'line', id: l.id })}
              />
            ))}
            <Pressable
              onPress={() => {
                const id = Math.random().toString(36).slice(2, 9);
                patch({
                  lines: [
                    ...draft.lines,
                    {
                      id,
                      role: { value: null, confidence: 'missing' },
                      subcategory: { value: null, confidence: 'missing', reason: 'Pick the type of staff' },
                      count: confirmed(1),
                    },
                  ],
                });
                setActive({ kind: 'line', id });
              }}
              style={styles.addRow}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[type.smallStrong, { color: colors.primary }]}>Add another staff type</Text>
            </Pressable>
          </Card>
        </View>

        <View>
          <Text style={styles.groupLabel}>When</Text>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <FieldRow
              icon="calendar"
              label="Date"
              value={draft.date.value ? formatDate(draft.date.value) : 'Not set'}
              confidence={draft.date.confidence}
              reason={draft.date.reason}
              onPress={() => setActive({ kind: 'field', key: 'date' })}
            />
            <FieldRow
              icon="calendar-outline"
              label="Until"
              value={draft.endDate.value ? formatDate(draft.endDate.value) : 'Same day'}
              confidence={draft.endDate.confidence}
              reason={draft.endDate.reason}
              onPress={() => setActive({ kind: 'field', key: 'endDate' })}
            />
            <FieldRow
              icon="time"
              label="From"
              value={draft.startTime.value ? formatTime(draft.startTime.value) : 'Not set'}
              confidence={draft.startTime.confidence}
              reason={draft.startTime.reason}
              onPress={() => setActive({ kind: 'field', key: 'startTime' })}
            />
            <FieldRow
              icon="time-outline"
              label="To"
              value={draft.endTime.value ? formatTime(draft.endTime.value) : 'Not set'}
              confidence={draft.endTime.confidence}
              reason={draft.endTime.reason}
              onPress={() => setActive({ kind: 'field', key: 'endTime' })}
            />
          </Card>
        </View>

        <View>
          <Text style={styles.groupLabel}>Where and how much</Text>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <FieldRow
              icon="location"
              label="Area"
              value={draft.location.value ?? 'Not set'}
              confidence={draft.location.confidence}
              reason={draft.location.reason}
              onPress={() => setActive({ kind: 'field', key: 'location' })}
            />
            <FieldRow
              icon="cash"
              label="Budget per day"
              value={draft.budgetPerDay.value ? `₹${draft.budgetPerDay.value}` : 'No limit'}
              confidence={draft.budgetPerDay.confidence}
              reason={draft.budgetPerDay.reason}
              onPress={() => setActive({ kind: 'field', key: 'budgetPerDay' })}
            />
          </Card>
        </View>

        {draft.notes.length > 0 ? (
          <View>
            <Text style={styles.groupLabel}>Notes</Text>
            <ChipWrap>
              {draft.notes.map((n) => (
                <View key={n} style={styles.note}>
                  <Text style={[type.small, { color: colors.inkSoft }]}>{n}</Text>
                </View>
              ))}
            </ChipWrap>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky footer. The button never submits anything; it only moves on
          to matching, and even that waits until every question is answered. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {!ready ? (
          <Animated.Text entering={FadeIn} style={[type.small, { color: colors.warn, textAlign: 'center' }]}>
            Answer the {todo.length === 1 ? 'highlighted question' : `${todo.length} highlighted questions`} to continue
          </Animated.Text>
        ) : null}
        <Button
          label={ready ? 'Looks right, find staff' : 'Find staff'}
          icon={ready ? 'search' : 'lock-closed'}
          onPress={onContinue}
          style={{ opacity: ready ? 1 : 0.6 }}
        />
      </View>

      {/* ---- Staff line sheet ---- */}
      <OptionSheet
        visible={Boolean(activeLine)}
        title="Staff"
        question={activeLine ? lineReason(activeLine) : undefined}
        onClose={() => setActive(null)}
        footer={
          draft.lines.length > 1 && activeLine ? (
            <Button
              label="Remove this line"
              variant="ghost"
              icon="trash-outline"
              onPress={() => {
                patch({ lines: draft.lines.filter((l) => l.id !== activeLine.id) });
                setActive(null);
              }}
              style={{ marginTop: space.md }}
            />
          ) : null
        }
      >
        {activeLine ? (
          <>
            <SheetLabel>How many</SheetLabel>
            <ChipWrap>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  selected={activeLine.count.value === n}
                  tone={activeLine.count.suggestions?.includes(n) ? 'suggest' : 'default'}
                  onPress={() => patchLine(activeLine.id, { count: confirmed(n) })}
                />
              ))}
            </ChipWrap>
            {(Object.keys(SUBCATEGORIES_BY_ROLE) as Array<keyof typeof SUBCATEGORIES_BY_ROLE>).map((role) => (
              <View key={role}>
                <SheetLabel>{ROLE_LABEL[role]}</SheetLabel>
                <ChipWrap>
                  {SUBCATEGORIES_BY_ROLE[role].map((sub: Subcategory) => (
                    <Chip
                      key={sub}
                      label={SUBCATEGORY_LABEL[sub]}
                      selected={activeLine.subcategory.value === sub}
                      tone={activeLine.subcategory.suggestions?.includes(sub) ? 'suggest' : 'default'}
                      onPress={() => {
                        patchLine(activeLine.id, { subcategory: confirmed(sub), role: confirmed(ROLE_OF_SUBCATEGORY[sub]) });
                        setActive(null);
                      }}
                    />
                  ))}
                  {role === 'chef' ? (
                    <Chip
                      label="Any chef"
                      selected={activeLine.role.value === 'chef' && activeLine.subcategory.value === null && activeLine.subcategory.confidence === 'high'}
                      onPress={() => {
                        patchLine(activeLine.id, { subcategory: { value: null, confidence: 'high' }, role: confirmed('chef') });
                        setActive(null);
                      }}
                    />
                  ) : null}
                </ChipWrap>
              </View>
            ))}
          </>
        ) : null}
      </OptionSheet>

      {/* ---- Date ---- */}
      <OptionSheet visible={activeField === 'date'} title="Which day?" question={draft.date.reason} onClose={() => setActive(null)}>
        <DatePicker field={draft.date} onPick={(v) => setField('date', v)} onKeep={() => keepField('date')} />
      </OptionSheet>

      <OptionSheet visible={activeField === 'endDate'} title="Until which day?" question={draft.endDate.reason} onClose={() => setActive(null)}>
        <SheetLabel>Length</SheetLabel>
        <ChipWrap>
          <Chip label="Same day" selected={!draft.endDate.value} onPress={() => setField('endDate', null)} />
          {draft.date.value
            ? Array.from({ length: 7 }, (_, i) => toISODate(addDays(fromISODate(draft.date.value!), i + 1))).map((iso, i) => (
                <Chip key={iso} label={`${i + 2} days, to ${formatDate(iso)}`} selected={draft.endDate.value === iso} onPress={() => setField('endDate', iso)} />
              ))
            : null}
        </ChipWrap>
      </OptionSheet>

      {/* ---- Times ---- */}
      <OptionSheet visible={activeField === 'startTime'} title="Start time" question={draft.startTime.reason} onClose={() => setActive(null)}>
        <TimePicker field={draft.startTime} onPick={(v) => setField('startTime', v)} onKeep={() => keepField('startTime')} />
      </OptionSheet>
      <OptionSheet visible={activeField === 'endTime'} title="End time" question={draft.endTime.reason} onClose={() => setActive(null)}>
        <TimePicker field={draft.endTime} onPick={(v) => setField('endTime', v)} onKeep={() => keepField('endTime')} />
      </OptionSheet>

      {/* ---- Area ---- */}
      <OptionSheet visible={activeField === 'location'} title="Which area?" question={draft.location.reason} onClose={() => setActive(null)}>
        {draft.location.confidence === 'low' && draft.location.value ? (
          <>
            <SheetLabel>As written</SheetLabel>
            <ChipWrap>
              <Chip label={`Keep “${draft.location.value}”`} tone="suggest" onPress={() => keepField('location')} />
            </ChipWrap>
          </>
        ) : null}
        <SheetLabel>Areas we serve</SheetLabel>
        <ChipWrap>
          {AREAS.map((a) => (
            <Chip key={a} label={a} selected={draft.location.value === a} onPress={() => setField('location', a)} />
          ))}
        </ChipWrap>
      </OptionSheet>

      {/* ---- Budget ---- */}
      <OptionSheet visible={activeField === 'budgetPerDay'} title="Budget per day" onClose={() => setActive(null)}>
        <SheetLabel>Per person, per day</SheetLabel>
        <ChipWrap>
          <Chip label="No limit" selected={!draft.budgetPerDay.value} onPress={() => setField('budgetPerDay', null)} />
          {BUDGETS.map((b) => (
            <Chip key={b} label={`₹${b}`} selected={draft.budgetPerDay.value === b} onPress={() => setField('budgetPerDay', b)} />
          ))}
        </ChipWrap>
      </OptionSheet>
    </View>
  );
}

function DatePicker({ field, onPick, onKeep }: { field: Field<string>; onPick: (v: string) => void; onKeep: () => void }) {
  const today = new Date();
  const suggestions = (field.suggestions ?? []).filter((s) => !isPast(s, today));
  const upcoming = Array.from({ length: 14 }, (_, i) => toISODate(addDays(today, i)));
  const canKeep = field.confidence === 'low' && field.value && !isPast(field.value, today);
  return (
    <>
      {suggestions.length > 0 || canKeep ? (
        <>
          <SheetLabel>Most likely</SheetLabel>
          <ChipWrap>
            {canKeep ? <Chip label={`Keep ${formatDate(field.value!)}`} tone="suggest" onPress={onKeep} /> : null}
            {suggestions.map((s) => (
              <Chip key={s} label={formatDate(s)} tone="suggest" selected={field.value === s && field.confidence === 'high'} onPress={() => onPick(s)} />
            ))}
          </ChipWrap>
        </>
      ) : null}
      <SheetLabel>Next two weeks</SheetLabel>
      <ChipWrap>
        {upcoming.map((iso, i) => (
          <Chip key={iso} label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(iso)} selected={field.value === iso} onPress={() => onPick(iso)} />
        ))}
      </ChipWrap>
    </>
  );
}

function TimePicker({ field, onPick, onKeep }: { field: Field<string>; onPick: (v: string) => void; onKeep: () => void }) {
  const suggestions = field.suggestions ?? [];
  return (
    <>
      {suggestions.length > 0 || field.confidence === 'low' ? (
        <>
          <SheetLabel>Most likely</SheetLabel>
          <ChipWrap>
            {field.confidence === 'low' && field.value ? <Chip label={`Keep ${formatTime(field.value)}`} tone="suggest" onPress={onKeep} /> : null}
            {suggestions
              .filter((s) => s !== field.value)
              .map((s) => (
                <Chip key={s} label={formatTime(s)} tone="suggest" onPress={() => onPick(s)} />
              ))}
          </ChipWrap>
        </>
      ) : null}
      <SheetLabel>Any hour</SheetLabel>
      <ChipWrap>
        {HOURS.map((h) => (
          <Chip key={h} label={formatTime(h)} selected={field.value === h} onPress={() => onPick(h)} />
        ))}
        <Chip label="11:30 PM" selected={field.value === '23:30'} onPress={() => onPick('23:30')} />
      </ChipWrap>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { borderWidth: 1.5, borderColor: 'transparent' },
  summaryNudge: { borderColor: colors.warnBorder, backgroundColor: '#FFFBEB' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: space.md,
    borderRadius: radius.md,
  },
  groupLabel: { ...type.caption, color: colors.muted, marginBottom: space.sm, marginLeft: space.xs },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  note: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
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
