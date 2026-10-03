import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import {
  characterColors,
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';
import { useAppear } from '../ui/motion';
import { CharacterGlyph } from './CharacterGlyph';

const GLYPH = 56;
const GLYPH_COMPACT = 40;
const WELL_MARGIN = 28;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  /** The character that was claimed and challenged. */
  card: Card;
  /** Whether the claimant really held it. */
  truthful: boolean;
  /** "Maria had the Duke" / "Maria was bluffing — no Duke". */
  headline: string;
  /** "Erik loses a card". */
  consequence: string;
  /** Height at the bottom of the table to keep clear: the hand and the actions. */
  bottomInset?: number;
  /** Little height above `bottomInset`: emblem beside the text instead of over it. */
  compact?: boolean;
  onDismiss: () => void;
}

/**
 * The moment a challenge is settled, large and above the hand. The screen
 * mounts it for a couple of seconds only; a tap on the card ends it sooner.
 * It shows nothing the public log does not already say.
 *
 * It never gets in the way of playing: the loser of a challenge must pick a
 * card at once, so only the card itself takes touches. Everything else, the
 * dimmed table included, lets them through to what is underneath.
 */
export function RevealOverlay({
  card,
  truthful,
  headline,
  consequence,
  bottomInset = 0,
  compact = false,
  onDismiss,
}: Props) {
  const palette = characterColors[card];
  const appear = useAppear();
  const glyph = compact ? GLYPH_COMPACT : GLYPH;
  const well = glyph + WELL_MARGIN;
  return (
    <View pointerEvents="box-none" style={styles.fill}>
      <View
        pointerEvents="none"
        testID="reveal-scrim"
        style={[styles.fill, styles.scrim]}
      />
      <View
        pointerEvents="box-none"
        testID="reveal-region"
        style={[styles.region, { bottom: bottomInset }]}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={`${headline}. ${consequence}. Tap to dismiss`}
          accessibilityLiveRegion="assertive"
          onPress={onDismiss}
          testID="reveal-overlay"
          style={[
            styles.card,
            compact && styles.cardCompact,
            { backgroundColor: palette.fill, borderColor: palette.accent },
            appear,
          ]}
        >
          <View
            style={[
              styles.well,
              { width: well, height: well, borderRadius: well / 2 },
              compact ? styles.wellCompact : styles.wellStacked,
              !truthful && styles.wellBluff,
            ]}
          >
            <CharacterGlyph
              card={card}
              size={glyph}
              color={palette.accent}
              cutout={palette.fill}
            />
            {!truthful && (
              <View style={[styles.strike, { width: glyph + 20 }]} />
            )}
          </View>
          <View style={compact ? styles.wordsCompact : styles.words}>
            <Text
              style={[styles.verdict, { color: palette.accent }]}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {truthful ? 'TRUE CLAIM' : 'BLUFF'}
            </Text>
            <Text
              style={[styles.headline, compact && styles.headlineCompact]}
              numberOfLines={compact ? 2 : 3}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {headline}
            </Text>
            <Text
              style={[styles.consequence, compact && styles.left]}
              numberOfLines={compact ? 1 : 2}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {consequence}
            </Text>
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scrim: { backgroundColor: colors.scrimLight },
  // Everything above the hand and the actions; the card is centred in it. Pinned on all
  // four sides, so its size is definite and the card's percentages have something to resolve against.
  region: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    // Never taller than the region: on a very short screen the bottom is cut off
    // rather than laid over the cards the player has to tap.
    maxHeight: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  cardCompact: {
    maxWidth: 420,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  well: {
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellStacked: { marginBottom: spacing.sm },
  wellCompact: { marginRight: spacing.md },
  wellBluff: { opacity: 0.85 },
  /** A bar across the emblem: the character was not there. */
  strike: {
    position: 'absolute',
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.danger,
    transform: [{ rotate: '-45deg' }],
  },
  // Stacked: as wide as the card, so the centred lines wrap inside it.
  words: { alignSelf: 'stretch', alignItems: 'center' },
  // Beside the emblem: takes the rest of the row (the card's width is definite) and may shrink.
  wordsCompact: { flex: 1 },
  verdict: { ...typography.micro, marginBottom: spacing.xs },
  headline: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  headlineCompact: { fontSize: 20, textAlign: 'left' },
  consequence: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  left: { textAlign: 'left' },
});
