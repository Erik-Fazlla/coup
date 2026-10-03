import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import {
  colors,
  DENSE_FONT_SCALE,
  radius,
  spacing,
  TOUCH_MIN,
  typography,
} from '../theme';
import { CharacterCard } from './CharacterCard';

interface Props {
  options: Card[];
  keepCount: number;
  disabled: boolean;
  /** Narrow slot (portrait): Confirm goes under the cards instead of beside them. */
  stacked?: boolean;
  onConfirm: (keep: number[]) => void;
}

/** Ambassador exchange: tap cards to select the ones to keep, then confirm. */
export function ExchangePicker({
  options,
  keepCount,
  disabled,
  stacked = false,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const ready = !disabled && selected.length === keepCount;

  const toggle = (index: number) =>
    setSelected(current => {
      if (current.includes(index)) {
        return current.filter(i => i !== index);
      }
      return current.length < keepCount ? [...current, index] : current;
    });

  const confirm = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Confirm"
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={() => onConfirm(selected)}
      testID="exchange-confirm"
      style={({ pressed }) => [
        styles.confirm,
        stacked ? styles.confirmBelow : styles.confirmBeside,
        pressed && styles.pressed,
        !ready && styles.disabled,
      ]}
    >
      <Text
        style={styles.confirmText}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        Confirm
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.picker}>
      <Text style={styles.prompt} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
        Choose {keepCount} card{keepCount === 1 ? '' : 's'} to keep ·{' '}
        {selected.length}/{keepCount} chosen
      </Text>
      <View style={styles.row}>
        {options.map((card, index) => (
          <CharacterCard
            key={index}
            testID={`exchange-card-${index}`}
            card={card}
            abilityLines={3}
            selected={selected.includes(index)}
            onPress={() => toggle(index)}
          />
        ))}
        {!stacked && confirm}
      </View>
      {stacked && confirm}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flex: 1 },
  prompt: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  row: { flex: 1, flexDirection: 'row', gap: 6 },
  confirm: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  confirmBeside: { width: 72 },
  confirmBelow: { marginTop: 6 },
  confirmText: { ...typography.label, color: colors.onLight },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
