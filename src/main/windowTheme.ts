import { app, BrowserWindow, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * The native parts of the window that CSS can't reach (title bar buttons, the background shown
 * before the page paints, native menus) follow the theme the renderer picked. The last colours
 * are saved so the next launch starts in the right theme without a flash.
 */
export interface WindowTheme {
  /** Drives native menus and the page's `prefers-color-scheme`. */
  source: 'system' | 'light' | 'dark'
  /** Title bar / window background. */
  color: string
  /** Title bar button glyphs. */
  symbolColor: string
}

export const TITLEBAR_HEIGHT = 44

const file = () => path.join(app.getPath('userData'), 'window-theme.json')

const DEFAULTS = {
  dark: { color: '#1b1d21', symbolColor: '#e1e3e6' },
  light: { color: '#f6f7f9', symbolColor: '#1f2328' }
}

let current: WindowTheme | null = null

/** Call once at startup, before creating the window. */
export function loadWindowTheme(): WindowTheme {
  try {
    current = JSON.parse(readFileSync(file(), 'utf8')) as WindowTheme
  } catch {
    current = { source: 'system', ...DEFAULTS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'] }
  }
  nativeTheme.themeSource = current.source
  return current
}

export const titleBarOverlay = (t: WindowTheme) => ({ color: t.color, symbolColor: t.symbolColor, height: TITLEBAR_HEIGHT })

export function setWindowTheme(t: WindowTheme) {
  if (current && JSON.stringify(current) === JSON.stringify(t)) return
  current = t
  nativeTheme.themeSource = t.source
  for (const win of BrowserWindow.getAllWindows()) {
    win.setBackgroundColor(t.color)
    if (process.platform !== 'darwin') win.setTitleBarOverlay(titleBarOverlay(t))
  }
  try {
    writeFileSync(file(), JSON.stringify(t))
  } catch {
    // next launch just starts with the defaults
  }
}

// ---------- custom themes ----------

export interface ThemeFile {
  id: string
  name: string
  base: 'light' | 'dark'
  colors: Record<string, string>
}

export const themesDir = () => path.join(app.getPath('userData'), 'themes')

/**
 * Custom themes are JSON files in the themes folder:
 * `{ "name": "Midnight", "base": "dark", "colors": { "primary": "#e5534b", "background": "#0d1117" } }`
 * `colors` overrides any CSS variable from tokens.css (name without `--`). Bad files are skipped.
 */
export async function listThemes(): Promise<ThemeFile[]> {
  const files = await readdir(themesDir()).catch(() => [] as string[])
  const out: ThemeFile[] = []
  for (const f of files.filter((f) => f.toLowerCase().endsWith('.json'))) {
    try {
      const raw = JSON.parse(await readFile(path.join(themesDir(), f), 'utf8'))
      const colors = Object.fromEntries(Object.entries(raw.colors ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>
      out.push({
        id: `custom:${f.slice(0, -5)}`,
        name: String(raw.name ?? f.slice(0, -5)),
        base: raw.base === 'light' ? 'light' : 'dark',
        colors
      })
    } catch {
      // not valid JSON: skip it
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}
