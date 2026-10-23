import { cyclePanes } from './lib/navigation.ts'
import { matchesShortcut, type ShortcutBinding } from './lib/shortcuts.ts'
import { shortcutBlockReason, type ShortcutEffects } from './lib/shortcutPolicy.ts'

export interface Command extends ShortcutEffects {
  id: string
  title: string
  /** Secondary text shown after the title in the palette, e.g. a commit subject. */
  detail?: string
  category: string
  /** e.g. "Ctrl+Shift+P". Ctrl also matches Cmd on macOS. */
  keys?: string
  /** Shorter name for the shortcuts cheat sheet, when the title is contextual. */
  help?: string
  /** App-wide (works on every screen, handled in App.tsx); views list it but don't bind its keys. */
  global?: boolean
  /** Disabled commands are hidden from the palette and their shortcuts do nothing. */
  enabled?: boolean
  allowInInput?: boolean
  allowRepeat?: boolean
  allowInOverlay?: boolean
  /** Also a widget key: the focused list handles it first (see lib/keymap.ts). */
  widgetFallback?: boolean
  /** False means this command doesn't own its shortcut right now; lower scopes may use the key. */
  when?: () => boolean
  /** Shortcut availability is separate from explicitly running a command in the palette. */
  shortcutDisabledReason?: string
  run: () => void
}

// The website demo shares the palette without Electron's preload bridge.
const isMac = () => (window.bridge?.platform ?? (/Mac/.test(navigator.platform) ? 'darwin' : '')) === 'darwin'

/** App-wide navigation uses the same registry entries for dispatch, palette and help. */
export const NAVIGATION_COMMANDS: Command[] = [
  { id: 'next-pane', title: 'Next pane', category: 'General', keys: 'F6', global: true, allowInOverlay: true, run: () => cyclePanes(false) },
  { id: 'prev-pane', title: 'Previous pane', category: 'General', keys: 'Shift+F6', global: true, allowInOverlay: true, run: () => cyclePanes(true) }
]

/** The key name of an event, layout-independent for letters, digits and a few symbols. */
export function matchKeys(keys: string, e: KeyboardEvent) {
  return matchesShortcut(commandKeys(keys), e, isMac() ? 'mac' : 'other')
}

/** Command labels use Ctrl; execution uses the platform primary modifier. */
export const commandKeys = (keys: string) => keys.replace(/\bCtrl\+/gi, 'Mod+')

export function commandBinding(command: Command): ShortcutBinding {
  return {
    id: command.id, keys: commandKeys(command.keys!), run: command.run,
    when: command.when,
    enabled: command.enabled,
    allowInInput: command.allowInInput ?? firesInInput(command.keys!),
    allowRepeat: command.allowRepeat,
    allowInOverlay: command.allowInOverlay,
    widgetFallback: command.widgetFallback,
    disabledReason: (context) => shortcutBlockReason(command, context)
  }
}

/** Whether a shortcut may fire while focus is in a text field. */
export function firesInInput(keys: string) {
  return /ctrl|alt|^f\d+$/i.test(keys) || /\+f\d+$/i.test(keys)
}

export function displayKeys(keys: string) {
  return isMac() ? keys.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : keys
}

export function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
