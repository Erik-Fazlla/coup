import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  DENSE_FONT_SCALE,
  glow,
  neon,
  radius,
  typography,
} from '../theme';
import { motionEnabled } from '../ui/motion';
import { SeatMoment } from '../ui/tableMoments';

const SHOW_MS = 1100;

/**
 * The short-lived effects on one seat (or the local player's hand): a gold coin
 * change rising and fading, a claim or block tag popping in, and a flash for a
 * block. Each new `moment.id` plays once. Draws nothing with motion off.
 */
export function SeatEffects({ moment }: { moment: SeatMoment | null }) {
  const progress = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState<SeatMoment | null>(null);

  useEffect(() => {
    if (!moment || !motionEnabled()) {
      return;
    }
    setShown(moment);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SHOW_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setShown(null);
      }
    });
    return () => animation.stop();
    // Only a new moment id starts the effect again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?.id]);

  if (!shown || !motionEnabled()) {
    return null;
  }
  const fadeOut = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });
  const rise = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -14],
  });
  const pop = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0.7, 1, 1],
  });
  const flash = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1, 0, 0],
  });
  const coins = shown.coins;

  return (
    <View
      testID="seat-effects"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.fill}
    >
      {shown.block && (
        <Animated.View style={[styles.flash, { opacity: flash }]} />
      )}
      {shown.tag !== undefined && (
        <Animated.View
          style={[
            styles.tag,
            { opacity: fadeOut, transform: [{ scale: pop }] },
          ]}
        >
          <Text
            style={styles.tagText}
            numberOfLines={1}
            maxFontSizeMultiplier={DENSE_FONT_SCALE}
          >
            {shown.tag}
          </Text>
        </Animated.View>
      )}
      {coins !== undefined && (
        <Animated.Text
          style={[
            styles.coins,
            coins < 0 && styles.coinsLost,
            { opacity: fadeOut, transform: [{ translateY: rise }] },
          ]}
          maxFontSizeMultiplier={DENSE_FONT_SCALE}
        >
          {coins > 0 ? `+${coins}` : `−${Math.abs(coins)}`}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: neon.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.sheet,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    boxShadow: glow.soft,
  },
  tagText: { ...typography.micro, color: neon.ice },
  coins: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 15,
    fontWeight: '800',
    color: colors.coin,
    textShadowColor: colors.coinShade,
    textShadowRadius: 6,
  },
  coinsLost: { color: colors.danger, textShadowColor: colors.dangerFill },
});
