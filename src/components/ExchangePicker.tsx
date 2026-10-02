import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { CardView } from './CardView';

interface Props {
  options: Card[];
  keepCount: number;
  disabled: boolean;
  onConfirm: (keep: number[]) => void;
}

/** Ambassador exchange: tap cards to select the ones to keep, then confirm. */
export function ExchangePicker({
  options,
  keepCount,
  disabled,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (index: number) =>
    setSelected(current => {
      if (current.includes(index)) {
        return current.filter(i => i !== index);
      }
      return current.length < keepCount ? [...current, index] : current;
    });

  return (
    <View>
      <Text style={styles.prompt}>
        Choose {keepCount} card{keepCount === 1 ? '' : 's'} to keep
      </Text>
      <View style={styles.row}>
        {options.map((card, index) => (
          <CardView
            key={index}
            card={card}
            selected={selected.includes(index)}
            onPress={() => toggle(index)}
          />
        ))}
        <Button
          label="Confirm"
          disabled={disabled || selected.length !== keepCount}
          onPress={() => onConfirm(selected)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    color: colors.text,
    fontSize: 13,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
