import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import { colors, spacing } from '../theme';

interface Props {
  card: Card;
  revealed?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export function CardView({
  card,
  revealed = false,
  selected = false,
  disabled = false,
  onPress,
}: Props) {
  const label = revealed ? `${card}, lost` : card;
  const box = (
    <View
      accessible={!onPress}
      accessibilityLabel={onPress ? undefined : label}
      style={[
        styles.card,
        selected && styles.selected,
        revealed && styles.revealed,
        disabled && styles.disabled,
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
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
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
  disabled: { opacity: 0.35 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  nameRevealed: { color: colors.muted, textDecorationLine: 'line-through' },
  lost: { color: colors.danger, fontSize: 10, marginTop: 2 },
});
