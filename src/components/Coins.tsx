import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, DENSE_FONT_SCALE, spacing } from '../theme';
import { useCountTick } from '../ui/motion';

type Size = 'sm' | 'md' | 'lg';

const DIAMETER: Record<Size, number> = { sm: 12, md: 16, lg: 22 };
const FONT_SIZE: Record<Size, number> = { sm: 13, md: 16, lg: 22 };

interface Props {
  count: number;
  size?: Size;
}

/**
 * A drawn coin and a number. When the count changes the number ticks to the
 * new value with a small bump, green for a gain and red for a loss. A screen
 * reader is always given the real count, never a number in between.
 */
export function Coins({ count, size = 'md' }: Props) {
  const diameter = DIAMETER[size];
  const { shown, tint, scale } = useCountTick(count);
  const color =
    tint === 'gain'
      ? colors.positive
      : tint === 'loss'
      ? colors.danger
      : colors.coin;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${count} coin${count === 1 ? '' : 's'}`}
    >
      <View
        style={[
          styles.coin,
          { width: diameter, height: diameter, borderRadius: diameter / 2 },
        ]}
      />
      <Animated.Text
        style={[
          styles.count,
          { fontSize: FONT_SIZE[size], color, transform: [{ scale }] },
        ]}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        {shown}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  coin: {
    backgroundColor: colors.coin,
    borderWidth: 2,
    borderColor: colors.coinShade,
    marginRight: spacing.xs,
  },
  count: { fontWeight: '800', fontVariant: ['tabular-nums'] },
});
