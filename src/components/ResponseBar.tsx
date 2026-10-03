import React from 'react';
import { StyleSheet, View } from 'react-native';
import { responseOptions } from '../engine/rules';
import { Game, GameAction } from '../engine/types';
import { characterColors, colors } from '../theme';
import { ActionTile } from './ActionTile';
import { CharacterGlyph } from './CharacterGlyph';

interface Props {
  game: Game;
  playerId: string;
  disabled: boolean;
  onAction: (action: GameAction) => void;
}

const PASS_PALETTE = { fill: colors.surfaceRaised, accent: colors.muted };
const CHALLENGE_PALETTE = { fill: colors.dangerFill, accent: colors.danger };

/**
 * Pass / Challenge / Block as large tiles, in the slot the action grid uses.
 * Renders nothing when this player is not being asked. The question itself is
 * shown by the event banner.
 */
export function ResponseBar({ game, playerId, disabled, onAction }: Props) {
  const options = responseOptions(game, playerId);
  if (!options) {
    return null;
  }
  const { phase, pending, claimSeq } = game.state;
  // Ties the tap to the prompt on screen: the engine rejects it if the game has moved on meanwhile.
  const seq = claimSeq;
  const doubted =
    phase === 'awaitingBlockResponses' ? pending?.block?.claim : pending?.claim;

  return (
    <View style={styles.bar}>
      <ActionTile
        testID="response-pass"
        size="large"
        label="Pass"
        detail="Let it happen"
        accessibilityLabel="Pass, let it happen"
        palette={PASS_PALETTE}
        disabled={disabled}
        onPress={() => onAction({ type: 'pass', playerId, seq })}
      />
      {options.canChallenge && (
        <ActionTile
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
        />
      )}
      {options.blockClaims.map(claim => (
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
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, flexDirection: 'row', gap: 6 },
});
