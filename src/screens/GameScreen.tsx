import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../components/ActionBar';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ExchangePicker } from '../components/ExchangePicker';
import { GameLog } from '../components/GameLog';
import { LoseInfluencePicker } from '../components/LoseInfluencePicker';
import { PlayerSeat } from '../components/PlayerSeat';
import { ResponsePrompt } from '../components/ResponsePrompt';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { useProfile } from '../context/ProfileContext';
import { statusLine } from '../engine/describe';
import { unrevealedCount } from '../engine/rules';
import { colors, spacing } from '../theme';

export function GameScreen() {
  const { game, connected, busy, error, act, leave } = useGame();
  const { playerId } = useProfile();

  if (!game) {
    return null;
  }

  const me = game.players[playerId];
  if (!me) {
    return (
      <Screen>
        <Text style={styles.status}>You are not a player in this game.</Text>
        <Button label="Back to Home" onPress={leave} />
      </Screen>
    );
  }

  const confirmQuit = () =>
    Alert.alert(
      'Leave this game?',
      `The others will be waiting for your moves. You can rejoin with code ${game.code}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leave },
      ],
    );

  const { phase, pending, currentTurnPlayer, turnNumber } = game.state;
  const disabled = !connected || busy;
  const opponents = game.playerOrder.filter(id => id !== playerId);
  const mustLose =
    phase === 'loseInfluence' && pending?.loseInfluence?.playerId === playerId;
  const exchangeOptions =
    phase === 'exchange' && pending?.actor === playerId
      ? pending.exchangeOptions
      : null;

  return (
    <Screen>
      <ConnectionBanner connected={connected} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.opponents}
        contentContainerStyle={styles.opponentsContent}
      >
        {opponents.map(id => (
          <PlayerSeat
            key={id}
            player={game.players[id]}
            isTurn={id === currentTurnPlayer}
          />
        ))}
      </ScrollView>

      <View style={styles.middle}>
        <View style={styles.statusBox}>
          <Text style={styles.status}>{statusLine(game)}</Text>
          <Text style={styles.meta}>
            Turn {turnNumber} · Deck {game.deck.length} · Code {game.code}
          </Text>
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </View>
        <GameLog log={game.log} />
        <Button label="Quit" variant="secondary" onPress={confirmQuit} />
      </View>

      <View style={styles.bottom}>
        <View
          style={[
            styles.hand,
            currentTurnPlayer === playerId && styles.handTurn,
          ]}
        >
          {me.influence.map((influence, index) => (
            <CardView
              key={index}
              card={influence.card}
              revealed={influence.revealed}
            />
          ))}
          <Text style={styles.coins}>{me.coins} coins</Text>
        </View>
        <View style={styles.controls}>
          {exchangeOptions ? (
            <ExchangePicker
              options={exchangeOptions}
              keepCount={unrevealedCount(me)}
              disabled={disabled}
              onConfirm={keep =>
                act({ type: 'exchangeChoose', playerId, keep })
              }
            />
          ) : mustLose ? (
            <LoseInfluencePicker
              player={me}
              disabled={disabled}
              onPick={cardIndex =>
                act({ type: 'loseInfluence', playerId, cardIndex })
              }
            />
          ) : (
            <>
              <ResponsePrompt
                game={game}
                playerId={playerId}
                disabled={disabled}
                onAction={act}
              />
              <ActionBar
                game={game}
                playerId={playerId}
                disabled={disabled}
                onAction={act}
              />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opponents: { flexGrow: 0 },
  opponentsContent: { flexGrow: 1, justifyContent: 'center' },
  middle: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statusBox: { flex: 1 },
  status: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  bottom: { flexDirection: 'row', alignItems: 'flex-end' },
  hand: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.background,
  },
  handTurn: { borderColor: colors.primary },
  coins: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
  },
  controls: { flex: 1, marginLeft: spacing.sm },
});
