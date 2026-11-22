'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from '../../../../astryx-themes';

export type ColorMode = 'system' | 'light' | 'dark';

interface ThemeModeContextValue {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'system',
  setMode: () => {},
});

export function usePortalThemeMode() {
  return useContext(ThemeModeContext);
}

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>('system');

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>
      <Theme theme={themes[defaultThemeSlug]} mode={mode}>
        {children}
      </Theme>
    </ThemeModeContext.Provider>
  );
}
