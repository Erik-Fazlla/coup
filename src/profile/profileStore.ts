import { generateId } from '../util/id';

export interface Profile {
  name: string;
  gamesPlayed: number;
  wins: number;
  createdAt: number;
}

/** The subset of AsyncStorage the store needs. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type RemoteSave = (playerId: string, profile: Profile) => Promise<void>;

const KEYS = {
  playerId: 'coup.playerId',
  profile: 'coup.profile',
  activeGameId: 'coup.activeGameId',
  countedGames: 'coup.countedGames',
};

const MAX_COUNTED_GAMES = 50;

export function winRate(profile: Profile): number {
  return profile.gamesPlayed === 0
    ? 0
    : Math.round((100 * profile.wins) / profile.gamesPlayed);
}

export function createProfileStore(
  storage: KeyValueStorage,
  remoteSave: RemoteSave,
  rng: () => number = Math.random,
  now: () => number = Date.now,
) {
  async function getPlayerId(): Promise<string> {
    const existing = await storage.getItem(KEYS.playerId);
    if (existing) {
      return existing;
    }
    const created = generateId(rng);
    await storage.setItem(KEYS.playerId, created);
    return created;
  }

  async function loadProfile(): Promise<Profile | null> {
    const raw = await storage.getItem(KEYS.profile);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Profile) : null;
    } catch {
      return null;
    }
  }

  async function loadCountedGames(): Promise<string[]> {
    try {
      const parsed = JSON.parse(
        (await storage.getItem(KEYS.countedGames)) ?? '[]',
      );
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function save(profile: Profile): Promise<Profile> {
    await storage.setItem(KEYS.profile, JSON.stringify(profile));
    try {
      // Not awaited: a remote write only resolves once the server acknowledges it, which never
      // happens offline. The device copy is the source of truth; the mirror catches up on the next save.
      remoteSave(await getPlayerId(), profile).catch(() => {});
    } catch {
      // Ignore: failing to start the mirror must never fail the local save.
    }
    return profile;
  }

  async function setName(name: string): Promise<Profile> {
    const existing = await loadProfile();
    return save(
      existing
        ? { ...existing, name }
        : { name, gamesPlayed: 0, wins: 0, createdAt: now() },
    );
  }

  async function recordResultNow(
    gameId: string,
    won: boolean,
  ): Promise<Profile | null> {
    const profile = await loadProfile();
    if (!profile) {
      return null;
    }
    const counted = await loadCountedGames();
    if (counted.includes(gameId)) {
      return profile;
    }
    await storage.setItem(
      KEYS.countedGames,
      JSON.stringify([...counted, gameId].slice(-MAX_COUNTED_GAMES)),
    );
    return save({
      ...profile,
      gamesPlayed: profile.gamesPlayed + 1,
      wins: profile.wins + (won ? 1 : 0),
    });
  }

  // Calls run one after another so overlapping calls cannot read the same stats and overwrite each other.
  let recordQueue: Promise<unknown> = Promise.resolve();

  /** Adds one finished game to the stats. Safe to call repeatedly for the same game. */
  function recordResult(gameId: string, won: boolean): Promise<Profile | null> {
    const result = recordQueue.then(() => recordResultNow(gameId, won));
    recordQueue = result.catch(() => {});
    return result;
  }

  async function getActiveGameId(): Promise<string | null> {
    return storage.getItem(KEYS.activeGameId);
  }

  async function setActiveGameId(gameId: string | null): Promise<void> {
    if (gameId) {
      await storage.setItem(KEYS.activeGameId, gameId);
    } else {
      await storage.removeItem(KEYS.activeGameId);
    }
  }

  return {
    getPlayerId,
    loadProfile,
    setName,
    recordResult,
    getActiveGameId,
    setActiveGameId,
  };
}

export type ProfileStore = ReturnType<typeof createProfileStore>;
