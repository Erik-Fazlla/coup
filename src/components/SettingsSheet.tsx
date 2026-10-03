import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useProfile } from '../context/ProfileContext';
import { useSettings } from '../context/SettingsContext';
import { MAX_NAME_LENGTH } from '../engine/lobby';
import { Settings } from '../profile/settingsStore';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  TOUCH_MIN,
  typography,
} from '../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

interface Toggle {
  key: keyof Settings;
  label: string;
  hint: string;
}

/**
 * The on/off switches, one row each. To add a setting that already exists in
 * `Settings` (Sound is next), add a line here; nothing else needs to change.
 */
const TOGGLES: Toggle[] = [
  {
    key: 'vibration',
    label: 'Vibration',
    hint: 'Buzz when it is your turn or you must respond',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** The player's name and this device's preferences. Opened from Home, never during a game. */
export function SettingsSheet({ visible, onClose }: Props) {
  if (!visible) {
    return null;
  }
  return (
    <Sheet title="Settings" onClose={onClose} testID="settings-sheet">
      <NameSetting />
      <Text style={styles.heading} accessibilityRole="header">
        THIS DEVICE
      </Text>
      <ToggleRows />
    </Sheet>
  );
}

function ToggleRows() {
  const { settings, update } = useSettings();
  return (
    <>
      {TOGGLES.map(toggle => (
        <View key={toggle.key} style={styles.toggle}>
          <View style={styles.toggleText}>
            <Text
              style={styles.toggleLabel}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {toggle.label}
            </Text>
            <Text
              style={styles.toggleHint}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {toggle.hint}
            </Text>
          </View>
          <Switch
            testID={`setting-${toggle.key}`}
            accessibilityLabel={toggle.label}
            accessibilityHint={toggle.hint}
            value={settings[toggle.key]}
            onValueChange={value => update({ [toggle.key]: value })}
            trackColor={{ false: colors.secondary, true: colors.primaryFill }}
            thumbColor={settings[toggle.key] ? colors.primary : colors.muted}
            style={styles.switch}
          />
        </View>
      ))}
    </>
  );
}

function NameSetting() {
  const { profile, setName } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newName = draft.trim();
  const canSave = newName.length > 0 && !saving;

  if (!profile) {
    return null;
  }

  const startEditing = () => {
    setDraft(profile.name);
    setError(null);
    setEditing(true);
  };

  // Stats stay with the profile; the new name applies to games joined from now on.
  const saveName = async () => {
    if (!canSave) {
      return;
    }
    if (newName === profile.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setName(newName);
      setEditing(false);
    } catch {
      setError('Could not save your name on this device. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.name}>
      <Text style={styles.heading} accessibilityRole="header">
        PLAYER NAME
      </Text>
      {editing ? (
        <>
          <TextInput
            style={styles.nameInput}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={saveName}
            returnKeyType="done"
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            autoCorrect={false}
            placeholder="Name"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Player name"
          />
          <View style={styles.nameButtons}>
            <Button label="Save" disabled={!canSave} onPress={saveName} />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setEditing(false)}
            />
          </View>
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </>
      ) : (
        <View style={styles.nameRow}>
          <Text
            style={styles.nameValue}
            numberOfLines={1}
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            {profile.name}
          </Text>
          <Button
            label="Change name"
            variant="secondary"
            onPress={startEditing}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.micro,
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { marginBottom: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameValue: { ...typography.title, flex: 1, color: colors.text, fontSize: 22 },
  nameInput: {
    minHeight: TOUCH_MIN,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 18,
  },
  nameButtons: { flexDirection: 'row', marginTop: spacing.xs },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  toggle: {
    minHeight: TOUCH_MIN + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  toggleText: { flex: 1, marginRight: spacing.md },
  toggleLabel: { ...typography.heading, color: colors.text },
  toggleHint: { ...typography.caption, color: colors.muted },
  switch: { minWidth: TOUCH_MIN, minHeight: TOUCH_MIN },
});
