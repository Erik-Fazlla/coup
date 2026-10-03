import React, { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';
import { Button } from './Button';

export const LOG_SHEET_ENTRIES = 30;

interface Props {
  visible: boolean;
  log: string[];
  onClose: () => void;
}

/**
 * The recent action log, newest first, drawn over the table. It is a plain
 * overlay inside the screen rather than a native Modal, so the hidden status
 * bar and the landscape lock are left alone.
 */
export function LogSheet({ visible, log, onClose }: Props) {
  useEffect(() => {
    if (!visible) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  const first = Math.max(0, log.length - LOG_SHEET_ENTRIES);
  const entries = log
    .slice(first)
    .map((line, index) => ({ line, number: first + index + 1 }))
    .reverse();

  return (
    <View style={styles.scrim} accessibilityViewIsModal testID="log-sheet">
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text
            style={styles.title}
            accessibilityRole="header"
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            Game log
          </Text>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {entries.length === 0 ? (
            <Text
              style={styles.empty}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              Nothing has happened yet.
            </Text>
          ) : (
            entries.map(entry => (
              <View key={entry.number} style={styles.entry}>
                <Text style={styles.number} maxFontSizeMultiplier={1.15}>
                  {entry.number}
                </Text>
                <Text
                  style={styles.line}
                  maxFontSizeMultiplier={READING_FONT_SCALE}
                >
                  {entry.line}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
    alignItems: 'center',
  },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.heading, color: colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  entry: { flexDirection: 'row', paddingVertical: 5 },
  number: {
    ...typography.caption,
    width: 30,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
  line: { ...typography.body, flex: 1, color: colors.text, fontSize: 14 },
  empty: { ...typography.body, color: colors.muted },
});
