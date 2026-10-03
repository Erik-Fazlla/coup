import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ACTION_DETAIL,
  ACTION_EFFECT,
  ACTION_LABEL,
  unavailableReason,
} from '../engine/describe';
import { ACTION_CLAIM, TARGETED } from '../engine/rules';
import {
  ActionType,
  Game,
  GameAction,
  TargetedAction,
  UntargetedAction,
} from '../engine/types';
import { characterColors, colors, neutralPalette } from '../theme';
import { ActionTile } from './ActionTile';

/** Untargeted actions first, then the three that need a target, then the spare cell that becomes Back. */
const ORDER: ActionType[] = [
  'income',
  'foreignAid',
  'tax',
  'exchange',
  'steal',
  'assassinate',
  'coup',
];

const GAP = 6;

interface Props {
  game: Game;
  playerId: string;
  /** Offline or waiting for the server: nothing may be sent. */
  disabled: boolean;
  /** The targeted action the player is currently aiming, owned by the screen. */
  targeting: TargetedAction | null;
  /** 4 in landscape, 2 in portrait. */
  columns?: number;
  onAction: (action: GameAction) => void;
  onTargeting: (action: TargetedAction | null) => void;
}

function isTargeted(action: ActionType): action is TargetedAction {
  return TARGETED.includes(action);
}

/**
 * All seven actions, always on screen, never scrolling. Actions the player may
 * not take are dimmed, with the reason in the accessibility label. A targeted
 * action is not sent from here: it enters targeting mode and the player then
 * taps an opponent's seat.
 */
export function ActionGrid({
  game,
  playerId,
  disabled,
  targeting,
  columns = 4,
  onAction,
  onTargeting,
}: Props) {
  const cells: React.ReactNode[] = ORDER.map(action => {
    const claim = ACTION_CLAIM[action];
    const reason =
      unavailableReason(game, playerId, action) ??
      (disabled ? 'waiting for the server' : null);
    const spoken = [
      ACTION_LABEL[action],
      ACTION_DETAIL[action],
      claim ? `claims ${claim}` : 'no claim',
    ].join(', ');
    return (
      <ActionTile
        key={action}
        testID={`action-${action}`}
        label={ACTION_LABEL[action]}
        detail={
          claim ? `${ACTION_EFFECT[action]} · ${claim}` : ACTION_EFFECT[action]
        }
        accessibilityLabel={
          reason ? `${spoken}. Unavailable: ${reason}` : spoken
        }
        palette={claim ? characterColors[claim] : neutralPalette}
        selected={targeting === action}
        disabled={reason !== null}
        onPress={() =>
          isTargeted(action)
            ? onTargeting(action)
            : onAction({ type: action as UntargetedAction, playerId })
        }
      />
    );
  });

  cells.push(
    targeting ? (
      <ActionTile
        key="back"
        testID="action-back"
        label="Back"
        detail="Cancel"
        accessibilityLabel={`Back, cancel ${ACTION_LABEL[targeting]}`}
        palette={{ fill: colors.background, accent: colors.muted }}
        onPress={() => onTargeting(null)}
      />
    ) : (
      <View key="spare" style={styles.spare} />
    ),
  );

  const rows: React.ReactNode[][] = [];
  for (let start = 0; start < cells.length; start += columns) {
    rows.push(cells.slice(start, start + columns));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1, gap: GAP },
  row: { flex: 1, flexDirection: 'row', gap: GAP },
  spare: { flex: 1 },
});
