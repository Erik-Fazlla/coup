import { KeyValueStorage } from './profileStore';

/** Preferences that belong to this device, not to the player's profile. */
export interface Settings {
  vibration: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { vibration: true, sound: true };

const KEY = 'coup.settings';

const FIELDS = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>;

/** The booleans in `value` that belong to Settings; everything else is ignored. */
function validFields(value: unknown): Partial<Settings> {
  const found: Partial<Settings> = {};
  if (value === null || typeof value !== 'object') {
    return found;
  }
  FIELDS.forEach(field => {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === 'boolean') {
      found[field] = candidate;
    }
  });
  return found;
}

export function createSettingsStore(storage: KeyValueStorage) {
  /** Never fails: anything missing, corrupt or unreadable falls back to the default, field by field. */
  async function load(): Promise<Settings> {
    let stored: Partial<Settings> = {};
    try {
      const raw = await storage.getItem(KEY);
      stored = raw ? validFields(JSON.parse(raw)) : {};
    } catch {
      // Unreadable or not JSON: use the defaults.
    }
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  // Saves run one after another so two quick changes cannot read the same old value and overwrite each other.
  let saveQueue: Promise<unknown> = Promise.resolve();

  async function saveNow(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await load()), ...validFields(patch) };
    await storage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  /** Changes the given switches, keeps the rest, and returns the full result. Rejects if it cannot be stored. */
  function save(patch: Partial<Settings>): Promise<Settings> {
    const result = saveQueue.then(() => saveNow(patch));
    saveQueue = result.catch(() => {});
    return result;
  }

  return { load, save };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
