import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { createProfileStore, ProfileStore } from '../profile/profileStore';
import { createSettingsStore, SettingsStore } from '../profile/settingsStore';
import { firebaseConfig } from './config';
import { createGameService, GameService } from './gameService';

interface Services {
  games: GameService;
  profiles: ProfileStore;
  settings: SettingsStore;
}

let services: Services | null = null;

/** Built on first use so the app can show the setup screen when the config is still a placeholder. */
export function getServices(): Services {
  if (!services) {
    const db = getDatabase(initializeApp(firebaseConfig));
    // AsyncStorage v3: a named storage instance (the default export is the discouraged v2 legacy storage).
    // Profiles and settings share it; their keys do not overlap.
    const storage = createAsyncStorage('coup');
    services = {
      games: createGameService(db),
      profiles: createProfileStore(storage, (playerId, profile) =>
        set(ref(db, `profiles/${playerId}`), profile),
      ),
      settings: createSettingsStore(storage),
    };
  }
  return services;
}
