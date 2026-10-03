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

interface Props {
  /** The character that was claimed and challenged. */
  card: Card;
  /** Whether the claimant really held it. */
  truthful: boolean;
  /** "Maria had the Duke" / "Maria was bluffing — no Duke". */
  headline: string;
  /** "Erik loses a card". */
  consequence: string;
  onDismiss: () => void;
}

/**
 * The moment a challenge is settled, large and in the middle of the table.
 * The screen mounts it for a couple of seconds only; a tap anywhere ends it
 * sooner. It shows nothing the public log does not already say.
 */
export function RevealOverlay({
  card,
  truthful,
  headline,
  consequence,
  onDismiss,
}: Props) {
  const palette = characterColors[card];
  const appear = useAppear();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${consequence}. Tap to dismiss`}
      accessibilityLiveRegion="assertive"
      onPress={onDismiss}
      testID="reveal-overlay"
      style={styles.scrim}
    >
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: palette.fill, borderColor: palette.accent },
          appear,
        ]}
      >
        <View style={[styles.well, !truthful && styles.wellBluff]}>
          <CharacterGlyph
            card={card}
            size={GLYPH}
            color={palette.accent}
            cutout={palette.fill}
          />
          {!truthful && <View style={styles.strike} />}
        </View>
        <Text
          style={[styles.verdict, { color: palette.accent }]}
          maxFontSizeMultiplier={READING_FONT_SCALE}
        >
          {truthful ? 'TRUE CLAIM' : 'BLUFF'}
        </Text>
        <Text
          style={styles.headline}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={READING_FONT_SCALE}
        >
          {headline}
        </Text>
        <Text
          style={styles.consequence}
          numberOfLines={2}
          maxFontSizeMultiplier={READING_FONT_SCALE}
        >
          {consequence}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrimLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  well: {
    width: GLYPH + 28,
    height: GLYPH + 28,
    borderRadius: (GLYPH + 28) / 2,
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  wellBluff: { opacity: 0.85 },
  /** A bar across the emblem: the character was not there. */
  strike: {
    position: 'absolute',
    width: GLYPH + 20,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.danger,
    transform: [{ rotate: '-45deg' }],
  },
  verdict: { ...typography.micro, marginBottom: spacing.xs },
  headline: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  consequence: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
