import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../theme';

/** Shown when src/firebase/config.ts still holds placeholder values. */
export function SetupScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Firebase is not configured</Text>
      <Text style={styles.body}>
        Paste your Firebase web config into src/firebase/config.ts and rebuild
        the app. See README.md, section "Firebase setup".
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  body: { color: colors.muted, fontSize: 14 },
});
