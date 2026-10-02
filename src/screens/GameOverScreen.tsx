import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { colors, spacing } from '../theme';

export function GameOverScreen() {
  const { game, gameId, leave } = useGame();
  const { playerId, recordResult } = useProfile();
  const winner = game?.winner ?? null;
  const played = !!game?.players[playerId];

  useEffect(() => {
    if (gameId && winner && played) {
      // A failed stats write must not surface as an unhandled rejection on the result screen.
      recordResult(gameId, winner === playerId).catch(() => {});
    }
  }, [gameId, winner, played, playerId, recordResult]);

  if (!game) {
    return null;
  }

  const title = !winner
    ? 'Game over'
    : winner === playerId
    ? 'You win!'
    : `${game.players[winner]?.name ?? 'Someone'} wins`;

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          Game over after {game.state.turnNumber} turns
        </Text>
        <Button label="Back to Home" onPress={leave} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  meta: { color: colors.muted, fontSize: 14, marginBottom: spacing.lg },
});
