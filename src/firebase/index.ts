import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { createProfileStore, ProfileStore } from '../profile/profileStore';
import { firebaseConfig } from './config';
import { createGameService, GameService } from './gameService';

interface Services {
  games: GameService;
  profiles: ProfileStore;
}

let services: Services | null = null;

/** Built on first use so the app can show the setup screen when the config is still a placeholder. */
export function getServices(): Services {
  if (!services) {
    const db = getDatabase(initializeApp(firebaseConfig));
    services = {
      games: createGameService(db),
      // AsyncStorage v3: a named storage instance (the default export is the discouraged v2 legacy storage).
      profiles: createProfileStore(
        createAsyncStorage('coup'),
        (playerId, profile) => set(ref(db, `profiles/${playerId}`), profile),
      ),
    };
  }
  return services;
}
