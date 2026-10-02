import {createProfileStore, Profile, winRate} from '../profileStore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
}

function setup() {
  const saved: Array<{playerId: string; profile: Profile}> = [];
  const remoteSave = jest.fn(async (playerId: string, profile: Profile) => {
    saved.push({playerId, profile});
  });
  const store = createProfileStore(memoryStorage(), remoteSave, () => 0, () => 5000);
  return {store, saved, remoteSave};
}

describe('profile store', () => {
  it('generates the player id once and reuses it', async () => {
    const {store} = setup();
    const first = await store.getPlayerId();
    expect(first).toBe('p00000000000000000000');
    expect(await store.getPlayerId()).toBe(first);
  });

  it('has no profile before a name is set', async () => {
    expect(await setup().store.loadProfile()).toBeNull();
  });

  it('creates a profile with zeroed stats and mirrors it remotely', async () => {
    const {store, saved} = setup();
    const profile = await store.setName('Erik');
    expect(profile).toEqual({name: 'Erik', gamesPlayed: 0, wins: 0, createdAt: 5000});
    expect(await store.loadProfile()).toEqual(profile);
    expect(saved).toEqual([{playerId: 'p00000000000000000000', profile}]);
  });

  it('keeps stats when the name changes', async () => {
    const {store} = setup();
    await store.setName('Erik');
    await store.recordResult('g1', true);
    expect(await store.setName('E')).toEqual({name: 'E', gamesPlayed: 1, wins: 1, createdAt: 5000});
  });

  it('records wins and losses', async () => {
    const {store} = setup();
    await store.setName('Erik');
    await store.recordResult('g1', true);
    const profile = await store.recordResult('g2', false);
    expect(profile).toMatchObject({gamesPlayed: 2, wins: 1});
  });

  it('counts each game only once', async () => {
    const {store} = setup();
    await store.setName('Erik');
    await store.recordResult('g1', true);
    const profile = await store.recordResult('g1', true);
    expect(profile).toMatchObject({gamesPlayed: 1, wins: 1});
  });

  it('returns null when recording without a profile', async () => {
    expect(await setup().store.recordResult('g1', true)).toBeNull();
  });

  it('still saves locally when the remote save fails', async () => {
    const {store, remoteSave} = setup();
    remoteSave.mockRejectedValue(new Error('offline'));
    await store.setName('Erik');
    expect(await store.loadProfile()).toMatchObject({name: 'Erik'});
  });

  it('remembers and clears the active game id', async () => {
    const {store} = setup();
    expect(await store.getActiveGameId()).toBeNull();
    await store.setActiveGameId('game-1');
    expect(await store.getActiveGameId()).toBe('game-1');
    await store.setActiveGameId(null);
    expect(await store.getActiveGameId()).toBeNull();
  });
});

describe('winRate', () => {
  it('is 0 with no games and a rounded percentage otherwise', () => {
    expect(winRate({name: 'x', gamesPlayed: 0, wins: 0, createdAt: 0})).toBe(0);
    expect(winRate({name: 'x', gamesPlayed: 3, wins: 2, createdAt: 0})).toBe(67);
  });
});
