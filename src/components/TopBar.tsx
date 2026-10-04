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
  /** Narrow (portrait) bar: no brand, tighter stats, so both buttons always fit. */
  compact?: boolean;
  onRules: () => void;
  onLeave: () => void;
}

function Stat({
  label,
  value,
  compact,
  bare = false,
  gives = false,
}: {
  label: string;
  value: string;
  compact: boolean;
  /** Value only; the label is still spoken. */
  bare?: boolean;
  /** Gives up width when the bar is too narrow: its label is cut first, the value stays. */
  gives?: boolean;
}) {
  return (
    <View
      style={[
        styles.stat,
        compact && styles.statCompact,
        gives ? styles.statGives : styles.statKeeps,
      ]}
      accessible
      accessibilityLabel={`${label} ${value}`}
      testID={`stat-${label.toLowerCase()}`}
    >
      {!bare && (
        <Text
          style={[styles.statLabel, gives && styles.statLabelGives]}
          numberOfLines={1}
          ellipsizeMode="clip"
          maxFontSizeMultiplier={DENSE_FONT_SCALE}
        >
          {label.toUpperCase()}
        </Text>
      )}
      <Text
        style={styles.statValue}
        numberOfLines={1}
        maxFontSizeMultiplier={DENSE_FONT_SCALE}
      >
        {value}
      </Text>
    </View>
  );
}

function BarButton({
  label,
  accessibilityLabel,
  compact,
  onPress,
  testID,
}: {
  label: string;
  accessibilityLabel: string;
  compact: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={styles.touch}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.pill,
            compact && styles.pillCompact,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={styles.pillText}
            numberOfLines={1}
            maxFontSizeMultiplier={DENSE_FONT_SCALE}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Turn number, deck count, join code, connection state, the rules and the way
 * out. One fixed-height row. The two buttons never shrink: when the bar is too
 * narrow the Turn and Deck pills give way first, and the join code last.
 */
export function TopBar({
  turn,
  deck,
  code,
  connected,
  compact = false,
  onRules,
  onLeave,
}: Props) {
  // A narrow bar has no spare room for the warning, so it takes the place of the stats.
  const warningOnly = compact && !connected;
  return (
    <View style={styles.bar}>
      <View style={styles.info}>
        {!compact && (
          <Text style={styles.brand} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
            COUP
          </Text>
        )}
        {!warningOnly && (
          <>
            <Stat label="Turn" value={String(turn)} compact={compact} gives />
            <Stat label="Deck" value={String(deck)} compact={compact} gives />
            <Stat label="Code" value={code} compact={compact} bare={compact} />
          </>
        )}
        {/* A narrow bar has nothing to put here while connected, and no width to spare for an empty box. */}
        {(!compact || !connected) && (
          <View style={[styles.status, warningOnly && styles.statusLeft]}>
            {!connected && (
              <Text
                style={styles.offline}
                numberOfLines={compact ? 2 : 1}
                accessibilityLiveRegion="polite"
                maxFontSizeMultiplier={DENSE_FONT_SCALE}
              >
                Reconnecting… actions paused
              </Text>
            )}
          </View>
        )}
      </View>
      <BarButton
        label="Rules"
        accessibilityLabel="Rules"
        compact={compact}
        onPress={onRules}
        testID="rules"
      />
      <BarButton
        label="Leave"
        accessibilityLabel="Leave game"
        compact={compact}
        onPress={onLeave}
        testID="leave"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
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
  statCompact: { marginRight: spacing.xs, paddingHorizontal: 6 },
  // The info row has a definite width (what the two buttons leave). When the pills do not
  // fit, Turn and Deck are the ones that narrow, so the join code is never the part cut off.
  statGives: { flexShrink: 1, overflow: 'hidden' },
  statKeeps: { flexShrink: 0 },
  statLabel: { ...typography.micro, color: colors.muted, marginRight: 5 },
  statLabelGives: { flexShrink: 1 },
  statValue: { ...typography.label, color: colors.text },
  status: { flex: 1, alignItems: 'flex-end', paddingHorizontal: spacing.sm },
  statusLeft: { alignItems: 'flex-start', paddingLeft: 0 },
  offline: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  // The touch target is the full bar height; the visible pill inside it is smaller.
  touch: {
    height: TOP_BAR_HEIGHT,
    minWidth: TOUCH_MIN,
    marginLeft: spacing.xs,
    justifyContent: 'center',
  },
  pill: {
    height: 34,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCompact: { minWidth: 52, paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.7 },
  pillText: { ...typography.label, color: colors.text },
});
