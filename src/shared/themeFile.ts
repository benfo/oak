/** A custom theme as read from a JSON file in the themes folder. */
export interface ThemeFile {
  id: string
  name: string
  base: 'light' | 'dark'
  colors: Record<string, string>
  /** Neon glow on syntax-coloured code. */
  glow?: true
}

/** What "copy the current theme" writes: a theme file without its id (the file name gives it). */
export type ThemeStarter = Omit<ThemeFile, 'id'>

/**
 * Reads one parsed theme file, keeping only well-formed fields:
 * `{ "name": "Midnight", "base": "dark", "glow": true, "colors": { "primary": "#e5534b" } }`.
 * `colors` overrides any CSS variable from tokens.css (name without `--`); `glow` counts only as `true`.
 */
export function parseThemeFile(raw: unknown, fileName: string): ThemeFile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const colors = r.colors && typeof r.colors === 'object' ? (r.colors as Record<string, unknown>) : {}
  return {
    id: `custom:${fileName}`,
    name: String(r.name ?? fileName),
    base: r.base === 'light' ? 'light' : 'dark',
    colors: Object.fromEntries(Object.entries(colors).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    ...(r.glow === true ? { glow: true as const } : {})
  }
}
