import { matchesShortcut, shortcutSignature, type ShortcutBinding, type ShortcutKey, type ShortcutPlatform } from './shortcuts.ts'

/**
 * Widget keymap: the single declaration of keys a focused pane owns.
 *
 * Ownership rule (see AGENTS.md "Shortcut scopes"):
 *  1. Text fields own text editing.
 *  2. The focused widget owns moving and selecting inside itself. Its keys are declared here;
 *     components supply what each action does and never test modifiers themselves.
 *  3. Everything that changes the app, repository or layout is a command in the shortcut
 *     dispatcher, which only sees keys no widget consumed.
 * Overlaps between a command and a widget key are reported unless the command declares
 * `widgetFallback`.
 */
export type WidgetRole = 'list' | 'graph' | 'diff'

export type WidgetAction =
  | 'activate' | 'deeper' | 'back' | 'dismiss' | 'discard' | 'menu'
  | 'select' | 'toggleSelect' | 'selectAll' | 'moveFocus' | 'search' | 'switchList' | 'switchView'
  | 'nextHunk' | 'prevHunk' | 'fileNext' | 'filePrev' | 'fileFirst' | 'fileLast'

export interface WidgetKey {
  action: WidgetAction
  roles: readonly WidgetRole[]
  /** Shortcut syntax of lib/shortcuts.ts. Used for matching, collision checks and tests. */
  keys: readonly string[]
  /** Layout-sensitive keys (for example "/") override matching but still declare `keys`. */
  match?: (e: ShortcutKey) => boolean
  /** Shown in the keyboard help. Entries without it are described by pane-specific help rows. */
  help?: { title: string; keys: string; category: string }
}

/** Explicit list search is the same in default and Vim navigation. "/" follows the typed character. */
export function isListSearchKey(e: Pick<ShortcutKey, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'>) {
  return !e.isComposing && !e.altKey && (
    (e.key === '/' && !e.ctrlKey && !e.metaKey)
    || (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey) && !e.shiftKey)
  )
}

const ALL: readonly WidgetRole[] = ['list', 'graph', 'diff']
const MOVE_FOCUS = ['Mod+ArrowUp', 'Mod+ArrowDown', 'Mod+Home', 'Mod+End', 'Mod+PageUp', 'Mod+PageDown']

export const WIDGET_KEYMAP: readonly WidgetKey[] = [
  { action: 'activate', roles: ALL, keys: ['Enter'] },
  { action: 'deeper', roles: ALL, keys: ['ArrowRight'] },
  { action: 'back', roles: ALL, keys: ['ArrowLeft'] },
  { action: 'dismiss', roles: ALL, keys: ['Escape'] },
  { action: 'discard', roles: ALL, keys: ['Delete'] },
  { action: 'menu', roles: ALL, keys: ['ContextMenu', 'Shift+F10'] },
  { action: 'search', roles: ['list', 'graph'], keys: ['/', 'Mod+F'], match: isListSearchKey,
    help: { title: 'Search the focused list', keys: '/ or Ctrl+F', category: 'Navigation' } },
  { action: 'switchList', roles: ['list'], keys: ['t'],
    help: { title: 'History file list: switch between changed and all files', keys: 'T', category: 'History' } },
  { action: 'switchView', roles: ['list', 'diff'], keys: ['v'],
    help: { title: 'Changed files: switch between list and tree', keys: 'V (file list or diff)', category: 'Navigation' } },

  { action: 'select', roles: ['graph'], keys: ['Space', 'Shift+Space'] },
  { action: 'toggleSelect', roles: ['graph'], keys: ['Mod+Space'],
    help: { title: 'Toggle comparison endpoint', keys: 'Ctrl+Space', category: 'History' } },
  { action: 'moveFocus', roles: ['graph'], keys: MOVE_FOCUS,
    help: { title: 'Move commit focus without selecting', keys: 'Ctrl+↑↓, Ctrl+Home/End, Ctrl+PageUp/PageDown', category: 'History' } },

  { action: 'toggleSelect', roles: ['diff'], keys: ['Space', 'Shift+Space', 'Mod+Space'] },
  { action: 'selectAll', roles: ['diff'], keys: ['Mod+A'] },
  { action: 'nextHunk', roles: ['diff'], keys: ['n', 'Shift+n', 'Alt+ArrowDown'],
    help: { title: 'Next / previous hunk', keys: 'N / P', category: 'Diff' } },
  { action: 'prevHunk', roles: ['diff'], keys: ['p', 'Shift+p', 'Alt+ArrowUp'] },
  { action: 'fileNext', roles: ['diff'], keys: ['Alt+PageDown'],
    help: { title: 'Next / previous file (stops at ends of current list)', keys: 'Alt+PageDown / Alt+PageUp', category: 'Diff' } },
  { action: 'filePrev', roles: ['diff'], keys: ['Alt+PageUp'] },
  { action: 'fileFirst', roles: ['diff'], keys: ['Alt+Home'],
    help: { title: 'First / last file in current list', keys: 'Alt+Home / Alt+End', category: 'Diff' } },
  { action: 'fileLast', roles: ['diff'], keys: ['Alt+End'] }
]

/** The action the focused widget gives this key, if any. Exact modifiers; IME input never matches. */
export function widgetAction(e: ShortcutKey, role: WidgetRole, platform: ShortcutPlatform = 'other'): WidgetAction | undefined {
  for (const entry of WIDGET_KEYMAP) {
    if (!entry.roles.includes(role)) continue
    if (entry.match ? entry.match(e) : entry.keys.some((keys) => matchesShortcut(keys, e, platform))) return entry.action
  }
}

/** Bindings whose keys a widget also owns, unless they declare themselves a fallback. */
export function widgetCollisions(bindings: readonly Pick<ShortcutBinding, 'id' | 'keys' | 'widgetFallback'>[], platform: ShortcutPlatform = 'other') {
  const claimed = new Map<string, { action: WidgetAction; roles: readonly WidgetRole[] }>()
  for (const entry of WIDGET_KEYMAP) for (const keys of entry.keys) claimed.set(shortcutSignature(keys, platform), entry)
  const collisions: { binding: string; keys: string; action: WidgetAction }[] = []
  for (const binding of bindings) {
    if (binding.widgetFallback) continue
    for (const keys of typeof binding.keys === 'string' ? [binding.keys] : binding.keys) {
      const entry = claimed.get(shortcutSignature(keys, platform))
      if (entry) collisions.push({ binding: binding.id, keys, action: entry.action })
    }
  }
  return collisions
}

/**
 * Starts the focused-or-given list's own search from outside it (the Find command).
 * The list handles it exactly like a typed key, so there is one search implementation.
 */
export function requestPaneSearch(list: HTMLElement, platform: ShortcutPlatform = 'other') {
  list.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'f', code: 'KeyF', ctrlKey: platform !== 'mac', metaKey: platform === 'mac', bubbles: true, cancelable: true
  }))
}
