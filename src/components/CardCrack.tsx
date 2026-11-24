import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { motionEnabled } from '../ui/motion';

/**
 * A card breaking: its two halves drift apart and fade, over a short red flash.
 * Plays once each time `play` turns true; draws nothing with motion off.
 * Decoration only: the card underneath already shows its lost face.
 */
export function CardCrack({ play }: { play: boolean }) {
  const progress = useRef(new Animated.Value(1)).current;
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!play || !motionEnabled()) {
      return;
    }
    setRunning(true);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(() => setRunning(false));
    return () => animation.stop();
  }, [play, progress]);
  if (!running || !motionEnabled()) {
    return null;
  }
  const fade = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0],
  });
  const apart = (direction: number) =>
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 14 * direction],
    });
  const tilt = (direction: number) =>
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${8 * direction}deg`],
    });
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.fill}
    >
      <Animated.View
        testID="crack-left"
        style={[
          styles.half,
          styles.left,
          {
            opacity: fade,
            transform: [{ translateX: apart(-1) }, { rotate: tilt(-1) }],
          },
        ]}
      />
      <Animated.View
        testID="crack-right"
        style={[
          styles.half,
          styles.right,
          {
            opacity: fade,
            transform: [{ translateX: apart(1) }, { rotate: tilt(1) }],
          },
        ]}
      />
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
    flexDirection: 'row',
  },
  half: {
    flex: 1,
    backgroundColor: 'rgba(248, 113, 113, 0.35)',
    borderColor: colors.danger,
  },
  left: { borderRightWidth: 1 },
  right: { borderLeftWidth: 1 },
});
