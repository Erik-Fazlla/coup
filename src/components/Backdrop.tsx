import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

const HAZE = require('../../assets/images/haze.png');

/**
 * The Noir Neon background: black with a faint cyan haze in the top-left corner,
 * like the light behind the man in the intro. Decoration only: it takes no touches
 * and is hidden from screen readers.
 */
export function Backdrop() {
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height) * 0.9;
  return (
    <View
      testID="backdrop"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.fill}
    >
      <Image
        source={HAZE}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          left: -size * 0.35,
          top: -size * 0.45,
        }}
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
    overflow: 'hidden',
  },
});
