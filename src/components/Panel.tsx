import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, glow, radius, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Full cyan edge and glow: this panel is about the local player, or it is their turn. */
  highlight?: boolean;
  testID?: string;
}

/** A raised, card-like surface. Every screen outside the table builds on it. */
export function Panel({ children, style, highlight = false, testID }: Props) {
  return (
    <View
      testID={testID}
      style={[styles.panel, highlight && styles.highlight, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    boxShadow: glow.soft,
  },
  highlight: { borderColor: colors.primary, boxShadow: glow.cyan },
});
