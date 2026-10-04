import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Player } from '../engine/types';
import { colors, DENSE_FONT_SCALE, spacing, typography } from '../theme';
import { CharacterCard } from './CharacterCard';

interface Props {
  player: Player;
  disabled: boolean;
  onPick: (cardIndex: number) => void;
}

/** Shown when the local player must choose which of their hidden cards to lose. */
export function LoseInfluencePicker({ player, disabled, onPick }: Props) {
  return (
    <View style={styles.picker}>
      <Text style={styles.prompt} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
        Choose a card to lose
      </Text>
      <View style={styles.row}>
        {player.influence.map((influence, index) =>
          influence.revealed ? null : (
            <CharacterCard
              key={index}
              testID={`lose-card-${index}`}
              card={influence.card}
              abilityLines={3}
              disabled={disabled}
              onPress={() => onPick(index)}
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flex: 1 },
  prompt: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  // Cards stop growing at their maximum width; what is left goes either side of them.
  row: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
