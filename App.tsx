import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from './src/components/Button';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Panel } from './src/components/Panel';
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
import { colors, spacing, typography } from './src/theme';

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
      <Fallback
        message={loaded ? 'This game no longer exists.' : 'Loading game…'}
        error={error}
        onBack={leave}
      />
    );
  }
  switch (game.status) {
    case 'waiting':
      return <LobbyScreen />;
    case 'playing':
      return <GameScreen />;
    case 'finished':
      return <GameOverScreen />;
    default:
      return (
        <Fallback
          message="This game cannot be opened."
          error={error}
          onBack={leave}
        />
      );
  }
}

function Fallback({
  message,
  error,
  onBack,
}: {
  message: string;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <Screen>
      <View style={styles.centre}>
        <Panel style={styles.panel}>
          <Text style={styles.message}>{message}</Text>
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Button label="Back to Home" variant="secondary" onPress={onBack} />
        </Panel>
      </View>
    </Screen>
  );
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
  return (
    <SafeAreaProvider>
      {isConfigured() ? (
        <ErrorBoundary>
          <ProfileProvider>
            <ProfileRouter />
          </ProfileProvider>
        </ErrorBoundary>
      ) : (
        <SetupScreen />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { alignItems: 'center', padding: spacing.lg, maxWidth: 440 },
  message: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
