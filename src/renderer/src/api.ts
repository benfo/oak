import type { Handlers } from '../../main/handlers'
import type { MenuItem } from '../../shared/types'
import { lastInputWasKeyboard, lastPointer } from './lib/focusRing'
import { openContextMenu } from './components/ContextMenu'

type Api = {
  [K in keyof Handlers]: (...args: Parameters<Handlers[K]>) => Promise<Awaited<ReturnType<Handlers[K]>>>
}

export function errorMessage(e: unknown) {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}

/** Typed proxy over the main-process git handlers. */
export const api = new Proxy({} as Api, {
  get:
    (_t, name: string) =>
    (...args: unknown[]) =>
      window.bridge.invoke(name, ...args).catch((e) => {
        throw new Error(errorMessage(e))
      })
})

/**
 * A menu (React Aria, see ContextMenu.tsx); resolves with the chosen item's id, or null.
 * `anchor`: open just below it (dropdown buttons). Without one, a menu opened from the keyboard
 * (Shift+F10, the Menu key) opens at the focused row or control, and a right-click at the pointer.
 */
export function showMenu(items: MenuItem[], anchor?: Element | null) {
  const keyboard = lastInputWasKeyboard()
  if (anchor) return openContextMenu(items, anchor, keyboard)
  const target = keyboard ? keyboardTarget() : null
  if (!target) return openContextMenu(items, lastPointer(), false)
  // Rows: a little in from their left edge, just below; controls: right under them.
  const r = target.getBoundingClientRect()
  return target.matches('[role=row], .selected, .active') ? openContextMenu(items, { x: r.left + 16, y: r.bottom }, true) : openContextMenu(items, target, true)
}

function keyboardTarget() {
  const el = document.activeElement
  if (!el || el === document.body) return null
  // A pane focused as a whole (e.g. the commit graph): use its current row.
  return el.matches('[data-pane]') ? (el.querySelector('.selected, .active') ?? el) : el
}

export const repoName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p
