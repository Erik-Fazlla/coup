import React from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import {
  colors,
  glow,
  neon,
  radius,
  READING_FONT_SCALE,
  spacing,
  TOUCH_MIN,
} from '../theme';
import { usePressScale } from '../ui/motion';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Spoken instead of the label when the label alone is not enough. */
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  testID,
}: Props) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      testID={testID}
      style={styles.touch}
    >
      {({ pressed }) => (
        // The touch target keeps its size; only the face dips under the finger.
        <Animated.View
          style={[
            styles.face,
            styles[variant],
            pressed && styles.pressed,
            disabled && styles.disabled,
            { transform: [{ scale }] },
          ]}
        >
          <Text
            style={[
              styles.label,
              variant === 'secondary' && styles.labelSecondary,
              variant === 'danger' && styles.labelOnLight,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            {label}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: {
    minHeight: TOUCH_MIN,
    minWidth: 96,
    margin: spacing.xs,
  },
  face: {
    // No flexGrow here: inside a panel without a fixed height, Android's layout
    // lets a growing child expand to the whole available height (a screen-tall button).
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: neon.blue,
    borderColor: neon.cyan,
    borderWidth: 1.5,
    boxShadow: glow.blue,
  },
  secondary: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderWidth: 1.5,
  },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  // A brighter glow under the finger instead of fading out.
  pressed: { boxShadow: glow.cyan },
  disabled: { opacity: 0.35, boxShadow: 'none' },
  label: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelSecondary: { color: neon.mist },
  labelOnLight: { color: colors.onLight },
});
