import React from 'react';
import { StyleSheet, View } from 'react-native';
import { responseOptions } from '../engine/rules';
import { Game, GameAction } from '../engine/types';
import { characterColors, colors } from '../theme';
import { ActionTile } from './ActionTile';
import { CharacterGlyph } from './CharacterGlyph';
import { TILE_GAP } from './tableLayout';

interface Props {
  game: Game;
  playerId: string;
  disabled: boolean;
  /** Most tiles side by side; more than that wrap to a second row (portrait). Unlimited by default. */
  columns?: number;
  onAction: (action: GameAction) => void;
}

const PASS_PALETTE = { fill: colors.surfaceRaised, accent: colors.muted };
const CHALLENGE_PALETTE = { fill: colors.dangerFill, accent: colors.danger };

/**
 * Pass / Challenge / Block as large tiles, in the slot the action grid uses.
 * Renders nothing when this player is not being asked. The question itself is
 * shown by the event banner.
 */
export function ResponseBar({
  game,
  playerId,
  disabled,
  columns,
  onAction,
}: Props) {
  const options = responseOptions(game, playerId);
  if (!options) {
    return null;
  }
  const { phase, pending, claimSeq } = game.state;
  // Ties the tap to the prompt on screen: the engine rejects it if the game has moved on meanwhile.
  const seq = claimSeq;
  const doubted =
    phase === 'awaitingBlockResponses' ? pending?.block?.claim : pending?.claim;

  const tiles: React.ReactNode[] = [
    <ActionTile
      key="pass"
      testID="response-pass"
      size="large"
      label="Pass"
      detail="Let it happen"
      accessibilityLabel="Pass, let it happen"
      palette={PASS_PALETTE}
      disabled={disabled}
      onPress={() => onAction({ type: 'pass', playerId, seq })}
    />,
  ];
  if (options.canChallenge) {
    tiles.push(
      <ActionTile
        key="challenge"
        testID="response-challenge"
        size="large"
        label="Challenge"
        detail={doubted ? `Doubt the ${doubted}` : 'Call the bluff'}
        accessibilityLabel={
          doubted
            ? `Challenge, doubt the ${doubted} claim`
            : 'Challenge, call the bluff'
        }
        palette={CHALLENGE_PALETTE}
        disabled={disabled}
        onPress={() => onAction({ type: 'challenge', playerId, seq })}
      />,
    );
  }
  options.blockClaims.forEach(claim =>
    tiles.push(
      <ActionTile
        key={claim}
        testID={`response-block-${claim}`}
        size="large"
        label="Block"
        detail={`as ${claim}`}
        accessibilityLabel={`Block as ${claim}, claims ${claim}`}
        palette={characterColors[claim]}
        icon={
          <CharacterGlyph
            card={claim}
            size={20}
            color={characterColors[claim].accent}
            cutout={characterColors[claim].fill}
          />
        }
        disabled={disabled}
        onPress={() => onAction({ type: 'block', playerId, claim, seq })}
      />,
    ),
  );

  const perRow = columns && tiles.length > columns ? columns : tiles.length;
  const rows: React.ReactNode[][] = [];
  for (let start = 0; start < tiles.length; start += perRow) {
    rows.push(tiles.slice(start, start + perRow));
  }

  return (
    <View style={styles.bar}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, gap: TILE_GAP },
  row: { flex: 1, flexDirection: 'row', gap: TILE_GAP },
});
