import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, DENSE_FONT_SCALE, spacing } from '../theme';

type Size = 'sm' | 'md' | 'lg';

const DIAMETER: Record<Size, number> = { sm: 12, md: 16, lg: 22 };
const FONT_SIZE: Record<Size, number> = { sm: 13, md: 16, lg: 22 };

interface Props {
  count: number;
  size?: Size;
}

/** A drawn coin and a number. Kept on its own so the count can be animated later. */
export function Coins({ count, size = 'md' }: Props) {
  const diameter = DIAMETER[size];
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
      <Text
        style={[styles.count, { fontSize: FONT_SIZE[size] }]}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        {count}
      </Text>
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
  count: { color: colors.coin, fontWeight: '800' },
});
