import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { OnlineDot } from '../components/OnlineDot';
import { Panel } from '../components/Panel';
import { Scoreboard } from '../components/Scoreboard';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { shareMessage } from '../engine/describe';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/lobby';
import {
  colors,
  DENSE_FONT_SCALE,
  radius,
  spacing,
  TOUCH_MIN,
  typography,
} from '../theme';
import { useIsPortrait } from '../ui/orientation';
import { isOnline, knownPresence } from '../ui/presence';

/** Opens the system share sheet with the invitation. Closing it, or having nothing to share with, is not an error. */
function shareCode(code: string) {
  try {
    Share.share({ message: shareMessage(code) }).catch(() => {});
  } catch {
    // Nothing to tell the player: the code is still on screen to read out.
  }
}

export function LobbyScreen() {
  const { game, connected, busy, error, online, startGame, leave, kick } =
    useGame();
  const { playerId } = useProfile();
  const portrait = useIsPortrait();

  if (!game) {
    return null;
  }

  const isHost = game.host === playerId;
  const count = game.playerOrder.length;
  const disabled = !connected || busy;
  const presence = knownPresence(online, playerId);

  const confirmKick = (id: string, name: string) =>
    Alert.alert(
      `Remove ${name}?`,
      'They will not be able to rejoin this game.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => kick(id) },
      ],
    );

  return (
    <Screen>
      <ConnectionBanner connected={connected} />
      <View style={portrait ? styles.stack : styles.columns}>
        <Panel style={[styles.column, !portrait && styles.columnBeside]}>
          <Text style={styles.label}>
            {game.round > 1 ? `JOIN CODE · ROUND ${game.round}` : 'JOIN CODE'}
          </Text>
          <Text
            style={styles.code}
            selectable
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={DENSE_FONT_SCALE}
          >
            {game.code}
          </Text>
          <Button
            label="Share code"
            variant="secondary"
            accessibilityLabel={`Share join code ${game.code}`}
            onPress={() => shareCode(game.code)}
            testID="share"
          />
          {isHost ? (
            <Button
              label="Start Game"
              disabled={disabled || count < MIN_PLAYERS}
              onPress={startGame}
              testID="start"
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

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          <Panel style={styles.listPanel}>
            <Text style={styles.label}>
              PLAYERS {count}/{MAX_PLAYERS}
            </Text>
            <View style={styles.players}>
              {game.playerOrder.map(id => {
                const isYou = id === playerId;
                const name = game.players[id].name;
                const here = isOnline(presence, id);
                const shown = `${name}${id === game.host ? ' (host)' : ''}${
                  isYou ? ' (you)' : ''
                }`;
                return (
                  <View
                    key={id}
                    testID={`player-${id}`}
                    style={[styles.player, isYou && styles.playerYou]}
                  >
                    {here !== null && <OnlineDot online={here} />}
                    <Text
                      style={styles.playerName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      accessibilityLabel={
                        here === null
                          ? shown
                          : `${shown}, ${here ? 'online' : 'offline'}`
                      }
                      maxFontSizeMultiplier={DENSE_FONT_SCALE}
                    >
                      {shown}
                    </Text>
                    {isHost && !isYou && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${name}`}
                        accessibilityState={{ disabled }}
                        disabled={disabled}
                        onPress={() => confirmKick(id, name)}
                        testID={`kick-${id}`}
                        style={styles.kickTouch}
                      >
                        {({ pressed }) => (
                          <View
                            style={[
                              styles.kick,
                              pressed && styles.pressed,
                              disabled && styles.disabled,
                            ]}
                          >
                            <Text
                              style={styles.kickText}
                              maxFontSizeMultiplier={DENSE_FONT_SCALE}
                            >
                              Remove
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </Panel>
          {game.round > 1 && (
            <Panel style={styles.listPanel}>
              <Scoreboard game={game} playerId={playerId} />
            </Panel>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Landscape: code and buttons on the left, players on the right. Portrait: stacked.
  columns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stack: { flex: 1, gap: spacing.md },
  column: { alignItems: 'center' },
  columnBeside: { flex: 1 },
  label: { ...typography.micro, color: colors.muted, marginBottom: spacing.xs },
  code: {
    color: colors.coin,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 8,
    // letterSpacing also pads the last letter; pull the code back to centre.
    marginRight: -8,
    marginBottom: spacing.xs,
  },
  waiting: {
    ...typography.caption,
    color: colors.muted,
    marginVertical: spacing.sm,
  },
  list: { flex: 1, alignSelf: 'stretch' },
  listContent: { flexGrow: 1, justifyContent: 'center', gap: spacing.md },
  listPanel: { alignItems: 'stretch' },
  players: { alignSelf: 'stretch', gap: spacing.xs },
  player: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  playerYou: { borderColor: colors.primary },
  playerName: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    marginRight: spacing.md,
  },
  // The touch target is the full row height; the visible pill inside it is smaller.
  kickTouch: {
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kick: {
    height: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickText: { ...typography.label, color: colors.danger },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
