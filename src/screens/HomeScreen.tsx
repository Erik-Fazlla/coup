import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { CharacterStrip } from '../components/CharacterStrip';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { winRate } from '../profile/profileStore';
import { colors, radius, spacing, TOUCH_MIN, typography } from '../theme';

const CODE_LENGTH = 5;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function HomeScreen() {
  const { profile } = useProfile();
  const { connected, busy, error, createGame, joinGame } = useGame();
  const [code, setCode] = useState('');
  const disabled = !connected || busy;
  const canJoin = !disabled && code.trim().length === CODE_LENGTH;

  if (!profile) {
    return null;
  }

  return (
    <Screen>
      <ConnectionBanner connected={connected} />
      <View style={styles.columns}>
        <Panel style={styles.column}>
          <Text style={styles.you}>PLAYER</Text>
          <Text style={styles.heading} numberOfLines={1}>
            {profile.name}
          </Text>
          <View style={styles.stats}>
            <Stat label="Games played" value={String(profile.gamesPlayed)} />
            <Stat label="Wins" value={String(profile.wins)} />
            <Stat label="Win rate" value={`${winRate(profile)}%`} />
          </View>
          <CharacterStrip size={24} />
        </Panel>
        <Panel style={styles.column}>
          <Button
            label="Create Game"
            disabled={disabled}
            onPress={createGame}
          />
          <Text style={styles.or}>or join with a code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={value => setCode(value.toUpperCase())}
            maxLength={CODE_LENGTH}
            onSubmitEditing={() => canJoin && joinGame(code)}
            returnKeyType="go"
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="CODE"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Join code"
          />
          <Button
            label="Join"
            variant="secondary"
            disabled={!canJoin}
            onPress={() => joinGame(code)}
          />
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  column: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  you: { ...typography.micro, color: colors.primary },
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    minWidth: 76,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { ...typography.title, color: colors.coin, fontSize: 22 },
  statLabel: {
    ...typography.micro,
    color: colors.muted,
    fontSize: 9,
    marginTop: 2,
  },
  or: {
    ...typography.caption,
    color: colors.muted,
    marginVertical: spacing.sm,
  },
  input: {
    width: 180,
    minHeight: TOUCH_MIN,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
