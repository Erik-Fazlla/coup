const mockCreateAsyncStorage = jest.fn((_name: string) => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  createAsyncStorage: (name: string) => mockCreateAsyncStorage(name),
}));
jest.mock('firebase/app', () => ({ initializeApp: jest.fn(() => ({})) }));
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  get: jest.fn(),
  onValue: jest.fn(),
  push: jest.fn(),
  ref: jest.fn(),
  runTransaction: jest.fn(),
  set: jest.fn(),
}));

import { getServices } from '../index';

describe('getServices', () => {
  it('builds the services once', () => {
    expect(getServices()).toBe(getServices());
  });

  it('provides games, profiles and settings', () => {
    const services = getServices();
    expect(typeof services.games.dispatch).toBe('function');
    expect(typeof services.profiles.getPlayerId).toBe('function');
    expect(typeof services.settings.load).toBe('function');
    expect(typeof services.settings.save).toBe('function');
  });

  it('opens one named storage and shares it between profiles and settings', async () => {
    const services = getServices();
    expect(mockCreateAsyncStorage).toHaveBeenCalledTimes(1);
    expect(mockCreateAsyncStorage).toHaveBeenCalledWith('coup');
    const storage = mockCreateAsyncStorage.mock.results[0].value;

    await services.settings.save({ sound: false });
    expect(storage.setItem).toHaveBeenCalledWith(
      'coup.settings',
      expect.any(String),
    );
    await services.profiles.setActiveGameId('g1');
    expect(storage.setItem).toHaveBeenCalledWith('coup.activeGameId', 'g1');
  });
});
