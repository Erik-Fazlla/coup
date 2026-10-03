import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  DENSE_FONT_SCALE,
  radius,
  spacing,
  TOUCH_MIN,
  typography,
} from '../theme';
import { TOP_BAR_HEIGHT } from './tableLayout';

interface Props {
  turn: number;
  deck: number;
  code: string;
  connected: boolean;
  onLeave: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      <Text style={styles.statLabel} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
        {label.toUpperCase()}
      </Text>
      <Text style={styles.statValue} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
        {value}
      </Text>
    </View>
  );
}

/** Turn number, deck count, join code, connection state and the way out. One fixed-height row. */
export function TopBar({ turn, deck, code, connected, onLeave }: Props) {
  return (
    <View style={styles.bar}>
      <Text style={styles.brand} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
        COUP
      </Text>
      <Stat label="Turn" value={String(turn)} />
      <Stat label="Deck" value={String(deck)} />
      <Stat label="Code" value={code} />
      <View style={styles.status}>
        {!connected && (
          <Text
            style={styles.offline}
            numberOfLines={1}
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={DENSE_FONT_SCALE}
          >
            Reconnecting… actions paused
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave game"
        onPress={onLeave}
        testID="leave"
        style={styles.leaveTouch}
      >
        {({ pressed }) => (
          <View style={[styles.leave, pressed && styles.pressed]}>
            <Text
              style={styles.leaveText}
              maxFontSizeMultiplier={DENSE_FONT_SCALE}
            >
              Leave
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
    marginRight: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { ...typography.micro, color: colors.muted, marginRight: 5 },
  statValue: { ...typography.label, color: colors.text },
  status: { flex: 1, alignItems: 'flex-end', paddingHorizontal: spacing.sm },
  offline: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  // The touch target is the full bar height; the visible pill inside it is smaller.
  leaveTouch: {
    height: TOP_BAR_HEIGHT,
    minWidth: TOUCH_MIN,
    justifyContent: 'center',
  },
  leave: {
    height: 34,
    minWidth: 68,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  leaveText: { ...typography.label, color: colors.text },
});
