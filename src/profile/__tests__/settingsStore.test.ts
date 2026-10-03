import { createSettingsStore, DEFAULT_SETTINGS } from '../settingsStore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
}

describe('settings store', () => {
  it('has both switches on by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ vibration: true, sound: true });
  });

  it('loads the defaults when nothing is stored', async () => {
    const store = createSettingsStore(memoryStorage());
    expect(await store.load()).toEqual({ vibration: true, sound: true });
  });

  it('hands out a copy so the defaults cannot be changed by a caller', async () => {
    const store = createSettingsStore(memoryStorage());
    const loaded = await store.load();
    loaded.sound = false;
    expect(DEFAULT_SETTINGS.sound).toBe(true);
    expect(await store.load()).toEqual({ vibration: true, sound: true });
  });

  it('saves a change and loads it back, keeping the other switch', async () => {
    const store = createSettingsStore(memoryStorage());
    expect(await store.save({ vibration: false })).toEqual({
      vibration: false,
      sound: true,
    });
    expect(await store.load()).toEqual({ vibration: false, sound: true });
    expect(await store.save({ sound: false })).toEqual({
      vibration: false,
      sound: false,
    });
    expect(await store.load()).toEqual({ vibration: false, sound: false });
  });

  it('keeps everything under the single key coup.settings, as JSON', async () => {
    const storage = memoryStorage();
    await createSettingsStore(storage).save({ sound: false });
    expect([...storage.data.keys()]).toEqual(['coup.settings']);
    expect(JSON.parse(storage.data.get('coup.settings')!)).toEqual({
      vibration: true,
      sound: false,
    });
  });

  it('survives a new store over the same storage', async () => {
    const storage = memoryStorage();
    await createSettingsStore(storage).save({ vibration: false });
    expect(await createSettingsStore(storage).load()).toEqual({
      vibration: false,
      sound: true,
    });
  });

  it.each([
    ['not json', '{broken'],
    ['null', 'null'],
    ['a number', '7'],
    ['a string', '"on"'],
    ['an array', '[true, false]'],
  ])(
    'falls back to the defaults when the stored value is %s',
    async (_l, raw) => {
      const storage = memoryStorage();
      storage.data.set('coup.settings', raw);
      expect(await createSettingsStore(storage).load()).toEqual(
        DEFAULT_SETTINGS,
      );
    },
  );

  it('uses the stored value for a field that is valid and the default for one that is missing', async () => {
    const storage = memoryStorage();
    storage.data.set('coup.settings', JSON.stringify({ sound: false }));
    expect(await createSettingsStore(storage).load()).toEqual({
      vibration: true,
      sound: false,
    });
  });

  it('ignores a stored field that is not a boolean, per field', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'coup.settings',
      JSON.stringify({ vibration: 'no', sound: false }),
    );
    expect(await createSettingsStore(storage).load()).toEqual({
      vibration: true,
      sound: false,
    });
  });

  it('ignores unknown stored fields', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'coup.settings',
      JSON.stringify({ vibration: false, theme: 'dark' }),
    );
    expect(await createSettingsStore(storage).load()).toEqual({
      vibration: false,
      sound: true,
    });
  });

  it('repairs a corrupt stored value on the next save', async () => {
    const storage = memoryStorage();
    storage.data.set('coup.settings', '{broken');
    const store = createSettingsStore(storage);
    expect(await store.save({ vibration: false })).toEqual({
      vibration: false,
      sound: true,
    });
    expect(JSON.parse(storage.data.get('coup.settings')!)).toEqual({
      vibration: false,
      sound: true,
    });
  });

  it('ignores patch values that are not booleans', async () => {
    const store = createSettingsStore(memoryStorage());
    await store.save({ sound: false });
    const patch = { vibration: undefined, sound: 'yes' } as any;
    expect(await store.save(patch)).toEqual({ vibration: true, sound: false });
  });

  it('does not lose a change when saves overlap', async () => {
    const store = createSettingsStore(memoryStorage());
    await Promise.all([
      store.save({ vibration: false }),
      store.save({ sound: false }),
    ]);
    expect(await store.load()).toEqual({ vibration: false, sound: false });
  });

  it('keeps working after a save fails', async () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    const setItem = jest
      .spyOn(storage, 'setItem')
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(store.save({ sound: false })).rejects.toThrow('disk full');
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
    setItem.mockRestore();
    expect(await store.save({ sound: false })).toEqual({
      vibration: true,
      sound: false,
    });
  });

  it('loads the defaults when reading the storage fails', async () => {
    const storage = memoryStorage();
    jest.spyOn(storage, 'getItem').mockRejectedValue(new Error('broken'));
    expect(await createSettingsStore(storage).load()).toEqual(DEFAULT_SETTINGS);
  });
});
