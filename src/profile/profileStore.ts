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
    return raw ? (JSON.parse(raw) as Profile) : null;
  }

  async function save(profile: Profile): Promise<Profile> {
    await storage.setItem(KEYS.profile, JSON.stringify(profile));
    try {
      await remoteSave(await getPlayerId(), profile);
    } catch {
      // The device copy is the source of truth; the remote mirror catches up on the next save.
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

  /** Adds one finished game to the stats. Safe to call repeatedly for the same game. */
  async function recordResult(
    gameId: string,
    won: boolean,
  ): Promise<Profile | null> {
    const profile = await loadProfile();
    if (!profile) {
      return null;
    }
    const counted: string[] = JSON.parse(
      (await storage.getItem(KEYS.countedGames)) ?? '[]',
    );
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
