import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CharacterStrip } from '../components/CharacterStrip';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { colors, spacing, typography } from '../theme';

export function GameOverScreen() {
  const { game, gameId, leave } = useGame();
  const { playerId, recordResult } = useProfile();
  const winner = game?.winner ?? null;
  const played = !!game?.players[playerId];
  const round = game?.round ?? 1;

  useEffect(() => {
    if (gameId && winner && played) {
      // A failed stats write must not surface as an unhandled rejection on the result screen.
      recordResult(`${gameId}:${round}`, winner === playerId).catch(() => {});
    }
  }, [gameId, round, winner, played, playerId, recordResult]);

  if (!game) {
    return null;
  }

  const youWon = winner === playerId;
  const title = !winner
    ? 'Game over'
    : youWon
    ? 'You win!'
    : `${game.players[winner]?.name ?? 'Someone'} wins`;

  return (
    <Screen>
      <View style={styles.centre}>
        <Panel style={[styles.panel, youWon && styles.panelWon]}>
          <CharacterStrip size={26} />
          <Text
            style={[styles.title, youWon && styles.titleWon]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text style={styles.meta}>
            Game over after {game.state.turnNumber} turns
          </Text>
          <Button label="Back to Home" onPress={leave} />
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minWidth: 320,
    maxWidth: 520,
  },
  panelWon: { borderColor: colors.primary },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 34,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  titleWon: { color: colors.primary },
  meta: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
});
