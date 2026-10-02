import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { unrevealedCount } from '../engine/rules';
import { Player } from '../engine/types';
import { colors, spacing } from '../theme';

interface Props {
  player: Player;
  isTurn: boolean;
}

/** An opponent: name, coins, how many cards are still face down, and which cards they have lost. */
export function PlayerSeat({ player, isTurn }: Props) {
  const hidden = unrevealedCount(player);
  const lost = player.influence.filter(i => i.revealed).map(i => i.card);
  const eliminated = hidden === 0;
  return (
    <View
      style={[
        styles.seat,
        isTurn && styles.turn,
        eliminated && styles.eliminated,
      ]}
    >
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <Text style={styles.detail}>
        {eliminated
          ? 'Out'
          : `${player.coins} coins · ${hidden} card${hidden === 1 ? '' : 's'}`}
      </Text>
      {lost.length > 0 && (
        <Text style={styles.lost}>Lost: {lost.join(', ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    minWidth: 120,
    margin: spacing.xs,
    padding: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  turn: { borderColor: colors.primary, borderWidth: 2 },
  eliminated: { opacity: 0.45 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  detail: { color: colors.text, fontSize: 12, marginTop: 2 },
  lost: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
