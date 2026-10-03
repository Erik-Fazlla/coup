import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export const SMALL_CARD = { width: 18, height: 24 };

/**
 * A face-down card. It takes no card on purpose: what an opponent holds can
 * never reach the screen or a screen reader through this component.
 */
export function CardBack() {
  return (
    <View style={styles.card}>
      <View style={styles.mark} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...SMALL_CARD,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderColor: colors.faint,
    transform: [{ rotate: '45deg' }],
  },
});
