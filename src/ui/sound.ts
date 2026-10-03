import { TurboModuleRegistry } from 'react-native';

/** The name CoupSoundModule.kt registers under. */
const MODULE_NAME = 'CoupSound';

/**
 * Every sound effect. The files are made by `npm run sounds`
 * (scripts/generate-sounds.js) and played by CoupSoundModule.kt, which knows
 * the same names.
 */
export const SOUND_NAMES = [
  'turn',
  'prompt',
  'coin',
  'card',
  'challenge',
  'win',
  'lose',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

interface NativeSound {
  play: (name: string) => void;
}

/** The native player, or null when this build does not have one (Jest, or it failed to register). */
function nativeSound(): NativeSound | null {
  try {
    // The registry finds the module wherever React Native keeps it: with the new
    // architecture a plain Kotlin module like this one is reached through the interop layer.
    const found = TurboModuleRegistry.get(MODULE_NAME) as unknown;
    return found !== null &&
      typeof found === 'object' &&
      typeof (found as Partial<NativeSound>).play === 'function'
      ? (found as NativeSound)
      : null;
  } catch {
    return null;
  }
}

/**
 * Plays one sound effect, now, over anything already playing.
 * Never throws: with no native player the app is simply silent.
 * Whether the player wants sound at all is the caller's business (`settings.sound`).
 */
export function playSound(name: SoundName): void {
  try {
    nativeSound()?.play(name);
  } catch {
    // A phone that cannot play the sound stays silent; the screen still says what happened.
  }
}

// Asking for the player once at start-up makes Android load the sounds before the first one is needed.
nativeSound();
