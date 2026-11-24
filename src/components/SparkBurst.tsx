import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { neon } from '../theme';
import { motionEnabled } from '../ui/motion';

const SPARKS = 12;
const REACH = 70;

/** A one-off burst of cyan sparks from the middle of its parent. Decoration only. */
export function SparkBurst() {
  const progress = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(!motionEnabled());
  useEffect(() => {
    if (!motionEnabled()) {
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(() => setDone(true));
    return () => animation.stop();
  }, [progress]);
  if (done) {
    return null;
  }
  const fade = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0.8, 0],
  });
  const along = (distance: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [0, distance] });
  const shrink = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1.4, 0.4],
  });
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.fill}
    >
      {Array.from({ length: SPARKS }, (_, index) => {
        const angle = (index / SPARKS) * 2 * Math.PI;
        const reach = REACH * (index % 2 === 0 ? 1 : 0.7);
        return (
          <Animated.View
            key={index}
            testID="spark"
            style={[
              styles.spark,
              {
                opacity: fade,
                transform: [
                  { translateX: along(Math.cos(angle) * reach) },
                  { translateY: along(Math.sin(angle) * reach) },
                  { scale: shrink },
                ],
              },
            ]}
          />
        );
      })}
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
  spark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: neon.cyan,
    boxShadow: '0 0 8px rgba(0, 229, 255, 0.9)',
  },
});
