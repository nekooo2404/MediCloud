import type {DefinedTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import '@astryxdesign/theme-neutral/theme.css';
import '@astryxdesign/theme-neutral/fonts.css';

export const themeCatalog = {
  neutral: neutralTheme,
} satisfies Record<string, DefinedTheme>;

export type ThemeName = keyof typeof themeCatalog;

export function formatThemeName(name: string) {
  return name[0] ? name[0].toUpperCase() + name.slice(1) : 'Neutral';
}
