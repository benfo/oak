/** Pure shortcut policy. DOM focus, React and Git operations stay in adapters. */
export interface ShortcutKey {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  repeat?: boolean
  isComposing?: boolean
  defaultPrevented?: boolean
  keyCode?: number
  getModifierState?: (key: 'AltGraph') => boolean
}

export type ShortcutPlatform = 'mac' | 'other'

// Browser demos load shared components without Electron's preload bridge.
export const shortcutPlatform = (): ShortcutPlatform =>
  typeof window === 'undefined'
    ? 'other'
    : (window.bridge?.platform ?? (/Mac/.test(navigator.platform) ? 'darwin' : '')) === 'darwin'
      ? 'mac'
      : 'other'
export interface ShortcutContext {
  editing: boolean
  pane?: string
  view?: 'changes' | 'history'
  expanded?: 'standard' | 'code'
  busy?: boolean
  onPage?: boolean
  hidden?: boolean
}

export interface ShortcutBinding<C extends ShortcutContext = ShortcutContext> {
  id: string
  keys: string | readonly string[]
  run: (context: C) => void
  /** False means this context does not own the key; lower scopes may handle it. */
  when?: (context: C) => boolean
  /** Disabled bindings still reserve their key and shadow bindings underneath. */
  enabled?: boolean
  disabledReason?: string | ((context: C) => string | undefined)
  allowInInput?: boolean
  allowRepeat?: boolean
  /**
   * The key is also a widget key (lib/keymap.ts). The focused widget handles it first;
   * this binding is the intentional fallback when no widget did. Undeclared overlaps are reported.
   */
  widgetFallback?: boolean
  /** Only genuinely universal controls (zoom/pane cycling) cross an overlay barrier. */
  allowInOverlay?: boolean
}

export interface ShortcutScope<C extends ShortcutContext = ShortcutContext> {
  id: string
  priority?: number
  enabled?: boolean
  modal?: boolean
  bindings: readonly ShortcutBinding<C>[]
}

export type ShortcutResolution<C extends ShortcutContext = ShortcutContext> =
  | { status: 'unhandled'; consume: false }
  | {
      status: 'blocked'
      consume: boolean
      scope: string
      binding?: string
      reason: string
      /** The reason is meant to be shown to the user. */ explain?: boolean
    }
  | { status: 'handled'; consume: true; scope: string; binding: string; action: ShortcutBinding<C> }

const physicalKeys: Record<string, string> = {
  Slash: '/',
  Comma: ',',
  Backquote: '`',
  Equal: '=',
  NumpadAdd: '=',
  Minus: '-',
  NumpadSubtract: '-'
}
const keyAliases: Record<string, string> = {
  space: ' ',
  esc: 'escape',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright'
}
const parsed = new Map<string, { key: string; modifiers: Set<string> }>()

function parse(keys: string) {
  let result = parsed.get(keys)
  if (result) return result
  const parts = keys.toLowerCase().split('+')
  const key = parts.pop()!
  if (!key) throw new Error(`Missing shortcut key: ${keys}`)
  const modifiers = new Set(parts.map((part) => (part === 'control' ? 'ctrl' : part === 'cmd' ? 'meta' : part)))
  if ([...modifiers].some((part) => !['ctrl', 'meta', 'mod', 'alt', 'shift'].includes(part))) throw new Error(`Invalid shortcut: ${keys}`)
  result = { key: keyAliases[key] ?? key, modifiers }
  parsed.set(keys, result)
  return result
}

/**
 * Ctrl/Alt/Meta letter and digit shortcuts use the physical key so they work across layouts.
 * Plain and Shift+letter keys (N, P) are typed characters and follow the layout.
 */
function eventKey(e: ShortcutKey) {
  const chord = e.ctrlKey || e.metaKey || e.altKey
  if (chord && /^Key[A-Z]$/.test(e.code ?? '')) return e.code!.slice(3).toLowerCase()
  if (chord && /^Digit\d$/.test(e.code ?? '')) return e.code!.slice(5)
  return physicalKeys[e.code ?? ''] ?? e.key.toLowerCase()
}

export function isShortcutInput(e: ShortcutKey) {
  return (
    !e.defaultPrevented &&
    !e.isComposing &&
    e.keyCode !== 229 &&
    !['Dead', 'Process', 'Unidentified'].includes(e.key) &&
    !e.getModifierState?.('AltGraph')
  )
}

export function shortcutSignature(keys: string, platform: ShortcutPlatform = 'other') {
  const { key, modifiers } = parse(keys)
  const mods = new Set(modifiers)
  if (mods.delete('mod')) mods.add(platform === 'mac' ? 'meta' : 'ctrl')
  return [...mods].sort().join('+') + ':' + key
}

/** Mod is the platform primary modifier. Ctrl/Control always means the actual Control key. */
export function matchesShortcut(keys: string, e: ShortcutKey, platform: ShortcutPlatform = 'other') {
  if (!isShortcutInput(e)) return false
  const { key, modifiers } = parse(keys)
  const ctrl = modifiers.has('ctrl') || (modifiers.has('mod') && platform !== 'mac')
  const meta = modifiers.has('meta') || (modifiers.has('mod') && platform === 'mac')
  return (
    ctrl === e.ctrlKey &&
    meta === e.metaKey &&
    modifiers.has('alt') === e.altKey &&
    modifiers.has('shift') === e.shiftKey &&
    eventKey(e) === key
  )
}

/** Last mounted scope wins at equal priority. Disposal works in any order, including Strict Mode. */
export function createShortcutDispatcher<C extends ShortcutContext = ShortcutContext>(platform: ShortcutPlatform = 'other') {
  let order = 0
  const scopes = new Map<symbol, { order: number; read: () => ShortcutScope<C> }>()
  const currentScopes = () =>
    [...scopes.values()]
      .map((entry) => ({ ...entry, scope: entry.read() }))
      .filter(({ scope }) => scope.enabled !== false)
      .sort((a, b) => (b.scope.priority ?? 0) - (a.scope.priority ?? 0) || b.order - a.order)

  const resolve = (e: ShortcutKey, context: C): ShortcutResolution<C> => {
    if (!isShortcutInput(e) || context.hidden) return { status: 'unhandled', consume: false }
    let barrier: string | undefined
    for (const { scope } of currentScopes()) {
      for (const binding of scope.bindings) {
        if (binding.when && !binding.when(context)) continue
        const keys = typeof binding.keys === 'string' ? [binding.keys] : binding.keys
        if (!keys.some((keys) => matchesShortcut(keys, e, platform))) continue
        const blocked = (reason: string, consume = true, explain = false): ShortcutResolution<C> => ({
          status: 'blocked',
          consume,
          scope: scope.id,
          binding: binding.id,
          reason,
          explain
        })
        if (context.editing && !binding.allowInInput) return blocked('Text input owns this key', false)
        if (barrier && !binding.allowInOverlay) return blocked(`Blocked by ${barrier}`)
        const reason = typeof binding.disabledReason === 'function' ? binding.disabledReason(context) : binding.disabledReason
        if (reason) return blocked(reason, true, true)
        if (binding.enabled === false) return blocked('Action disabled')
        if (e.repeat && !binding.allowRepeat) return blocked('Key repeat disabled')
        return { status: 'handled', consume: true, scope: scope.id, binding: binding.id, action: binding }
      }
      if (scope.modal && !barrier) barrier = scope.id
    }
    return barrier
      ? { status: 'blocked', consume: false, scope: barrier, reason: 'Overlay owns keyboard input' }
      : { status: 'unhandled', consume: false }
  }

  return {
    register(source: ShortcutScope<C> | (() => ShortcutScope<C>)) {
      const token = Symbol()
      const read = typeof source === 'function' ? source : () => source
      scopes.set(token, { order: order++, read })
      return () => {
        scopes.delete(token)
      }
    },
    resolve,
    dispatch(e: ShortcutKey, context: C) {
      const result = resolve(e, context)
      if (result.status === 'handled') result.action.run(context)
      return result
    },
    /** Diagnostics report ambiguous bindings within a scope; cross-scope overrides are intentional. */
    conflicts(context: C) {
      const conflicts: { scope: string; keys: string; bindings: string[] }[] = []
      for (const { scope } of currentScopes()) {
        const seen = new Map<string, string[]>()
        for (const binding of scope.bindings) {
          if (binding.when && !binding.when(context)) continue
          for (const keys of typeof binding.keys === 'string' ? [binding.keys] : binding.keys) {
            const signature = shortcutSignature(keys, platform)
            seen.set(signature, [...(seen.get(signature) ?? []), binding.id])
          }
        }
        for (const [keys, bindings] of seen) if (bindings.length > 1) conflicts.push({ scope: scope.id, keys, bindings })
      }
      return conflicts
    }
  }
}

/** Local form/picker adapter. A disabled match is consumed, not forwarded to another action. */
export function handleShortcutBindings(
  e: ShortcutKey & { nativeEvent?: ShortcutKey; preventDefault: () => void; stopPropagation: () => void },
  bindings: readonly ShortcutBinding[],
  context: ShortcutContext = { editing: false },
  platform: ShortcutPlatform = 'other'
) {
  const dispatcher = createShortcutDispatcher(platform)
  dispatcher.register({ id: 'local', bindings })
  const result = dispatcher.resolve(e.nativeEvent ?? e, context)
  if (result.consume) {
    e.preventDefault()
    e.stopPropagation()
  }
  if (result.status === 'handled') result.action.run(context)
  return result.consume
}
