import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
