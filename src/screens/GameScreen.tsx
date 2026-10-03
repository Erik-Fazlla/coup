import React, { useCallback, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ActionGrid } from '../components/ActionGrid';
import { Button } from '../components/Button';
import { CharacterCard } from '../components/CharacterCard';
import { Coins } from '../components/Coins';
import { EventBanner } from '../components/EventBanner';
import { ExchangePicker } from '../components/ExchangePicker';
import { LogSheet } from '../components/LogSheet';
import { LoseInfluencePicker } from '../components/LoseInfluencePicker';
import { Panel } from '../components/Panel';
import { ResponseBar } from '../components/ResponseBar';
import { COMPACT_PADDING, Screen } from '../components/Screen';
import { Seat } from '../components/Seat';
import { REGION_GAP, SEAT_GAP, tableLayout } from '../components/tableLayout';
import { TopBar } from '../components/TopBar';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { ACTION_LABEL, viewerLine } from '../engine/describe';
import {
  availableActions,
  livingPlayers,
  responseOptions,
  unrevealedCount,
} from '../engine/rules';
import { GameAction, TargetedAction } from '../engine/types';
import {
  colors,
  DENSE_FONT_SCALE,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';

const HAND_PADDING = 6;
const HAND_HEADER_HEIGHT = 20;

interface Box {
  width: number;
  height: number;
}

export function GameScreen() {
  const { game, connected, busy, error, act, leave } = useGame();
  const { playerId } = useProfile();
  const window = useWindowDimensions();
  /** Measured space inside the screen padding; the window size is only the first guess. */
  const [box, setBox] = useState<Box | null>(null);
  /** The targeted action the player has picked and not yet aimed at anyone. */
  const [targeting, setTargeting] = useState<TargetedAction | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const closeLog = useCallback(() => setLogOpen(false), []);

  const measure = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox(current =>
      current && current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  // Targeting only makes sense while this player may declare that action. The moment
  // that stops being true (the turn moved on, the game ended) it is dropped for good,
  // so it cannot come back to life on a later turn.
  const stillAllowed =
    !!game &&
    targeting !== null &&
    availableActions(game, playerId).includes(targeting);
  if (targeting !== null && !stillAllowed) {
    setTargeting(null);
  }
  const aiming = stillAllowed ? targeting : null;

  if (!game) {
    return null;
  }

  const me = game.players[playerId];
  if (!me) {
    return (
      <Screen>
        <View style={styles.centre}>
          <Panel style={styles.notice}>
            <Text
              style={styles.noticeText}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              You are not a player in this game.
            </Text>
            <Button label="Back to Home" onPress={leave} />
          </Panel>
        </View>
      </Screen>
    );
  }

  const confirmQuit = () =>
    Alert.alert(
      'Leave this game?',
      `The others will be waiting for your moves. You can rejoin with code ${game.code}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leave },
      ],
    );

  /** Every tap that reaches the server ends targeting, whatever it was. */
  const send = (action: GameAction) => {
    setTargeting(null);
    act(action);
  };

  const { phase, pending, currentTurnPlayer, turnNumber } = game.state;
  const disabled = !connected || busy;
  const opponents = game.playerOrder.filter(id => id !== playerId);
  const targets = aiming
    ? livingPlayers(game).filter(id => id !== playerId)
    : [];
  const out = unrevealedCount(me) === 0;
  const mustLose =
    phase === 'loseInfluence' && pending?.loseInfluence?.playerId === playerId;
  const exchangeOptions =
    phase === 'exchange' && pending?.actor === playerId
      ? pending.exchangeOptions
      : null;
  const responding = responseOptions(game, playerId) !== null;

  const line = viewerLine(game, playerId);
  const primary = aiming
    ? `${ACTION_LABEL[aiming]}: tap a player above`
    : line.text;
  const latest = game.log.length > 0 ? game.log[game.log.length - 1] : null;

  const layout = tableLayout(
    box?.width ?? window.width - 2 * COMPACT_PADDING.horizontal,
    box?.height ?? window.height - 2 * COMPACT_PADDING.vertical,
    opponents.length,
  );
  const seatRows: string[][] = [];
  for (let start = 0; start < opponents.length; start += layout.seatsPerRow) {
    seatRows.push(opponents.slice(start, start + layout.seatsPerRow));
  }

  return (
    <Screen compact>
      <View style={styles.table} onLayout={measure}>
        <View
          style={styles.regions}
          accessibilityElementsHidden={logOpen}
          importantForAccessibility={logOpen ? 'no-hide-descendants' : 'auto'}
        >
          <TopBar
            turn={turnNumber}
            deck={game.deck.length}
            code={game.code}
            connected={connected}
            onLeave={confirmQuit}
          />

          <View style={styles.seats}>
            {seatRows.map((row, index) => (
              <View key={index} style={styles.seatRow}>
                {row.map(id => (
                  <Seat
                    key={id}
                    testID={`seat-${id}`}
                    player={game.players[id]}
                    isTurn={id === currentTurnPlayer}
                    compact={layout.compactSeats}
                    width={layout.seatWidth}
                    target={
                      aiming && targets.includes(id)
                        ? {
                            verb: ACTION_LABEL[aiming],
                            disabled,
                            onPress: () =>
                              send({ type: aiming, playerId, target: id }),
                          }
                        : null
                    }
                  />
                ))}
              </View>
            ))}
          </View>

          <EventBanner
            primary={primary}
            secondary={latest}
            error={error}
            yours={line.yours}
            onPress={() => setLogOpen(true)}
          />

          <View style={[styles.bottom, { height: layout.bottomHeight }]}>
            <View
              style={[
                styles.hand,
                { width: layout.handWidth },
                line.yours && styles.handActive,
              ]}
            >
              <View style={styles.handHeader}>
                <Text
                  style={[styles.you, line.yours && styles.youActive]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={DENSE_FONT_SCALE}
                >
                  YOU
                </Text>
                <Coins count={me.coins} size="md" />
              </View>
              <View style={styles.handCards}>
                {me.influence.map((influence, index) => (
                  <CharacterCard
                    key={index}
                    card={influence.card}
                    lost={influence.revealed}
                    abilityLines={layout.handAbilityLines}
                  />
                ))}
              </View>
            </View>

            <View style={styles.controls}>
              {out ? (
                <Panel style={styles.outPanel}>
                  <Text
                    style={styles.outTitle}
                    maxFontSizeMultiplier={DENSE_FONT_SCALE}
                  >
                    You are out
                  </Text>
                  <Text
                    style={styles.outText}
                    maxFontSizeMultiplier={DENSE_FONT_SCALE}
                  >
                    Both of your cards are lost. You can keep watching.
                  </Text>
                </Panel>
              ) : exchangeOptions ? (
                <ExchangePicker
                  key={`exchange-${turnNumber}`}
                  options={exchangeOptions}
                  keepCount={unrevealedCount(me)}
                  disabled={disabled}
                  onConfirm={keep =>
                    send({ type: 'exchangeChoose', playerId, keep })
                  }
                />
              ) : mustLose ? (
                <LoseInfluencePicker
                  player={me}
                  disabled={disabled}
                  onPick={cardIndex =>
                    send({ type: 'loseInfluence', playerId, cardIndex })
                  }
                />
              ) : responding ? (
                <ResponseBar
                  game={game}
                  playerId={playerId}
                  disabled={disabled}
                  onAction={send}
                />
              ) : (
                <ActionGrid
                  game={game}
                  playerId={playerId}
                  disabled={disabled}
                  targeting={aiming}
                  onAction={send}
                  onTargeting={setTargeting}
                />
              )}
            </View>
          </View>
        </View>

        <LogSheet visible={logOpen} log={game.log} onClose={closeLog} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1 },
  regions: { flex: 1, gap: REGION_GAP },
  seats: { gap: SEAT_GAP },
  seatRow: { flexDirection: 'row', justifyContent: 'center', gap: SEAT_GAP },
  bottom: { flexDirection: 'row' },
  hand: {
    padding: HAND_PADDING,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  handActive: { borderColor: colors.primary },
  handHeader: {
    height: HAND_HEADER_HEIGHT,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  you: { ...typography.micro, color: colors.muted },
  youActive: { color: colors.primary },
  handCards: { flex: 1, flexDirection: 'row', gap: 6 },
  controls: { flex: 1, marginLeft: spacing.sm },
  outPanel: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outTitle: { ...typography.heading, color: colors.text },
  outText: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notice: { alignItems: 'center', padding: spacing.lg },
  noticeText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
});
