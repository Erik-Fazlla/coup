import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CHARACTER_INFO } from '../engine/describe';
import { Card } from '../engine/types';
import {
  characterColors,
  colors,
  DENSE_FONT_SCALE,
  radius,
  TOUCH_MIN,
  typography,
} from '../theme';
import { CharacterGlyph } from './CharacterGlyph';

const BADGE = 22;
const GLYPH = 15;

interface Props {
  card: Card;
  /** The card has been revealed and no longer counts as influence. */
  lost?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** How many lines the ability text may take; 0 hides it when the card is short. */
  abilityLines?: number;
  onPress?: () => void;
  testID?: string;
}

/**
 * One of the local player's own cards, face up. It fills the row it is placed in,
 * so the parent decides its size. With `onPress` it is a button.
 */
export function CharacterCard({
  card,
  lost = false,
  selected = false,
  disabled = false,
  abilityLines = 2,
  onPress,
  testID,
}: Props) {
  const palette = characterColors[card];
  const ability = CHARACTER_INFO[card].ability;
  const label = lost ? `${card}, lost` : `${card}: ${ability}`;
  const accent = lost ? colors.faint : palette.accent;
  const fill = lost ? colors.background : palette.fill;
  const face = [
    styles.card,
    { backgroundColor: fill, borderColor: accent },
    lost && styles.lost,
    selected && styles.selected,
    disabled && styles.disabled,
  ];

  const content = (
    <>
      <View style={styles.top}>
        <View style={styles.badge}>
          <CharacterGlyph
            card={card}
            size={GLYPH}
            color={accent}
            cutout={fill}
          />
        </View>
        {lost && (
          <Text style={styles.lostTag} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
            LOST
          </Text>
        )}
        {selected && !lost && (
          <View style={styles.tick}>
            <View style={styles.tickMark} />
          </View>
        )}
      </View>
      <Text
        style={[styles.name, lost && styles.nameLost]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        {card}
      </Text>
      {!lost && abilityLines > 0 && (
        <Text
          style={[styles.ability, { color: accent }]}
          numberOfLines={abilityLines}
          maxFontSizeMultiplier={DENSE_FONT_SCALE}
        >
          {ability}
        </Text>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} testID={testID} style={face}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [face, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: 136,
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    padding: 5,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: 'hidden',
  },
  lost: { borderStyle: 'dashed' },
  selected: { borderColor: colors.primary },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lostTag: { ...typography.micro, color: colors.danger },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: {
    width: 5,
    height: 9,
    marginTop: -2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.onLight,
    transform: [{ rotate: '45deg' }],
  },
  name: { ...typography.label, color: colors.text, lineHeight: 16 },
  nameLost: { color: colors.muted, textDecorationLine: 'line-through' },
  ability: { fontSize: 9.5, lineHeight: 12, marginTop: 1 },
});
