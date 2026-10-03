import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/lobby';
import { colors, radius, spacing, typography } from '../theme';

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
        <Panel style={styles.column}>
          <Text style={styles.label}>JOIN CODE</Text>
          <Text style={styles.code} selectable maxFontSizeMultiplier={1.15}>
            {game.code}
          </Text>
          {isHost ? (
            <Button
              label="Start Game"
              disabled={disabled || count < MIN_PLAYERS}
              onPress={startGame}
            />
          ) : (
            <Text style={styles.waiting}>Waiting for the host to start…</Text>
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
        </Panel>
        <Panel style={styles.column}>
          <Text style={styles.label}>
            PLAYERS {count}/{MAX_PLAYERS}
          </Text>
          <View style={styles.players}>
            {game.playerOrder.map(id => {
              const isYou = id === playerId;
              return (
                <View
                  key={id}
                  style={[styles.player, isYou && styles.playerYou]}
                >
                  <Text
                    style={styles.playerName}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.15}
                  >
                    {game.players[id].name}
                    {id === game.host ? ' (host)' : ''}
                    {isYou ? ' (you)' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  column: { flex: 1, alignItems: 'center' },
  label: { ...typography.micro, color: colors.muted, marginBottom: spacing.xs },
  code: {
    color: colors.coin,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 8,
    // letterSpacing also pads the last letter; pull the code back to centre.
    marginRight: -8,
    marginBottom: spacing.sm,
  },
  waiting: {
    ...typography.caption,
    color: colors.muted,
    marginVertical: spacing.sm,
  },
  players: { alignSelf: 'stretch', gap: spacing.xs },
  player: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  playerYou: { borderColor: colors.primary },
  playerName: { ...typography.body, color: colors.text },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
