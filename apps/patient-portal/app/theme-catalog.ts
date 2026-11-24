import type { DefinedTheme } from '@astryxdesign/core/theme'
import { butterTheme } from '@astryxdesign/theme-butter/built'
import '@astryxdesign/theme-butter/theme.css'
import { gothicTheme } from '@astryxdesign/theme-gothic/built'
import '@astryxdesign/theme-gothic/theme.css'
import { matchaTheme } from '@astryxdesign/theme-matcha/built'
import '@astryxdesign/theme-matcha/theme.css'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import '@astryxdesign/theme-neutral/theme.css'
import '@astryxdesign/theme-neutral/fonts.css'
import { stoneTheme } from '@astryxdesign/theme-stone/built'
import '@astryxdesign/theme-stone/theme.css'
import { y2kTheme } from '@astryxdesign/theme-y2k/built'
import '@astryxdesign/theme-y2k/theme.css'

// Same themes, same order as astryx.atmeta.com/themes.
export const themeCatalog = {
  neutral: neutralTheme,
  gothic: gothicTheme,
  matcha: matchaTheme,
  y2k: y2kTheme,
  butter: butterTheme,
  stone: stoneTheme,
} satisfies Record<string, DefinedTheme>

export type ThemeName = keyof typeof themeCatalog

export function formatThemeName(name: string) {
  return name === 'y2k' ? 'Y2K' : name[0].toUpperCase() + name.slice(1)
}
