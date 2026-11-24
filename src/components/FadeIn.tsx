import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { DURATION, motionEnabled } from '../ui/motion';

/** A screen fading in when it opens (mount). Fills its parent like the screen it wraps. */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(motionEnabled() ? 0 : 1)).current;
  useEffect(() => {
    if (!motionEnabled()) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION.base,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.fill, { opacity }]}>{children}</Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
});
