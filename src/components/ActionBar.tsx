import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ACTION_BUTTON, ACTION_LABEL } from '../engine/describe';
import { availableActions, livingPlayers, TARGETED } from '../engine/rules';
import {
  ActionType,
  Game,
  GameAction,
  TargetedAction,
  UntargetedAction,
} from '../engine/types';
import { colors, spacing } from '../theme';
import { Button } from './Button';

interface Props {
  game: Game;
  playerId: string;
  disabled: boolean;
  onAction: (action: GameAction) => void;
}

function isTargeted(action: ActionType): action is TargetedAction {
  return TARGETED.includes(action);
}

/** The current player's action buttons. Renders nothing when it is not this player's turn to act. */
export function ActionBar({ game, playerId, disabled, onAction }: Props) {
  const [targeting, setTargeting] = useState<TargetedAction | null>(null);
  const actions = availableActions(game, playerId);

  if (actions.length === 0) {
    return null;
  }

  if (targeting) {
    const opponents = livingPlayers(game).filter(id => id !== playerId);
    return (
      <View>
        <Text style={styles.prompt}>
          {ACTION_LABEL[targeting]}: choose a target
        </Text>
        {/* Its own key: without it React reuses the action row's ScrollView, which keeps
            its scroll offset and leaves these few buttons out of view. */}
        <ScrollView
          key="targets"
          horizontal
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.row}
        >
          <Button
            label="Back"
            variant="secondary"
            onPress={() => setTargeting(null)}
          />
          {opponents.map(id => (
            <Button
              key={id}
              label={game.players[id].name}
              disabled={disabled}
              onPress={() => {
                setTargeting(null);
                onAction({ type: targeting, playerId, target: id });
              }}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.prompt}>
        {actions.length === 1
          ? 'You have 10 or more coins: you must Coup'
          : 'Your turn: choose an action'}
      </Text>
      <ScrollView
        key="actions"
        horizontal
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {actions.map(action => (
          <Button
            key={action}
            label={ACTION_BUTTON[action]}
            disabled={disabled}
            onPress={() =>
              isTargeted(action)
                ? setTargeting(action)
                : onAction({ type: action as UntargetedAction, playerId })
            }
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
