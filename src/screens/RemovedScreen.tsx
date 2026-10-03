import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { colors, READING_FONT_SCALE, spacing, typography } from '../theme';

/** Shown to a player the host removed from the lobby. The only way on is back to Home. */
export function RemovedScreen() {
  const { error, leave } = useGame();
  return (
    <Screen>
      <View style={styles.centre}>
        <Panel style={styles.panel}>
          <Text
            style={styles.message}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            The host removed you from this game
          </Text>
          <Text
            style={styles.detail}
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            You cannot rejoin it. You can create a game or join another one from
            Home.
          </Text>
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Button label="Back to Home" onPress={leave} testID="back-home" />
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { alignItems: 'center', padding: spacing.lg, maxWidth: 440 },
  message: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  detail: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
