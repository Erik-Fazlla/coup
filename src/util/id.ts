/** Random id safe to use as a Realtime Database key. Identifies a device/player; not a secret. */
export function generateId(rng: () => number = Math.random): string {
  let id = 'p';
  for (let i = 0; i < 20; i++) {
    id += Math.floor(rng() * 36).toString(36);
  }
  return id;
}
