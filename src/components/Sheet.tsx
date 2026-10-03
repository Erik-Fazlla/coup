import React, { useEffect } from 'react';
import {
  Animated,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  colors,
  radius,
  READING_FONT_SCALE,
  spacing,
  typography,
} from '../theme';
import { useAppear } from '../ui/motion';
import { Button } from './Button';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}

/**
 * A scrollable panel drawn over the screen it belongs to, closed by its button
 * or the hardware back key. It is a plain overlay inside the screen rather than
 * a native Modal, so the hidden status bar is left alone and it rotates with
 * everything else. Mount it only while it is open.
 */
export function Sheet({ title, onClose, children, testID }: Props) {
  const appear = useAppear();

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  return (
    <View style={styles.scrim} accessibilityViewIsModal testID={testID}>
      <Animated.View style={[styles.sheet, appear]}>
        <View style={styles.header}>
          <Text
            style={styles.title}
            accessibilityRole="header"
            numberOfLines={1}
            maxFontSizeMultiplier={READING_FONT_SCALE}
          >
            {title}
          </Text>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
    alignItems: 'center',
  },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.heading, flex: 1, color: colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
