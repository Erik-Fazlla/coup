import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getServices } from '../firebase';
import { Profile } from '../profile/profileStore';

interface ProfileValue {
  loading: boolean;
  /** Set when the stored player id could not be read; the app still opens so the problem can be shown. */
  startupError: string | null;
  playerId: string;
  profile: Profile | null;
  setName: (name: string) => Promise<void>;
  recordResult: (gameId: string, won: boolean) => Promise<void>;
}

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { profiles } = getServices();
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const id = await profiles.getPlayerId();
        const stored = await profiles.loadProfile();
        if (active) {
          setPlayerId(id);
          setProfile(stored);
        }
      } catch {
        if (active) {
          setStartupError(
            'Could not read saved data from this device. Your progress may not be saved.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [profiles]);

  const setName = useCallback(
    async (name: string) => {
      const id = await profiles.getPlayerId();
      const saved = await profiles.setName(name);
      setPlayerId(id);
      setProfile(saved);
    },
    [profiles],
  );

  const recordResult = useCallback(
    async (gameId: string, won: boolean) => {
      const updated = await profiles.recordResult(gameId, won);
      if (updated) {
        setProfile(updated);
      }
    },
    [profiles],
  );

  const value = useMemo(
    () => ({
      loading,
      startupError,
      playerId,
      profile,
      setName,
      recordResult,
    }),
    [loading, startupError, playerId, profile, setName, recordResult],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileValue {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }
  return value;
}
