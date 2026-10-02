import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { winRate } from '../profile/profileStore';
import { colors, spacing } from '../theme';

const CODE_LENGTH = 5;

export function HomeScreen() {
  const { profile } = useProfile();
  const { connected, busy, error, createGame, joinGame } = useGame();
  const [code, setCode] = useState('');
  const disabled = !connected || busy;

  if (!profile) {
    return null;
  }

  return (
    <Screen>
      <ConnectionBanner connected={connected} />
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.heading}>{profile.name}</Text>
          <Text style={styles.stat}>Games played: {profile.gamesPlayed}</Text>
          <Text style={styles.stat}>Wins: {profile.wins}</Text>
          <Text style={styles.stat}>Win rate: {winRate(profile)}%</Text>
        </View>
        <View style={styles.column}>
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
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="CODE"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Join code"
          />
          <Button
            label="Join"
            variant="secondary"
            disabled={disabled || code.trim().length !== CODE_LENGTH}
            onPress={() => joinGame(code)}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  column: { flex: 1, alignItems: 'center' },
  heading: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  stat: { color: colors.text, fontSize: 15, marginBottom: spacing.xs },
  or: { color: colors.muted, fontSize: 12, marginVertical: spacing.sm },
  input: {
    width: 180,
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
