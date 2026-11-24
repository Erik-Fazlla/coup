import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from '../engine/types';
import {
  characterColors,
  colors,
  glow,
  neon,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';
import { motionEnabled } from '../ui/motion';
import { CardShade } from './CardShade';
import { CharacterGlyph } from './CharacterGlyph';

const GLYPH = 56;
const GLYPH_COMPACT = 40;
const WELL_MARGIN = 28;

const SCENE_MS = 800;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 0 → 1 over the scene, started on mount; already 1 with motion off. */
function useScene(): Animated.Value {
  const progress = useRef(new Animated.Value(motionEnabled() ? 0 : 1)).current;
  useEffect(() => {
    if (!motionEnabled()) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SCENE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return progress;
}

const part = (
  progress: Animated.Value,
  inputRange: number[],
  outputRange: number[],
) => progress.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });

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
  const progress = useScene();
  // The card turns over into view, then the verdict is stamped on it.
  const cardIn = {
    opacity: part(progress, [0, 0.2], [0, 1]),
    transform: [{ scaleX: part(progress, [0, 0.35], [0.05, 1]) }],
  };
  const stampIn = {
    opacity: part(progress, [0.45, 0.6], [0, 1]),
    transform: [
      { scale: part(progress, [0.45, 0.7], [1.8, 1]) },
      { translateX: 8 },
      { translateY: 10 },
      { rotate: '-10deg' },
    ],
  };
  const verdictColor = truthful ? neon.cyan : colors.danger;
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
            { backgroundColor: palette.fill },
            cardIn,
          ]}
        >
          <CardShade />
          {/* The stamp sits over the emblem, not the headline beside or below it. */}
          <View
            style={[
              styles.emblem,
              { width: well, height: well },
              compact ? styles.wellCompact : styles.wellStacked,
            ]}
          >
            <View
              style={[
                styles.well,
                { width: well, height: well, borderRadius: well / 2 },
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
            <Animated.View
              testID="reveal-stamp"
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.stamp,
                truthful ? styles.stampTrue : styles.stampBluff,
                stampIn,
              ]}
            >
              <Text
                style={[
                  styles.stampText,
                  { color: verdictColor, textShadowColor: verdictColor },
                ]}
                maxFontSizeMultiplier={READING_FONT_SCALE}
              >
                {truthful ? 'TRUE' : 'BLUFF'}
              </Text>
            </Animated.View>
          </View>
          <View style={compact ? styles.wordsCompact : styles.words}>
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
    borderWidth: 1.5,
    borderColor: neon.cyan,
    boxShadow: glow.cyan,
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
  // Holds the well and the stamp; the stamp is centred on it.
  emblem: { alignItems: 'center', justifyContent: 'center' },
  // Stamped over the emblem well, at a slant.
  stamp: {
    position: 'absolute',
    borderWidth: 2.5,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
  },
  stampTrue: { borderColor: neon.cyan },
  stampBluff: { borderColor: colors.danger },
  stampText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
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
