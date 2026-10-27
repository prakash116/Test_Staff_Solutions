import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  question?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Bottom sheet used for every correction. One field per sheet, one tap per fix. */
export function OptionSheet({ visible, title, question, onClose, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(220)}
          exiting={SlideOutDown.duration(180)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
              {question ? <Text style={[type.small, { color: colors.warn, marginTop: 4 }]}>{question}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function ChipWrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

export function SheetLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[type.caption, { color: colors.muted, marginTop: space.md, marginBottom: space.sm }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
