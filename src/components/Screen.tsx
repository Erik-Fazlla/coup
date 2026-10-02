import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(spacing.md, insets.top),
          paddingBottom: Math.max(spacing.md, insets.bottom),
          paddingLeft: Math.max(spacing.lg, insets.left),
          paddingRight: Math.max(spacing.lg, insets.right),
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
