import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CHARACTER_CODE } from '../engine/describe';
import { Card } from '../engine/types';
import { characterColors } from '../theme';
import { SMALL_CARD } from './CardBack';

/** A card an opponent has lost, face up: character colour and two-letter code. */
export function MiniCard({ card }: { card: Card }) {
  const palette = characterColors[card];
  return (
    <View
      accessible
      accessibilityLabel={`${card}, lost`}
      style={[
        styles.card,
        { backgroundColor: palette.fill, borderColor: palette.accent },
      ]}
    >
      <Text
        style={[styles.code, { color: palette.accent }]}
        allowFontScaling={false}
      >
        {CHARACTER_CODE[card]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...SMALL_CARD,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { fontSize: 10, fontWeight: '800' },
});
