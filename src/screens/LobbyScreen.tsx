import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/lobby';
import { colors, spacing } from '../theme';

export function LobbyScreen() {
  const { game, connected, busy, error, startGame, leave } = useGame();
  const { playerId } = useProfile();

  if (!game) {
    return null;
  }

  const isHost = game.host === playerId;
  const count = game.playerOrder.length;
  const disabled = !connected || busy;

  return (
    <Screen>
      <ConnectionBanner connected={connected} />
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.label}>Join code</Text>
          <Text style={styles.code} selectable>
            {game.code}
          </Text>
          {isHost ? (
            <Button
              label="Start Game"
              disabled={disabled || count < MIN_PLAYERS}
              onPress={startGame}
            />
          ) : (
            <Text style={styles.label}>Waiting for the host to start…</Text>
          )}
          <Button
            label={isHost ? 'Cancel Game' : 'Leave'}
            variant="secondary"
            onPress={leave}
          />
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>
            Players {count}/{MAX_PLAYERS}
          </Text>
          {game.playerOrder.map(id => (
            <Text key={id} style={styles.player}>
              {game.players[id].name}
              {id === game.host ? ' (host)' : ''}
              {id === playerId ? ' (you)' : ''}
            </Text>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  column: { flex: 1, alignItems: 'center' },
  label: { color: colors.muted, fontSize: 13, marginBottom: spacing.xs },
  code: {
    color: colors.primary,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 8,
    marginBottom: spacing.md,
  },
  player: { color: colors.text, fontSize: 16, marginBottom: spacing.xs },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
