import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getServices } from '../firebase';
import { DEFAULT_SETTINGS, Settings } from '../profile/settingsStore';

interface SettingsValue {
  /** The defaults until the stored settings have been read. */
  settings: Settings;
  /** Changes take effect at once; saving to the device happens in the background. */
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { settings: store } = getServices();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Changes made before the stored settings arrive: they are newer than what was stored.
  const changedEarly = useRef<Partial<Settings>>({});
  const loaded = useRef(false);

  useEffect(() => {
    let active = true;
    store
      .load()
      .then(stored => {
        if (active) {
          setSettings({ ...stored, ...changedEarly.current });
        }
      })
      .catch(() => {
        // The defaults stay; failing to read must not stop the app.
      })
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      active = false;
    };
  }, [store]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings(current => ({ ...current, ...patch }));
      if (!loaded.current) {
        changedEarly.current = { ...changedEarly.current, ...patch };
      }
      try {
        // A failed save keeps the in-memory value; it simply is not remembered next time.
        store.save(patch).catch(() => {});
      } catch {
        // Ignore: failing to start the save must never fail the change.
      }
    },
    [store],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return value;
}
