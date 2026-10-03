import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CharacterStrip } from '../components/CharacterStrip';
import { Panel } from '../components/Panel';
import { Scoreboard } from '../components/Scoreboard';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { eliminationLines } from '../engine/describe';
import { colors, READING_FONT_SCALE, spacing, typography } from '../theme';
import { useIsPortrait } from '../ui/orientation';
import { useGameSounds } from '../ui/soundCues';

export function GameOverScreen() {
  const { game, gameId, connected, busy, error, leave, rematch } = useGame();
  const { playerId, recordResult } = useProfile();
  const portrait = useIsPortrait();
  const winner = game?.winner ?? null;
  const played = !!game?.players[playerId];
  const round = game?.round ?? 1;

  // The game screen closes as this one opens; the win or lose sound is played from here.
  useGameSounds(played ? game : null, playerId);

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
  const isHost = game.host === playerId;
  const title = !winner
    ? 'Game over'
    : youWon
    ? 'You win!'
    : `${game.players[winner]?.name ?? 'Someone'} wins`;
  const story = eliminationLines(game);

  return (
    <Screen>
      <View style={portrait ? styles.stack : styles.columns}>
        <Panel
          style={[
            styles.headline,
            !portrait && styles.beside,
            youWon && styles.panelWon,
          ]}
        >
          <CharacterStrip size={26} />
          <Text
            style={[styles.title, youWon && styles.titleWon]}
            numberOfLines={2}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            {title}
          </Text>
          <Text style={styles.meta} maxFontSizeMultiplier={READING_FONT_SCALE}>
            Round {game.round} · {game.state.turnNumber} turns
          </Text>
          {isHost ? (
            <Button
              label="Play again"
              disabled={!connected || busy}
              onPress={rematch}
              testID="play-again"
            />
          ) : (
            <Text
              style={styles.waiting}
              accessibilityLiveRegion="polite"
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              Waiting for the host to start the next round…
            </Text>
          )}
          <Button
            label="Back to Home"
            variant="secondary"
            onPress={leave}
            testID="back-home"
          />
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </Panel>

        <Panel style={[styles.details, !portrait && styles.beside]}>
          <ScrollView contentContainerStyle={styles.detailsContent}>
            <Text style={styles.heading} accessibilityRole="header">
              HOW IT WENT
            </Text>
            {story.length === 0 ? (
              <Text
                style={styles.storyLine}
                maxFontSizeMultiplier={READING_FONT_SCALE}
              >
                Nobody was taken out.
              </Text>
            ) : (
              story.map((entry, index) => (
                <View key={index} style={styles.story}>
                  <Text style={styles.storyNumber} maxFontSizeMultiplier={1.15}>
                    {index + 1}
                  </Text>
                  <Text
                    style={styles.storyLine}
                    maxFontSizeMultiplier={READING_FONT_SCALE}
                  >
                    {entry}
                  </Text>
                </View>
              ))
            )}
            <View style={styles.scores}>
              <Scoreboard game={game} playerId={playerId} />
            </View>
          </ScrollView>
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Landscape: result and buttons on the left, the summary on the right. Portrait: stacked.
  columns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stack: { flex: 1, justifyContent: 'center', gap: spacing.md },
  beside: { flex: 1 },
  headline: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  panelWon: { borderColor: colors.primary },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 32,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  titleWon: { color: colors.primary },
  meta: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  waiting: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // The summary is the part that scrolls when the screen is short; the buttons never do.
  details: { flexShrink: 1, maxHeight: '100%' },
  detailsContent: { paddingBottom: spacing.xs },
  heading: {
    ...typography.micro,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  story: { flexDirection: 'row', paddingVertical: 3 },
  storyNumber: {
    ...typography.caption,
    width: 22,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
  storyLine: { ...typography.body, flex: 1, color: colors.text, fontSize: 14 },
  scores: { marginTop: spacing.md },
});
