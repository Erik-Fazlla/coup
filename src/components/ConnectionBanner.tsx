import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) {
    return null;
  }
  return (
    <Text style={styles.banner} accessibilityLiveRegion="polite">
      Connecting to server… actions are paused
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    ...typography.caption,
    color: colors.danger,
    backgroundColor: colors.dangerFill,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
});
