import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CharacterPalette,
  colors,
  DENSE_FONT_SCALE,
  radius,
  TOUCH_MIN,
} from '../theme';

interface Props {
  label: string;
  /** Second line: cost, gain or claimed character. */
  detail: string;
  accessibilityLabel: string;
  palette: CharacterPalette;
  /** Large tiles are used when only a few choices share the slot (responses). */
  size?: 'grid' | 'large';
  selected?: boolean;
  disabled?: boolean;
  /** Drawn above the label, e.g. a character glyph. */
  icon?: React.ReactNode;
  onPress: () => void;
  testID?: string;
}

/** The one tappable tile used for actions and responses, so both look and behave alike. */
export function ActionTile({
  label,
  detail,
  accessibilityLabel,
  palette,
  size = 'grid',
  selected = false,
  disabled = false,
  icon,
  onPress,
  testID,
}: Props) {
  const large = size === 'large';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: palette.fill },
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[styles.label, large && styles.labelLarge]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.detail,
          large && styles.detailLarge,
          { color: palette.accent },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    paddingHorizontal: 7,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.38 },
  icon: { marginBottom: 4 },
  label: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  labelLarge: { fontSize: 17, lineHeight: 22 },
  detail: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailLarge: { fontSize: 12, lineHeight: 16 },
});
