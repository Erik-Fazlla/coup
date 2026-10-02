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
  playerId: string;
  profile: Profile | null;
  setName: (name: string) => Promise<void>;
  recordResult: (gameId: string, won: boolean) => Promise<void>;
}

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { profiles } = getServices();
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const id = await profiles.getPlayerId();
      const stored = await profiles.loadProfile();
      if (active) {
        setPlayerId(id);
        setProfile(stored);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profiles]);

  const setName = useCallback(
    async (name: string) => {
      setProfile(await profiles.setName(name));
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
    () => ({ loading, playerId, profile, setName, recordResult }),
    [loading, playerId, profile, setName, recordResult],
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
