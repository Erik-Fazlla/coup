import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ActionRule,
  actionRules,
  CHARACTER_INFO,
  RULE_NOTES,
} from '../engine/describe';
import { CARDS } from '../engine/types';
import {
  characterColors,
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';
import { CharacterBadge } from './CharacterGlyph';
import { Sheet } from './Sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const claimText = (rule: ActionRule) =>
  rule.claim ? `Claims ${rule.claim}` : 'No claim, cannot be challenged';

const blockText = (rule: ActionRule) =>
  rule.blockedBy.length > 0
    ? `Blocked by ${rule.blockedBy.join(' or ')}`
    : 'Cannot be blocked';

/** The engine's effect text is written to follow a label; on its own line it starts a sentence. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Heading({ children }: { children: string }) {
  return (
    <Text
      style={styles.heading}
      accessibilityRole="header"
      maxFontSizeMultiplier={READING_FONT_SCALE}
    >
      {children}
    </Text>
  );
}

/**
 * The rules reference. Every row is read from the tables the engine itself
 * plays by, so what is written here cannot drift from what the game does.
 */
export function RulesSheet({ visible, onClose }: Props) {
  if (!visible) {
    return null;
  }
  return (
    <Sheet title="Rules" onClose={onClose} testID="rules-sheet">
      <Heading>ACTIONS</Heading>
      {actionRules().map(rule => {
        const palette = rule.claim ? characterColors[rule.claim] : null;
        return (
          <View
            key={rule.action}
            testID={`rule-${rule.action}`}
            accessible
            accessibilityLabel={[
              rule.label,
              rule.cost,
              rule.effect,
              claimText(rule),
              blockText(rule),
            ].join(', ')}
            style={[
              styles.rule,
              palette && { borderLeftColor: palette.accent },
            ]}
          >
            <View style={styles.ruleTop}>
              <Text
                style={styles.ruleName}
                numberOfLines={1}
                maxFontSizeMultiplier={READING_FONT_SCALE}
              >
                {rule.label}
              </Text>
              <Text
                style={styles.cost}
                maxFontSizeMultiplier={READING_FONT_SCALE}
              >
                {rule.cost}
              </Text>
            </View>
            <Text
              style={styles.effect}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {sentence(rule.effect)}
            </Text>
            <Text
              style={[styles.claim, palette && { color: palette.accent }]}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {claimText(rule)}
            </Text>
            <Text
              style={styles.block}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {blockText(rule)}
            </Text>
          </View>
        );
      })}

      <Heading>CHARACTERS</Heading>
      {CARDS.map(card => (
        <View
          key={card}
          testID={`character-${card}`}
          accessible
          accessibilityLabel={`${card}: ${CHARACTER_INFO[card].ability}`}
          style={styles.character}
        >
          <CharacterBadge card={card} size={34} />
          <View style={styles.characterText}>
            <Text
              style={[
                styles.characterName,
                { color: characterColors[card].accent },
              ]}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {card}
            </Text>
            <Text
              style={styles.effect}
              maxFontSizeMultiplier={READING_FONT_SCALE}
            >
              {CHARACTER_INFO[card].ability}
            </Text>
          </View>
        </View>
      ))}

      {RULE_NOTES.map(note => (
        <View key={note.title}>
          <Heading>{note.title.toUpperCase()}</Heading>
          <Text style={styles.note} maxFontSizeMultiplier={READING_FONT_SCALE}>
            {note.text}
          </Text>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.micro,
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  rule: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.coin,
    backgroundColor: colors.surfaceRaised,
  },
  ruleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleName: { ...typography.heading, flex: 1, color: colors.text },
  cost: { ...typography.label, color: colors.coin, marginLeft: spacing.sm },
  effect: { ...typography.body, color: colors.text, fontSize: 14 },
  claim: { ...typography.caption, color: colors.muted, marginTop: 2 },
  block: { ...typography.caption, color: colors.muted },
  character: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  characterText: { flex: 1, marginLeft: spacing.md },
  characterName: { ...typography.heading },
  note: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
