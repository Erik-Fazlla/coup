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
      recordResult(gameId, winner === playerId);
    }
  }, [gameId, winner, played, playerId, recordResult]);

  if (!game || !winner) {
    return null;
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>
          {winner === playerId
            ? 'You win!'
            : `${game.players[winner].name} wins`}
        </Text>
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
