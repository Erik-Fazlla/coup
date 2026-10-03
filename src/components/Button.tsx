import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  TOUCH_MIN,
} from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.label, variant !== 'secondary' && styles.labelOnLight]}
        maxFontSizeMultiplier={READING_FONT_SCALE}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    margin: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  labelOnLight: { color: colors.onLight },
});
