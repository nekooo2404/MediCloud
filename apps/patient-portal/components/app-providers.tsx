'use client';

import {createContext, useContext, useMemo, type ReactNode} from 'react';
import type {ThemeMode} from '@astryxdesign/core/theme';
import {Providers} from '@/app/providers';
import {themeCatalog, type ThemeName} from '@/app/theme-catalog';

interface ThemeSettings {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeSettingsContext = createContext<ThemeSettings | null>(null);

export function useThemeSettings() {
  const value = useContext(ThemeSettingsContext);
  if (value == null) {
    throw new Error('useThemeSettings must be used inside AppProviders');
  }
  return value;
}

export function AppProviders({children}: {children: ReactNode}) {
  const settings = useMemo<ThemeSettings>(
    () => ({
      themeName: 'neutral',
      setThemeName: () => {},
      mode: 'light',
      setMode: () => {},
    }),
    [],
  );

  return (
    <ThemeSettingsContext.Provider value={settings}>
      <Providers theme={themeCatalog.neutral} mode="light">
        {children}
      </Providers>
    </ThemeSettingsContext.Provider>
  );
}
