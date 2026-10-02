import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

const VISIBLE_LINES = 3;

export function GameLog({ log }: { log: string[] }) {
  return (
    <View style={styles.log}>
      {log.slice(-VISIBLE_LINES).map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  log: { flex: 1, paddingHorizontal: spacing.md, justifyContent: 'center' },
  line: { color: colors.muted, fontSize: 12 },
});
