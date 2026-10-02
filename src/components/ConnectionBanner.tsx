import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) {
    return null;
  }
  return (
    <Text style={styles.banner}>Connecting to server… actions are paused</Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    color: colors.onLight,
    backgroundColor: colors.danger,
    textAlign: 'center',
    fontSize: 12,
    padding: spacing.xs,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
});
