import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getServices } from '../firebase';
import { colors, spacing } from '../theme';
import { Button } from './Button';

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
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{error.message}</Text>
        <Button label="Back to Home" onPress={this.backToHome} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
