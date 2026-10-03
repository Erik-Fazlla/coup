import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { CharacterStrip } from '../components/CharacterStrip';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { useProfile } from '../context/ProfileContext';
import { MAX_NAME_LENGTH } from '../engine/lobby';
import { colors, radius, spacing, TOUCH_MIN, typography } from '../theme';

export function WelcomeScreen() {
  const { setName, startupError } = useProfile();
  const [text, setText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = text.trim();
  const canContinue = name.length > 0 && !saving;
  const error = saveError ?? startupError;

  const submit = async () => {
    if (!canContinue) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await setName(name);
    } catch {
      setSaveError('Could not save your name on this device. Try again.');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.columns}>
        <View style={styles.brand}>
          <Text style={styles.title}>COUP</Text>
          <CharacterStrip size={30} />
        </View>
        <Panel style={styles.form}>
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Text style={styles.label}>Choose your player name</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            returnKeyType="done"
            maxLength={MAX_NAME_LENGTH}
            placeholder="Name"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            accessibilityLabel="Player name"
          />
          <Button label="Continue" disabled={!canContinue} onPress={submit} />
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    // A wrapping row stacks its lines from the top unless told otherwise;
    // this is what keeps the block in the vertical centre of the screen.
    alignContent: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  brand: { alignItems: 'center' },
  title: {
    ...typography.display,
    color: colors.text,
    marginBottom: spacing.md,
    // letterSpacing also pads the last letter; pull the word back to centre.
    marginRight: -typography.display.letterSpacing,
  },
  form: { alignItems: 'center', padding: spacing.lg },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
    maxWidth: 260,
  },
  label: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    width: 260,
    minHeight: TOUCH_MIN,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
  },
});
