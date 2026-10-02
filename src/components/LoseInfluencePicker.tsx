import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Player } from '../engine/types';
import { colors, spacing } from '../theme';
import { CardView } from './CardView';

interface Props {
  player: Player;
  disabled: boolean;
  onPick: (cardIndex: number) => void;
}

/** Shown when the local player must choose which of their hidden cards to lose. */
export function LoseInfluencePicker({ player, disabled, onPick }: Props) {
  return (
    <View>
      <Text style={styles.prompt}>Choose a card to lose</Text>
      <View style={styles.row}>
        {player.influence.map((influence, index) =>
          influence.revealed ? null : (
            <CardView
              key={index}
              card={influence.card}
              onPress={disabled ? undefined : () => onPick(index)}
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    color: colors.danger,
    fontSize: 13,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
