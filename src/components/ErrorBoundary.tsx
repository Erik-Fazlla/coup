import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getServices } from '../firebase';
import { colors, spacing, typography } from '../theme';
import { Button } from './Button';
import { Panel } from './Panel';
import { Screen } from './Screen';

interface State {
  error: Error | null;
}

/** Catches render errors anywhere below it and offers a way back to the home screen. */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled UI error', error);
  }

  private backToHome = async () => {
    try {
      await getServices().profiles.setActiveGameId(null);
    } catch {
      // The stored game id is only a convenience; resetting the screen matters more.
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    // The boundary sits inside the SafeAreaProvider (App.tsx), so the fallback can use the
    // same Screen as everything else and stay clear of the camera cut-out and the system bars.
    return (
      <Screen>
        <View style={styles.centre}>
          <Panel style={styles.panel}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message} numberOfLines={6}>
              {error.message}
            </Text>
            <Button label="Back to Home" onPress={this.backToHome} />
          </Panel>
        </View>
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: {
    alignItems: 'center',
    padding: spacing.lg,
    maxWidth: 440,
    borderColor: colors.danger,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
