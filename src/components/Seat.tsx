import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { unrevealedCount } from '../engine/rules';
import { Influence, Player } from '../engine/types';
import {
  colors,
  DENSE_FONT_SCALE,
  radius,
  spacing,
  typography,
} from '../theme';
import { useFlip } from '../ui/motion';
import { CardBack } from './CardBack';
import { Coins } from './Coins';
import { MiniCard } from './MiniCard';
import { OnlineDot } from './OnlineDot';
import { SEAT_HEIGHT } from './tableLayout';

export interface SeatTarget {
  /** The action being aimed, e.g. "Steal". */
  verb: string;
  disabled: boolean;
  onPress: () => void;
}

interface Props {
  player: Player;
  isTurn: boolean;
  /** Narrow seat: shorter tag text. */
  compact?: boolean;
  width?: number;
  /** Set only while the local player is choosing a target and this player is a legal one. */
  target?: SeatTarget | null;
  /** Whether this player's phone is connected; null or missing draws no dot. */
  online?: boolean | null;
  testID?: string;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * One of an opponent's two cards: a back while hidden, turning over to the
 * lost card when it is revealed. The face is drawn only for a card that is
 * revealed right now, so a hidden card can never show through the animation.
 */
function SeatCard({ influence }: { influence: Influence }) {
  const flip = useFlip(influence.revealed);
  return (
    <Animated.View style={flip.style}>
      {flip.shown && influence.revealed ? (
        <MiniCard card={influence.card} />
      ) : (
        <CardBack />
      )}
    </Animated.View>
  );
}

/**
 * One opponent: name, coins, face-down cards and the cards they have lost.
 * Hidden cards are drawn as backs; their names are never rendered or spoken.
 */
export function Seat({
  player,
  isTurn,
  compact = false,
  width,
  target = null,
  online = null,
  testID,
}: Props) {
  const hidden = unrevealedCount(player);
  const lost = player.influence.filter(i => i.revealed).map(i => i.card);
  const out = hidden === 0;

  const summary = [
    player.name,
    out
      ? 'out'
      : `${plural(player.coins, 'coin')}, ${plural(hidden, 'hidden card')}`,
    lost.length > 0 ? `lost ${lost.join(' and ')}` : null,
    isTurn ? 'their turn' : null,
    online === null ? null : online ? 'online' : 'offline',
  ]
    .filter(Boolean)
    .join(', ');

  const tag = target
    ? { text: compact ? 'TAP' : 'TAP TO TARGET', style: styles.tagTarget }
    : isTurn
    ? { text: 'TURN', style: styles.tagTurn }
    : null;

  const frame = [
    styles.seat,
    width === undefined ? styles.fill : { width },
    isTurn && styles.turn,
    out && styles.out,
    target && styles.targetable,
    target?.disabled && styles.disabled,
  ];

  const content = (
    <>
      <View style={styles.header}>
        {online !== null && <OnlineDot online={online} />}
        <Text
          style={[styles.name, compact && styles.nameCompact]}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={DENSE_FONT_SCALE}
        >
          {player.name}
        </Text>
        {tag && (
          <Text
            style={[styles.tag, tag.style]}
            numberOfLines={1}
            maxFontSizeMultiplier={DENSE_FONT_SCALE}
          >
            {tag.text}
          </Text>
        )}
      </View>
      <View style={styles.detail}>
        {out ? (
          <Text style={styles.outText} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
            OUT
          </Text>
        ) : (
          <Coins count={player.coins} size="sm" />
        )}
        <View style={styles.cards}>
          {player.influence.map((influence, index) => (
            <SeatCard key={index} influence={influence} />
          ))}
        </View>
      </View>
    </>
  );

  if (!target) {
    return (
      <View
        accessible
        accessibilityLabel={summary}
        testID={testID}
        style={frame}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${target.verb}: ${summary}. Tap to target`}
      accessibilityState={{ disabled: target.disabled }}
      disabled={target.disabled}
      onPress={target.onPress}
      testID={testID}
      style={({ pressed }) => [frame, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seat: {
    height: SEAT_HEIGHT,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
  },
  fill: { flex: 1 },
  turn: { borderColor: colors.coin },
  out: { opacity: 0.5, borderStyle: 'dashed' },
  targetable: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFill,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center' },
  name: {
    ...typography.label,
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
  },
  nameCompact: { fontSize: 12, lineHeight: 15 },
  tag: {
    ...typography.micro,
    fontSize: 9,
    marginLeft: spacing.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tagTurn: { color: colors.onLight, backgroundColor: colors.coin },
  tagTarget: { color: colors.onLight, backgroundColor: colors.primary },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outText: { ...typography.micro, color: colors.muted },
  cards: { flexDirection: 'row', gap: 3 },
});
