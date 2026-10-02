import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useProfile } from '../context/ProfileContext';
import { MAX_NAME_LENGTH } from '../engine/lobby';
import { colors, spacing } from '../theme';

export function WelcomeScreen() {
  const { setName } = useProfile();
  const [text, setText] = useState('');
  const name = text.trim();

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>COUP</Text>
        <Text style={styles.label}>Choose your player name</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Name"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          accessibilityLabel="Player name"
        />
        <Button
          label="Continue"
          disabled={name.length === 0}
          onPress={() => setName(name)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: colors.primary,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 6,
    marginBottom: spacing.lg,
  },
  label: { color: colors.text, fontSize: 14, marginBottom: spacing.sm },
  input: {
    width: 260,
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
  },
});
