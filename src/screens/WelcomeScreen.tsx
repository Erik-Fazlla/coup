import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { CharacterStrip } from '../components/CharacterStrip';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { useProfile } from '../context/ProfileContext';
import { MAX_NAME_LENGTH } from '../engine/lobby';
import { colors, radius, spacing, TOUCH_MIN, typography } from '../theme';
import { useKeyboardInset } from '../ui/keyboard';

export function WelcomeScreen() {
  const { setName, startupError } = useProfile();
  const [text, setText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const keyboardInset = useKeyboardInset();
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
      {/* A scroll view so the field can be reached with the keyboard up. `flexGrow: 1` on its
          content is safe: the scroll view itself has a definite height (`flex: 1` in the screen),
          so the content is at least that tall and the block stays centred in it. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.columns,
          { paddingBottom: keyboardInset },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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
            // In landscape Android would otherwise replace the whole screen with the keyboard's own edit field.
            disableFullscreenUI
            underlineColorAndroid="transparent"
            accessibilityLabel="Player name"
          />
          <Button label="Continue" disabled={!canContinue} onPress={submit} />
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // With the keyboard up, its height is added as bottom padding: the block is then centred
  // in what is left above the keyboard, or can be scrolled there. If the window itself
  // shrinks on some phone, that padding is only extra scrollable space.
  columns: {
    flexGrow: 1,
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
