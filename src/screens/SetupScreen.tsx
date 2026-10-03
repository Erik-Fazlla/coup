import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';

/** Shown when src/firebase/config.ts still holds placeholder values. */
export function SetupScreen() {
  return (
    <Screen>
      <View style={styles.centre}>
        <Panel style={styles.panel}>
          <Text style={styles.title}>Firebase is not configured</Text>
          <Text style={styles.body}>
            Paste your Firebase web config into src/firebase/config.ts and
            rebuild the app. See README.md, section "Firebase setup".
          </Text>
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { padding: spacing.lg, maxWidth: 520 },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 22,
    marginBottom: spacing.md,
  },
  body: { ...typography.body, color: colors.muted },
});
