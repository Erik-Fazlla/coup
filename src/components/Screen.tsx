import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

/** Padding of the game table, where every dp of a small landscape phone counts. */
export const COMPACT_PADDING = { vertical: spacing.sm, horizontal: spacing.md };

interface Props {
  children: React.ReactNode;
  /** Tighter padding, for the game table. */
  compact?: boolean;
}

export function Screen({ children, compact = false }: Props) {
  const insets = useSafeAreaInsets();
  const vertical = compact ? COMPACT_PADDING.vertical : spacing.md;
  const horizontal = compact ? COMPACT_PADDING.horizontal : spacing.lg;
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(vertical, insets.top),
          paddingBottom: Math.max(vertical, insets.bottom),
          paddingLeft: Math.max(horizontal, insets.left),
          paddingRight: Math.max(horizontal, insets.right),
        },
      ]}
    >
      <StatusBar hidden />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
