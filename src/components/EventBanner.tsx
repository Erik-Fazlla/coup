import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  TOUCH_MIN,
  typography,
} from '../theme';
import { useEnter } from '../ui/motion';
import { BANNER_MIN_HEIGHT } from './tableLayout';

/** Below this height there is only room for the first line. */
const TWO_LINES_FROM = 52;
/** From this height the first line may wrap. */
const WRAP_FROM = 76;

interface Props {
  /** What the local player must do now, or who the table is waiting for. */
  primary: string;
  /** The latest log entry, if any. */
  secondary: string | null;
  /** A problem with the player's last tap; shown first, with `primary` under it in place of the log entry. */
  error: string | null;
  /** True when `primary` asks something of the local player. */
  yours: boolean;
  onPress: () => void;
}

/**
 * The centre of the table. It is the one region with no fixed height: on a
 * small screen it shrinks to a single line so the actions below always fit.
 * Tapping it opens the full log.
 */
export function EventBanner({
  primary,
  secondary,
  error,
  yours,
  onPress,
}: Props) {
  const [height, setHeight] = useState<number | null>(null);
  // An error takes the first line, the only one a short banner draws: on a small landscape
  // phone "Too late" would otherwise never be seen. What is asked moves down a line.
  const first = error ?? primary;
  const second = error ? primary : secondary;
  const showSecond = !!second && (height === null || height >= TWO_LINES_FROM);
  const wrap = height !== null && height >= WRAP_FROM;
  // A new line slides in, so the eye is drawn to what just changed.
  const primaryEnter = useEnter(first);
  const secondEnter = useEnter(second ?? null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[first, second, 'Open the game log']
        .filter(Boolean)
        .join('. ')}
      accessibilityLiveRegion="polite"
      onPress={onPress}
      onLayout={event => setHeight(event.nativeEvent.layout.height)}
      testID="event-banner"
      style={({ pressed }) => [
        styles.banner,
        yours && styles.bannerYours,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.marker, yours && styles.markerYours]} />
      <View style={styles.lines}>
        <Animated.Text
          style={[
            styles.primary,
            yours && styles.primaryYours,
            !!error && styles.error,
            primaryEnter,
          ]}
          numberOfLines={wrap ? 2 : 1}
          accessibilityLiveRegion={error ? 'polite' : undefined}
          maxFontSizeMultiplier={READING_FONT_SCALE}
        >
          {first}
        </Animated.Text>
        {showSecond && (
          <Animated.Text
            style={[styles.secondary, secondEnter]}
            numberOfLines={1}
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            {second}
          </Animated.Text>
        )}
      </View>
      <Text style={styles.log} maxFontSizeMultiplier={1}>
        LOG
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flex: 1,
    minHeight: BANNER_MIN_HEIGHT,
    // The banner may be shorter than a touch target on a tiny screen; widen the tap area instead.
    minWidth: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  bannerYours: { borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  marker: {
    alignSelf: 'stretch',
    width: 4,
    backgroundColor: colors.borderStrong,
  },
  markerYours: { backgroundColor: colors.primary },
  lines: { flex: 1, paddingHorizontal: spacing.md, justifyContent: 'center' },
  primary: { ...typography.heading, color: colors.text, fontSize: 16 },
  primaryYours: { color: colors.primary },
  secondary: { ...typography.caption, color: colors.muted, marginTop: 1 },
  error: { color: colors.danger },
  log: {
    ...typography.micro,
    color: colors.muted,
    marginRight: spacing.md,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
