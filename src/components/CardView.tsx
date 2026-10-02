import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import { colors, spacing } from '../theme';

interface Props {
  card: Card;
  revealed?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

export function CardView({
  card,
  revealed = false,
  selected = false,
  onPress,
}: Props) {
  const box = (
    <View
      style={[
        styles.card,
        selected && styles.selected,
        revealed && styles.revealed,
      ]}
    >
      <Text style={[styles.name, revealed && styles.nameRevealed]}>{card}</Text>
      {revealed && <Text style={styles.lost}>LOST</Text>}
    </View>
  );
  if (!onPress) {
    return box;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card}
      onPress={onPress}
    >
      {box}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 96,
    height: 64,
    margin: spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.primary, borderWidth: 3 },
  revealed: { borderColor: colors.border },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  nameRevealed: { color: colors.muted, textDecorationLine: 'line-through' },
  lost: { color: colors.danger, fontSize: 10, marginTop: 2 },
});
