import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video, { ResizeMode, VideoRef } from 'react-native-video';
import { useProfile } from '../context/ProfileContext';
import { MAX_NAME_LENGTH } from '../engine/lobby';
import { READING_FONT_SCALE, spacing } from '../theme';
import { useKeyboardInset } from '../ui/keyboard';
import { motionEnabled, usePressScale } from '../ui/motion';

const INTRO = require('../../assets/video/clip1_intro.mp4');
const OUTRO = require('../../assets/video/clip2_throw.mp4');
/** The intro's very last frame, shown once the intro has ended so it can never go black. */
const INTRO_LAST_FRAME = require('../../assets/images/intro_last_frame.jpg');

/** Both clips are 16:9. */
const VIDEO_ASPECT = 16 / 9;
/** The man fills the left of the picture; the form lives in the empty right part. */
const FORM_STARTS_AT = 0.45;
/** He stops gliding in at about 0.9 s: the form fades in from then until about 1.6 s. */
const FORM_DELAY_MS = 900;
const FORM_FADE_MS = 700;
/** If the intro never starts (no decoder, say), the form appears anyway after this long. */
const FORM_FALLBACK_MS = 4000;
const FORM_FADE_OUT_MS = 180;
/** The outro is about 3.7 s; past this the next screen opens whatever the video is doing. */
export const OUTRO_TIMEOUT_MS = 6000;

export const CYAN = '#00E5FF';
export const ELECTRIC_BLUE = '#1E6BFF';
/** The colour of the outro's final frame: the next screen fades in from it. */
export const OUTRO_FLASH_COLOR = '#FFFCFD';

const SAVE_ERROR = 'Could not save your name on this device. Try again.';

interface Props {
  /**
   * Called just before the name is saved (which opens the next screen).
   * `flash`: the outro played to its end, so the screen is now its bright
   * flash and the next screen should fade in from that colour.
   */
  onLeaving?: (flash: boolean) => void;
}

/** Where a 16:9 picture sits when it is fitted ("contain") into a window of this size. */
export function containedRect(width: number, height: number) {
  const videoWidth = Math.min(width, height * VIDEO_ASPECT);
  const videoHeight = videoWidth / VIDEO_ASPECT;
  return {
    left: (width - videoWidth) / 2,
    top: (height - videoHeight) / 2,
    width: videoWidth,
    height: videoHeight,
  };
}

/**
 * First launch: the intro clip plays and the name form fades in over the empty
 * right side of the picture. Continue plays the outro clip, then saves the name
 * (exactly as before, through `setName`), which opens the next screen.
 */
export function WelcomeScreen({ onLeaving }: Props) {
  const { setName, startupError } = useProfile();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const window = useWindowDimensions();
  const [size, setSize] = useState({
    width: window.width,
    height: window.height,
  });

  const [text, setText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The player tapped Continue: the outro plays (or the name is being saved). */
  const [leaving, setLeaving] = useState(false);
  /** The intro reached its end (or was cut short): its last frame is shown as a still picture. */
  const [introEnded, setIntroEnded] = useState(false);
  /** The still is on screen, so the intro's player is let go and the outro's is loaded. */
  const [introReleased, setIntroReleased] = useState(false);
  /** The outro's first frame is drawn (behind the still), so it can take over at once. */
  const [outroDisplayed, setOutroDisplayed] = useState(false);
  const [outroFailed, setOutroFailed] = useState(false);

  const form = useRef(new Animated.Value(0)).current;
  const formShown = useRef(false);
  const finished = useRef(false);
  const outroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outro = useRef<VideoRef>(null);
  const { scale, onPressIn, onPressOut } = usePressScale();

  const name = text.trim();
  const canContinue = name.length > 0 && !leaving;
  const error = saveError ?? startupError;

  const showForm = useCallback(
    (delay: number) => {
      if (formShown.current) {
        return;
      }
      formShown.current = true;
      if (!motionEnabled()) {
        form.setValue(1);
        return;
      }
      Animated.timing(form, {
        toValue: 1,
        delay,
        duration: FORM_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [form],
  );

  // Whatever the intro does, the player can always reach the form.
  useEffect(() => {
    const timer = setTimeout(() => showForm(0), FORM_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [showForm]);

  useEffect(
    () => () => {
      if (outroTimer.current) {
        clearTimeout(outroTimer.current);
      }
    },
    [],
  );

  /** Ends the outro (once) and saves the name, which opens the next screen. */
  const finish = useCallback(
    async (flash: boolean) => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      if (outroTimer.current) {
        clearTimeout(outroTimer.current);
        outroTimer.current = null;
      }
      // SOUND HOOK: a short "flash" sound effect could start here (when `flash` is true),
      // through playSound() in src/ui/sound.ts, if settings.sound is on.
      onLeaving?.(flash);
      try {
        await setName(name);
      } catch {
        // Back to the form, over the intro's last frame, so the player can try again.
        setSaveError(SAVE_ERROR);
        finished.current = false;
        try {
          outro.current?.seek(0);
        } catch {}
        setLeaving(false);
        formShown.current = false;
        showForm(0);
      }
    },
    [name, onLeaving, setName, showForm],
  );

  // Leaving the app mid-outro: skip the rest of it rather than resume a half-played clip.
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        finish(false);
      }
    });
    // Optional: some test environments hand back no subscription.
    return () => subscription?.remove();
  }, [leaving, finish]);

  const submit = () => {
    if (!canContinue) {
      return;
    }
    setSaveError(null);
    setLeaving(true);
    // Tapped before the intro ended: jump to its last frame, which the outro starts from.
    setIntroEnded(true);
    Keyboard.dismiss();
    if (outroFailed) {
      return finish(false);
    }
    // SOUND HOOK: a "whoosh" sound effect for the card throw could start here,
    // through playSound() in src/ui/sound.ts, if settings.sound is on.
    if (motionEnabled()) {
      Animated.timing(form, {
        toValue: 0,
        duration: FORM_FADE_OUT_MS,
        useNativeDriver: true,
      }).start();
    } else {
      form.setValue(0);
    }
    outroTimer.current = setTimeout(() => finish(false), OUTRO_TIMEOUT_MS);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ width, height });
    }
  };

  const video = containedRect(size.width, size.height);
  // The form's column: the empty right part of the picture, kept clear of a camera cut-out.
  const columnLeft = video.left + video.width * FORM_STARTS_AT;
  const columnRight = Math.min(
    video.left + video.width,
    size.width - insets.right,
  );
  const columnWidth = Math.max(0, columnRight - columnLeft);
  // The keyboard rises from the bottom of the screen; only the part over the picture counts.
  const keyboardOverVideo = Math.max(
    0,
    keyboardInset - (size.height - (video.top + video.height)),
  );
  const compact = keyboardInset > 0 || video.height < 330;
  const titleSize = compact
    ? 34
    : Math.max(44, Math.min(76, video.height * 0.17));
  const fieldWidth = Math.max(0, Math.min(300, columnWidth - spacing.lg * 2));

  const picture = {
    position: 'absolute' as const,
    left: video.left,
    top: video.top,
    width: video.width,
    height: video.height,
  };

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <StatusBar hidden />

      {/*
        Android draws each video on its own surface, which cannot be made see-through
        (react-native-video 6.19 ignores `viewType`), so only one player is shown at a
        time and the still picture, an ordinary view, covers the hand-over:
          intro plays -> intro ends -> still of its last frame on top, intro let go,
          outro loaded paused behind the still -> Continue -> still removed, outro plays.
      */}
      {introReleased && !outroFailed && (
        <Video
          testID="outro-video"
          ref={outro}
          source={OUTRO}
          style={picture}
          resizeMode={ResizeMode.CONTAIN}
          muted
          repeat={false}
          controls={false}
          paused={!leaving}
          disableFocus
          hideShutterView
          shutterColor="transparent"
          playInBackground={false}
          onReadyForDisplay={() => setOutroDisplayed(true)}
          onEnd={() => finish(true)}
          onError={() => {
            setOutroFailed(true);
            if (leaving) {
              finish(false);
            }
          }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {!introReleased && (
        <Video
          testID="intro-video"
          source={INTRO}
          style={picture}
          resizeMode={ResizeMode.CONTAIN}
          muted
          repeat={false}
          controls={false}
          paused={introEnded || leaving}
          disableFocus
          hideShutterView
          shutterColor="transparent"
          playInBackground={false}
          onReadyForDisplay={() => showForm(FORM_DELAY_MS)}
          onEnd={() => setIntroEnded(true)}
          onError={() => {
            setIntroEnded(true);
            showForm(0);
          }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {introEnded && !(leaving && outroDisplayed) && (
        <Image
          testID="intro-still"
          source={INTRO_LAST_FRAME}
          style={picture}
          resizeMode="contain"
          fadeDuration={0}
          onLoadEnd={() => setIntroReleased(true)}
          accessible={false}
        />
      )}

      <Animated.View
        pointerEvents={leaving ? 'none' : 'box-none'}
        style={[
          styles.column,
          {
            left: columnLeft,
            top: video.top,
            width: columnWidth,
            height: video.height,
            opacity: form,
            transform: [
              {
                translateX: form.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* A scroll view so the field can be reached with the keyboard up. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: keyboardOverVideo },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.title,
              {
                fontSize: titleSize,
                letterSpacing: titleSize * 0.18,
                // letterSpacing also pads the last letter; pull the word back to centre.
                marginRight: -titleSize * 0.18,
              },
            ]}
            maxFontSizeMultiplier={1}
            accessibilityRole="header"
          >
            COUP
          </Text>
          {error && (
            <Text
              style={[styles.error, { maxWidth: fieldWidth }]}
              maxFontSizeMultiplier={READING_FONT_SCALE}
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          )}
          <Text style={styles.label} maxFontSizeMultiplier={READING_FONT_SCALE}>
            Choose your player name
          </Text>
          <TextInput
            style={[styles.input, { width: fieldWidth }]}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            editable={!leaving}
            returnKeyType="done"
            maxLength={MAX_NAME_LENGTH}
            placeholder="Name"
            placeholderTextColor="rgba(191, 247, 255, 0.45)"
            selectionColor={CYAN}
            cursorColor={CYAN}
            autoCorrect={false}
            maxFontSizeMultiplier={READING_FONT_SCALE}
            // In landscape Android would otherwise replace the whole screen with the keyboard's own edit field.
            disableFullscreenUI
            underlineColorAndroid="transparent"
            accessibilityLabel="Player name"
          />
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
              onPress={submit}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={!canContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !canContinue }}
              style={[
                styles.button,
                { width: fieldWidth },
                canContinue ? styles.buttonOn : styles.buttonOff,
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  !canContinue && styles.buttonTextOff,
                ]}
                maxFontSizeMultiplier={READING_FONT_SCALE}
              >
                Continue
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  column: { position: 'absolute' },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    color: '#E6FDFF',
    fontWeight: '800',
    marginBottom: spacing.md,
    textShadowColor: CYAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  error: {
    fontSize: 12,
    color: '#f87171',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#BFF7FF',
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    color: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: CYAN,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    boxShadow: '0 0 12px rgba(0, 229, 255, 0.45)',
  },
  button: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOn: {
    backgroundColor: ELECTRIC_BLUE,
    borderColor: CYAN,
    boxShadow: '0 0 16px rgba(30, 107, 255, 0.75)',
  },
  buttonOff: {
    backgroundColor: '#050B16',
    borderColor: 'rgba(30, 107, 255, 0.45)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  buttonTextOff: { color: 'rgba(191, 247, 255, 0.45)' },
});
