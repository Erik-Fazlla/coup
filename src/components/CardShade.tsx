import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const SHADE = require('../../assets/images/card-shade.png');

/**
 * Light at the top, dark at the bottom: laid over a coloured card or tile it turns
 * the flat fill into a gradient of the same colour. Decoration only: it takes no
 * touches and is hidden from screen readers.
 */
export function CardShade() {
  return (
    <View
      testID="card-shade"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Image
        source={SHADE}
        resizeMode="stretch"
        fadeDuration={0}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The image keeps its intrinsic width (a 16 px strip) unless sized explicitly.
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
