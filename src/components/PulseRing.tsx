import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { radius } from '../theme';
import { usePulse } from '../ui/motion';

/**
 * A glowing outline that breathes while `active`: the player whose turn it is
 * (gold) or an opponent you can target (cyan). Drawn over the seat's own border.
 */
export function PulseRing({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  const pulse = usePulse(active);
  if (!active) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        { borderColor: color, boxShadow: `0 0 14px ${color}`, opacity: pulse },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.md + 2,
    borderWidth: 2,
  },
});
