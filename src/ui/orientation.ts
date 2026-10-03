import { useWindowDimensions } from 'react-native';

/** True when the window is at least as tall as it is wide. Follows rotation. */
export function useIsPortrait(): boolean {
  const { width, height } = useWindowDimensions();
  return height >= width;
}
