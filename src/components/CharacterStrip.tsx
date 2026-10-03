import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CARDS } from '../engine/types';
import { spacing } from '../theme';
import { CharacterBadge } from './CharacterGlyph';

/** The five characters in a row: the game's identity on screens that have no cards. Decorative. */
export function CharacterStrip({ size = 28 }: { size?: number }) {
  return (
    <View
      style={styles.strip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {CARDS.map(card => (
        <CharacterBadge key={card} card={card} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: spacing.sm },
});
