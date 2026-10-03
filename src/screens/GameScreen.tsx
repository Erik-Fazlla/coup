import React, { useCallback, useState } from 'react';
import {
  Alert,
  Animated,
  LayoutChangeEvent,
  Pressable,
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
import { RevealOverlay } from '../components/RevealOverlay';
import { RulesSheet } from '../components/RulesSheet';
import { COMPACT_PADDING, Screen } from '../components/Screen';
import { Seat } from '../components/Seat';
import {
  BANNER_MIN_HEIGHT,
  REGION_GAP,
  SEAT_GAP,
  tableLayout,
  TILE_GAP,
} from '../components/tableLayout';
import { TopBar } from '../components/TopBar';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { useSettings } from '../context/SettingsContext';
import {
  ACTION_LABEL,
  revealLine,
  revealLoserLine,
  viewerLine,
  waitingNames,
} from '../engine/describe';
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
import { usePulse } from '../ui/motion';
import { isOnline, knownPresence } from '../ui/presence';
import { useRevealOnce } from '../ui/reveal';
import { useGameSounds } from '../ui/soundCues';
import { useStalled, waitKey } from '../ui/stalled';
import { useTurnBuzz } from '../ui/turnBuzz';

const HAND_PADDING = 6;
const HAND_HEADER_HEIGHT = 20;
const HAND_SIDE_WIDTH = 58;

interface Box {
  width: number;
  height: number;
}

export function GameScreen() {
  const { game, connected, busy, error, online, act, leave, skip } = useGame();
  const { playerId } = useProfile();
  const { settings } = useSettings();
  const window = useWindowDimensions();
  /** Measured space inside the screen padding; the window size is only the first guess. */
  const [box, setBox] = useState<Box | null>(null);
  /** The targeted action the player has picked and not yet aimed at anyone. */
  const [targeting, setTargeting] = useState<TargetedAction | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const closeLog = useCallback(() => setLogOpen(false), []);
  const closeRules = useCallback(() => setRulesOpen(false), []);

  const measure = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox(current =>
      current && current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  const playing = !!game && !!game.players[playerId];
  const line = game && playing ? viewerLine(game, playerId) : null;
  const yours = line?.yours ?? false;
  const isHost = !!game && game.host === playerId;

  // The phone buzzes once when it becomes this player's moment, if they want it to.
  useTurnBuzz(playing ? game : null, playerId, settings.vibration);
  // Sound effects for what each new snapshot brings, if they want those.
  useGameSounds(playing ? game : null, playerId);
  const { reveal, dismiss: dismissReveal } = useRevealOnce(game);
  // Only the host's own clock matters: nobody else is offered the skip.
  const stalled = useStalled(isHost && playing ? waitKey(game) : null);
  const pulse = usePulse(yours);

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
  if (!me || !line) {
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

  const waitingFor = waitingNames(game);
  const confirmSkip = () =>
    Alert.alert(
      `Skip ${waitingFor}?`,
      'The game makes the simplest move for them so everyone can carry on.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: () => skip() },
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
  const presence = knownPresence(online, playerId);
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
  const canSkip = stalled && waitingFor.length > 0;

  const primary = aiming
    ? `${ACTION_LABEL[aiming]}: tap a player above`
    : line.text;
  const latest = game.log.length > 0 ? game.log[game.log.length - 1] : null;

  const layout = tableLayout(
    box?.width ?? window.width - 2 * COMPACT_PADDING.horizontal,
    box?.height ?? window.height - 2 * COMPACT_PADDING.vertical,
    opponents.length,
  );
  const { portrait } = layout;
  const seatRows: string[][] = [];
  for (let start = 0; start < opponents.length; start += layout.seatsPerRow) {
    seatRows.push(opponents.slice(start, start + layout.seatsPerRow));
  }
  const sheetOpen = logOpen || rulesOpen;

  return (
    <Screen compact>
      <View style={styles.table} onLayout={measure}>
        <View
          style={styles.regions}
          accessibilityElementsHidden={sheetOpen}
          importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}
        >
          <TopBar
            turn={turnNumber}
            deck={game.deck.length}
            code={game.code}
            connected={connected}
            compact={portrait}
            onRules={() => setRulesOpen(true)}
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
                    online={isOnline(presence, id)}
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

          <View style={styles.bannerRow}>
            <EventBanner
              primary={primary}
              secondary={latest}
              error={error}
              yours={yours}
              onPress={() => setLogOpen(true)}
            />
            {canSkip && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Skip ${waitingFor}`}
                accessibilityHint="Host only. Makes the simplest move for them."
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={confirmSkip}
                testID="skip"
                style={({ pressed }) => [
                  styles.skip,
                  pressed && styles.pressed,
                  disabled && styles.skipDisabled,
                ]}
              >
                <Text
                  style={styles.skipLabel}
                  maxFontSizeMultiplier={DENSE_FONT_SCALE}
                >
                  SKIP
                </Text>
                <Text
                  style={styles.skipNames}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  maxFontSizeMultiplier={DENSE_FONT_SCALE}
                >
                  {waitingFor}
                </Text>
              </Pressable>
            )}
          </View>

          <View
            style={[
              portrait ? styles.bottomPortrait : styles.bottom,
              { height: layout.bottomHeight },
            ]}
          >
            <View
              style={[
                styles.hand,
                portrait
                  ? [styles.handPortrait, { height: layout.handHeight }]
                  : { width: layout.handWidth },
              ]}
            >
              {yours && (
                // The one looping animation: the outline breathes while the game waits for this player.
                <Animated.View
                  pointerEvents="none"
                  style={[styles.handGlow, { opacity: pulse }]}
                />
              )}
              <View style={portrait ? styles.handSide : styles.handHeader}>
                <Text
                  style={[styles.you, yours && styles.youActive]}
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

            <View
              style={
                portrait
                  ? { height: layout.controlsHeight }
                  : styles.controlsBeside
              }
            >
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
                  stacked={portrait}
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
                  columns={portrait ? 2 : undefined}
                  onAction={send}
                />
              ) : (
                <ActionGrid
                  game={game}
                  playerId={playerId}
                  disabled={disabled}
                  targeting={aiming}
                  columns={layout.actionColumns}
                  onAction={send}
                  onTargeting={setTargeting}
                />
              )}
            </View>
          </View>
        </View>

        <LogSheet visible={logOpen} log={game.log} onClose={closeLog} />
        <RulesSheet visible={rulesOpen} onClose={closeRules} />
        {reveal && (
          <RevealOverlay
            card={reveal.card}
            truthful={reveal.truthful}
            headline={revealLine(game)}
            consequence={revealLoserLine(game)}
            onDismiss={dismissReveal}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1 },
  regions: { flex: 1, gap: REGION_GAP },
  seats: { gap: SEAT_GAP },
  seatRow: { flexDirection: 'row', justifyContent: 'center', gap: SEAT_GAP },
  bannerRow: {
    flex: 1,
    minHeight: BANNER_MIN_HEIGHT,
    flexDirection: 'row',
    gap: REGION_GAP,
  },
  skip: {
    minWidth: 88,
    maxWidth: '40%',
    minHeight: BANNER_MIN_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.coin,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipDisabled: { opacity: 0.4 },
  skipLabel: { ...typography.micro, color: colors.coin },
  skipNames: { ...typography.label, color: colors.text },
  pressed: { opacity: 0.7 },
  bottom: { flexDirection: 'row' },
  bottomPortrait: { gap: REGION_GAP },
  hand: {
    padding: HAND_PADDING,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  handPortrait: { flexDirection: 'row' },
  // Drawn over the hand's own border, so only its opacity has to change.
  handGlow: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  handHeader: {
    height: HAND_HEADER_HEIGHT,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handSide: {
    width: HAND_SIDE_WIDTH,
    marginRight: TILE_GAP,
    paddingLeft: 2,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  you: { ...typography.micro, color: colors.muted },
  youActive: { color: colors.primary },
  handCards: { flex: 1, flexDirection: 'row', gap: TILE_GAP },
  controlsBeside: { flex: 1, marginLeft: spacing.sm },
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
