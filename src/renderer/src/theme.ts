import { api } from './api'
import { BUILT_IN_THEMES } from './builtInThemes'
import { getSettings, subscribeSettings } from './settings'
import { diffColourTokens } from './diff/diffColours'
import type { ThemeStarter } from '../../shared/themeFile'

/**
 * Themes. Every colour in the app is a CSS variable (see the top of tokens.css): the built-in
 * light and dark palettes are selected by `<html data-theme>`, and a theme can override any
 * variable on top of one of them. So a custom theme is just a base plus the tokens it changes.
 */
export interface Theme {
  id: string
  name: string
  /** The built-in palette it starts from (also decides native menus and scrollbars). */
  base: 'light' | 'dark'
  /** CSS variable overrides without the leading `--`, e.g. `{ primary: '#e5534b' }`. */
  colors?: Record<string, string>
  /** Neon glow on syntax-coloured code (styles/theme-glow.css). */
  glow?: true
}

/** 'system' follows the OS light/dark setting; anything else is a theme id. */
export type ThemeSetting = 'system' | string

const KEY = 'theme'
const CACHE = 'customThemes'
let extra: Theme[] = []
let applied: string[] = []

export const allThemes = () => [...BUILT_IN_THEMES, ...extra]

export function themeSetting(): ThemeSetting {
  try {
    return localStorage.getItem(KEY) ?? 'system'
  } catch {
    return 'system'
  }
}

const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function resolve(setting: ThemeSetting): Theme {
  const themes = allThemes()
  const byId = setting === 'system' ? undefined : themes.find((t) => t.id === setting)
  return byId ?? themes.find((t) => t.id === (systemDark.matches ? 'dark' : 'light'))!
}

/** A CSS colour in a form Electron understands (#rrggbb or rgba()). */
function normalize(color: string) {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.fillStyle = color.trim() || '#000'
  return ctx.fillStyle
}

// A theme being tried out (pickers preview as you move); null = the saved setting.
let preview: ThemeSetting | null = null

function apply() {
  const setting = preview ?? themeSetting()
  const theme = resolve(setting)
  const root = document.documentElement
  root.dataset.theme = theme.base
  root.toggleAttribute('data-glow', theme.glow === true)
  root.dataset.diffColours = getSettings().diffColours
  for (const name of applied) root.style.removeProperty(name)
  applied = []
  const colors = { ...theme.colors, ...diffColourTokens(getSettings().diffColours, theme.base) }
  for (const [key, value] of Object.entries(colors)) {
    const name = `--${key.replace(/^--/, '')}`
    root.style.setProperty(name, value)
    applied.push(name)
  }

  const css = getComputedStyle(root)
  api
    .setWindowTheme({
      source: theme.id === setting ? theme.base : 'system',
      color: normalize(css.getPropertyValue('--background')),
      symbolColor: normalize(css.getPropertyValue('--foreground'))
    })
    .catch(() => {})
}

/** Shows a theme without saving it; previewTheme(null) goes back to the saved one. */
export function previewTheme(setting: ThemeSetting | null) {
  if (preview === setting) return
  preview = setting
  apply()
}

export function setTheme(setting: ThemeSetting) {
  try {
    localStorage.setItem(KEY, setting)
  } catch {
    // still applies for this session
  }
  preview = null
  apply()
}

/** The colours a starter theme file lists: the everyday ones, not every derived tint. */
const STARTER_KEYS = [
  'background',
  'surface',
  'surface-sunken',
  'border',
  'border-strong',
  'foreground',
  'muted-foreground',
  'subtle-foreground',
  'primary',
  'primary-foreground',
  'hover',
  'danger',
  'warning',
  'warning-soft',
  'diff-add',
  'diff-add-gutter',
  'diff-add-foreground',
  'diff-del',
  'diff-del-gutter',
  'diff-del-foreground',
  'syntax-comment',
  'syntax-keyword',
  'syntax-string',
  'syntax-number',
  'syntax-function',
  'syntax-type',
  'syntax-property',
  'syntax-tag',
  'graph-lane-0',
  'graph-lane-1',
  'graph-lane-2',
  'graph-lane-3',
  'graph-lane-4',
  'graph-lane-5',
  'graph-lane-6',
  'graph-lane-7'
]

/** A ready-to-edit copy of the theme currently shown, with its resolved colour for each key. */
export function starterTheme(): ThemeStarter {
  const theme = resolve(preview ?? themeSetting())
  const probe = document.createElement('span')
  document.body.appendChild(probe)
  const colors: Record<string, string> = {}
  // The diff colours preference is laid over the theme, so the copy keeps the theme's own (or the defaults).
  const laidOver = diffColourTokens(getSettings().diffColours, theme.base)
  for (const key of STARTER_KEYS) {
    if (key in laidOver) {
      const own = theme.colors?.[key]
      if (own) colors[key] = normalize(own)
      continue
    }
    probe.style.color = `var(--${key})`
    colors[key] = normalize(getComputedStyle(probe).color)
  }
  probe.remove()
  return { name: `${theme.name} copy`, base: theme.base, ...(theme.glow ? { glow: true } : {}), colors }
}

/** Re-reads the custom theme files (themes folder) and re-applies, in case the current one changed. */
export async function loadCustomThemes() {
  extra = await api.listThemes().catch(() => [])
  try {
    localStorage.setItem(CACHE, JSON.stringify(extra))
  } catch {
    // only costs a flash of the base theme on the next launch
  }
  apply()
}

/** Call before the first render so the page never paints in the wrong theme. */
export function initTheme() {
  // Custom themes from last time, so a custom theme is right on the first paint; then refresh.
  try {
    extra = JSON.parse(localStorage.getItem(CACHE) ?? '[]')
  } catch {
    extra = []
  }
  apply()
  systemDark.addEventListener('change', () => themeSetting() === 'system' && apply())
  let diffColours = getSettings().diffColours
  subscribeSettings(() => {
    if (getSettings().diffColours === diffColours) return
    diffColours = getSettings().diffColours
    apply()
  })
  loadCustomThemes()
}
