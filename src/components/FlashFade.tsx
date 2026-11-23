import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { motionEnabled } from '../ui/motion';

const FADE_MS = 650;

/**
 * A full-screen colour that fades away once, revealing what is under it: the
 * next screen "coming out of" the bright flash the name screen's outro ends on.
 * It never takes a touch, and with motion off it is not drawn at all.
 */
export function FlashFade({
  color,
  onDone,
}: {
  color: string;
  onDone: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const animate = motionEnabled();

  useEffect(() => {
    if (!animate) {
      onDone();
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(() => onDone());
    return () => animation.stop();
    // Runs once: the fade is started when the screen appears and never restarted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!animate) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]}
    />
  );
}
