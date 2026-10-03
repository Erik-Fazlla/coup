import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const SIZE = 8;

/**
 * Green when the player's phone is connected to the game, grey when it is not.
 * Decorative: the row or seat it sits in says "online" or "offline" in its own label.
 */
export function OnlineDot({ online }: { online: boolean }) {
  return (
    <View
      testID={online ? 'dot-online' : 'dot-offline'}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.dot, online ? styles.online : styles.offline]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    marginRight: 5,
  },
  online: { backgroundColor: colors.positive },
  offline: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.faint,
  },
});
