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
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
