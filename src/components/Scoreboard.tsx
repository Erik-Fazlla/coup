import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scoreboard } from '../engine/describe';
import { Game } from '../engine/types';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';

interface Props {
  game: Game;
  /** The local player, whose row is marked. */
  playerId: string;
}

const winsText = (wins: number) => `${wins} win${wins === 1 ? '' : 's'}`;

/** Wins in this lobby across rounds, most first. Used in the lobby and on the Game Over screen. */
export function Scoreboard({ game, playerId }: Props) {
  return (
    <View testID="scoreboard">
      <Text
        style={styles.heading}
        accessibilityRole="header"
        maxFontSizeMultiplier={READING_FONT_SCALE}
      >
        SCOREBOARD · ROUND {game.round}
      </Text>
      {scoreboard(game).map(row => {
        const isYou = row.playerId === playerId;
        return (
          <View
            key={row.playerId}
            testID={`score-${row.playerId}`}
            accessible
            accessibilityLabel={`${row.name}${
              isYou ? ' (you)' : ''
            }: ${winsText(row.wins)}`}
            style={[styles.row, isYou && styles.rowYou]}
          >
            <Text
              style={styles.name}
              numberOfLines={1}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {row.name}
            </Text>
            <Text
              style={[styles.wins, row.wins === 0 && styles.winsNone]}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {winsText(row.wins)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.micro,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  row: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  rowYou: { borderColor: colors.primary },
  name: { ...typography.body, flex: 1, color: colors.text },
  wins: {
    ...typography.label,
    color: colors.coin,
    marginLeft: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  winsNone: { color: colors.muted },
});
