import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from './src/components/Button';
import { Screen } from './src/components/Screen';
import { GameProvider, useGame } from './src/context/GameContext';
import { ProfileProvider, useProfile } from './src/context/ProfileContext';
import { isConfigured } from './src/firebase/config';
import { GameOverScreen } from './src/screens/GameOverScreen';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, spacing } from './src/theme';

function GameRouter() {
  const { ready, gameId, game, loaded, error, leave } = useGame();

  if (!ready) {
    return <Screen>{null}</Screen>;
  }
  if (!gameId) {
    return <HomeScreen />;
  }
  if (!game) {
    return (
      <Screen>
        <Text style={styles.message}>
          {loaded ? 'This game no longer exists.' : 'Loading game…'}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Back to Home" variant="secondary" onPress={leave} />
      </Screen>
    );
  }
  switch (game.status) {
    case 'waiting':
      return <LobbyScreen />;
    case 'playing':
      return <GameScreen />;
    case 'finished':
      return <GameOverScreen />;
  }
}

function ProfileRouter() {
  const { loading, profile } = useProfile();

  if (loading) {
    return <Screen>{null}</Screen>;
  }
  if (!profile) {
    return <WelcomeScreen />;
  }
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default function App() {
  if (!isConfigured()) {
    return <SetupScreen />;
  }
  return (
    <ProfileProvider>
      <ProfileRouter />
    </ProfileProvider>
  );
}

const styles = StyleSheet.create({
  message: { color: colors.text, fontSize: 16, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
});
