import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { CharacterStrip } from '../components/CharacterStrip';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Panel } from '../components/Panel';
import { RulesSheet } from '../components/RulesSheet';
import { Screen } from '../components/Screen';
import { SettingsSheet } from '../components/SettingsSheet';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { winRate } from '../profile/profileStore';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  TOUCH_MIN,
  typography,
} from '../theme';
import { useKeyboardInset } from '../ui/keyboard';
import { useIsPortrait } from '../ui/orientation';

const CODE_LENGTH = 5;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.statValue} maxFontSizeMultiplier={READING_FONT_SCALE}>
        {value}
      </Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={READING_FONT_SCALE}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const { profile } = useProfile();
  const { connected, busy, error, createGame, joinGame } = useGame();
  const portrait = useIsPortrait();
  const keyboardInset = useKeyboardInset();
  const [code, setCode] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeRules = useCallback(() => setRulesOpen(false), []);
  const disabled = !connected || busy;
  const canJoin = !disabled && code.trim().length === CODE_LENGTH;
  const sheetOpen = settingsOpen || rulesOpen;

  if (!profile) {
    return null;
  }

  return (
    <Screen>
      <View style={styles.body}>
        <View
          style={styles.body}
          accessibilityElementsHidden={sheetOpen}
          importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}
        >
          <ConnectionBanner connected={connected} />
          <ScrollView
            style={styles.body}
            // Room to scroll the code field above the keyboard. If the window itself shrinks
            // for the keyboard on some phone, this is only extra scrollable space.
            contentContainerStyle={[
              portrait ? styles.stack : styles.columns,
              { paddingBottom: keyboardInset },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Panel style={[styles.column, !portrait && styles.columnBeside]}>
              <Text style={styles.you}>PLAYER</Text>
              <Text
                style={styles.heading}
                numberOfLines={1}
                maxFontSizeMultiplier={READING_FONT_SCALE}
              >
                {profile.name}
              </Text>
              <View style={styles.stats}>
                <Stat
                  label="Games played"
                  value={String(profile.gamesPlayed)}
                />
                <Stat label="Wins" value={String(profile.wins)} />
                <Stat label="Win rate" value={`${winRate(profile)}%`} />
              </View>
              <View style={styles.buttons}>
                <Button
                  label="Settings"
                  variant="secondary"
                  onPress={() => setSettingsOpen(true)}
                  testID="open-settings"
                />
                <Button
                  label="Rules"
                  variant="secondary"
                  onPress={() => setRulesOpen(true)}
                  testID="open-rules"
                />
              </View>
              <CharacterStrip size={24} />
            </Panel>
            <Panel style={[styles.column, !portrait && styles.columnBeside]}>
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
                // In landscape Android would otherwise replace the whole screen with the keyboard's own edit field.
                disableFullscreenUI
                underlineColorAndroid="transparent"
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
          </ScrollView>
        </View>
        <SettingsSheet visible={settingsOpen} onClose={closeSettings} />
        <RulesSheet visible={rulesOpen} onClose={closeRules} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  // Landscape: two panels side by side. Portrait: the same panels stacked.
  columns: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stack: { flexGrow: 1, justifyContent: 'center', gap: spacing.md },
  column: { alignItems: 'center', paddingVertical: spacing.lg },
  columnBeside: { flex: 1 },
  you: { ...typography.micro, color: colors.primary },
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  // Three tiles fit a phone; on a narrow column or with large text they wrap instead of being cut off.
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  buttons: { flexDirection: 'row', marginBottom: spacing.md },
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
