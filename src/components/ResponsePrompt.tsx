import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { promptLine } from '../engine/describe';
import { responseOptions } from '../engine/rules';
import { Game, GameAction } from '../engine/types';
import { colors, spacing } from '../theme';
import { Button } from './Button';

interface Props {
  game: Game;
  playerId: string;
  disabled: boolean;
  onAction: (action: GameAction) => void;
}

/** Pass / Challenge / Block buttons. Renders nothing when this player is not being asked. */
export function ResponsePrompt({ game, playerId, disabled, onAction }: Props) {
  const options = responseOptions(game, playerId);
  if (!options) {
    return null;
  }
  // Ties the tap to the prompt on screen: the engine rejects it if the game has moved on meanwhile.
  const seq = game.state.claimSeq;
  return (
    <View>
      <Text style={styles.prompt}>{promptLine(game)}</Text>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Button
          label="Pass"
          variant="secondary"
          disabled={disabled}
          onPress={() => onAction({ type: 'pass', playerId, seq })}
        />
        {options.canChallenge && (
          <Button
            label="Challenge"
            variant="danger"
            disabled={disabled}
            onPress={() => onAction({ type: 'challenge', playerId, seq })}
          />
        )}
        {options.blockClaims.map(claim => (
          <Button
            key={claim}
            label={`Block as ${claim}`}
            disabled={disabled}
            onPress={() => onAction({ type: 'block', playerId, claim, seq })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    color: colors.text,
    fontSize: 13,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
