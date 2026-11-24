import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, neon } from '../theme';

export const SMALL_CARD = { width: 18, height: 24 };

/**
 * A face-down card. It takes no card on purpose: what an opponent holds can
 * never reach the screen or a screen reader through this component.
 * The mark is the fedora from the app icon, drawn from two shapes.
 */
export function CardBack() {
  return (
    <View testID="card-back" style={styles.card}>
      <View testID="card-back-hat" style={styles.hat}>
        <View style={styles.crown} />
        <View style={styles.brim} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...SMALL_CARD,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: neon.cyan,
    backgroundColor: colors.background,
    boxShadow: '0 0 6px rgba(0, 229, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hat: { alignItems: 'center' },
  crown: {
    width: 7,
    height: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: neon.cyan,
  },
  brim: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: neon.cyan,
  },
});
