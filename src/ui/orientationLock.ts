import { useEffect } from 'react';
import { TurboModuleRegistry } from 'react-native';

/** The name CoupOrientationModule.kt registers under. */
const MODULE_NAME = 'CoupOrientation';

interface NativeOrientation {
  lockLandscape: () => void;
  unlock: () => void;
}

function nativeOrientation(): NativeOrientation | null {
  try {
    const found = TurboModuleRegistry.get(MODULE_NAME) as unknown;
    return found !== null &&
      typeof found === 'object' &&
      typeof (found as Partial<NativeOrientation>).lockLandscape === 'function'
      ? (found as NativeOrientation)
      : null;
  } catch {
    return null;
  }
}

/**
 * Holds the phone in landscape (either way round) while the calling screen is
 * shown, then lets it follow rotation again. Never throws: without the native
 * module (Jest) nothing happens.
 */
export function useLandscapeLock(): void {
  useEffect(() => {
    try {
      nativeOrientation()?.lockLandscape();
    } catch {}
    return () => {
      try {
        nativeOrientation()?.unlock();
      } catch {}
    };
  }, []);
}
