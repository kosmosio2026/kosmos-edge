'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTheme } from 'next-themes';
import type { AppPreferences } from '@/types/preference';

const STORAGE_KEY = 'parking-web-preferences';

interface PreferencesContextValue {
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
}

const defaultPreferences: AppPreferences = {
  denseMode: false,
  showFooter: true,
  showSystemStatusOnAdminHome: true,
  theme: 'light',
  language: 'ko',
  defaultLotId: '',
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { setTheme } = useTheme();
  const [preferences, setPreferences] =
    useState<AppPreferences>(defaultPreferences);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      setTheme(defaultPreferences.theme);
      document.documentElement.lang = defaultPreferences.language;
      return;
    }

    try {
      const next = { ...defaultPreferences, ...JSON.parse(raw) };
      setPreferences(next);
      setTheme(next.theme);
      document.documentElement.lang = next.language;
    } catch {
      setTheme(defaultPreferences.theme);
      document.documentElement.lang = defaultPreferences.language;
    }
  }, [setTheme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      updatePreferences: (patch) => {
        const next = { ...preferences, ...patch };
        setPreferences(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

        if (patch.theme) {
          setTheme(patch.theme);
        }

        if (patch.language) {
          document.documentElement.lang = patch.language;
        }
      },
    }),
    [preferences, setTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const value = useContext(PreferencesContext);

  if (!value) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }

  return value;
}
