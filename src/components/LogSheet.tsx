import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, READING_FONT_SCALE, typography } from '../theme';
import { Sheet } from './Sheet';

export const LOG_SHEET_ENTRIES = 30;

interface Props {
  visible: boolean;
  log: string[];
  onClose: () => void;
}

/** The recent action log, newest first, drawn over the table. */
export function LogSheet({ visible, log, onClose }: Props) {
  if (!visible) {
    return null;
  }

  const first = Math.max(0, log.length - LOG_SHEET_ENTRIES);
  const entries = log
    .slice(first)
    .map((line, index) => ({ line, number: first + index + 1 }))
    .reverse();

  return (
    <Sheet title="Game log" onClose={onClose} testID="log-sheet">
      {entries.length === 0 ? (
        <Text style={styles.empty} maxFontSizeMultiplier={READING_FONT_SCALE}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
