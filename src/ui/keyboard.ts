import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent } from 'react-native';

/**
 * The height of the on-screen keyboard, or 0 while it is hidden.
 *
 * The app draws edge to edge (`edgeToEdgeEnabled` in android/gradle.properties,
 * target SDK 36), where Android may not shrink the window for the keyboard as
 * `adjustResize` used to. Screens with a text field add this height as bottom
 * padding to what scrolls, so the field can always be brought above the keyboard.
 *
 * On a phone where the window does shrink, the padding is simply extra room to
 * scroll into: harmless.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const shown = Keyboard.addListener(
      'keyboardDidShow',
      (event?: KeyboardEvent) => {
        const height = event?.endCoordinates?.height;
        setInset(typeof height === 'number' && height > 0 ? height : 0);
      },
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return inset;
}
