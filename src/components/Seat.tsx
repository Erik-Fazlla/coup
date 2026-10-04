import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { unrevealedCount } from '../engine/rules';
import { Influence, Player } from '../engine/types';
import { colors, DENSE_FONT_SCALE, radius, typography } from '../theme';
import { useFlip } from '../ui/motion';
import { CardBack } from './CardBack';
import { Coins } from './Coins';
import { MiniCard } from './MiniCard';
import { OnlineDot } from './OnlineDot';
import { SEAT_HEIGHT, SMALL_SEAT_NAME_BELOW } from './tableLayout';

export interface SeatTarget {
  /** The action being aimed, e.g. "Steal". */
  verb: string;
  disabled: boolean;
  onPress: () => void;
}

interface Props {
  player: Player;
  isTurn: boolean;
  /** Shorter tag text ("TAP"), and on a narrow seat a smaller name. */
  compact?: boolean;
  width?: number;
  /** Below the regular seat height the seat drops most of its padding and uses the smaller name. */
  height?: number;
  /** Set only while the local player is choosing a target and this player is a legal one. */
  target?: SeatTarget | null;
  /** Whether this player's phone is connected; null or missing draws no dot. */
  online?: boolean | null;
  testID?: string;
}

/** Vertical padding of a slim seat: its 48 hold the border, a 15 name line and the 24 cards. */
const SLIM_PADDING = 2;

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
  height = SEAT_HEIGHT,
  target = null,
  online = null,
  testID,
}: Props) {
  const hidden = unrevealedCount(player);
  const lost = player.influence.filter(i => i.revealed).map(i => i.card);
  const out = hidden === 0;
  // The short tag is used at every width; the smaller name only where the seat really is narrow.
  const slim = height < SEAT_HEIGHT;
  const smallName =
    slim || (compact && (width === undefined || width < SMALL_SEAT_NAME_BELOW));

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
    slim && { height, paddingVertical: SLIM_PADDING },
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
          style={[styles.name, smallName && styles.nameCompact]}
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
  // The header row has a definite width (the seat's). The name takes what the dot and the
  // tag leave and is the one that gives way (ellipsis); the tag keeps its full width.
  name: {
    ...typography.label,
    flex: 1,
    flexShrink: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
  },
  nameCompact: { fontSize: 12, lineHeight: 15 },
  tag: {
    ...typography.micro,
    fontSize: 9,
    flexShrink: 0,
    marginLeft: 3,
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
