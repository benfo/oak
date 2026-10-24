import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { createShortcutDispatcher, shortcutPlatform, type ShortcutContext, type ShortcutScope } from './shortcuts'
import { widgetCollisions } from './keymap'

export { shortcutPlatform }
// Created lazily: browser demos can import shared components before window.bridge exists.
let manager: ReturnType<typeof createShortcutDispatcher> | undefined
export const getShortcutDispatcher = () => (manager ??= createShortcutDispatcher(shortcutPlatform()))

export function useShortcutScope(scope: ShortcutScope) {
  const instance = useId()
  const latest = useRef(scope)
  latest.current = scope
  useLayoutEffect(() => getShortcutDispatcher().register(() => ({ ...latest.current, id: `${latest.current.id}:${instance}` })), [instance])
  // A command on a key a widget owns would silently lose (or steal) it; say so while developing.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    for (const c of widgetCollisions(latest.current.bindings, shortcutPlatform()))
      console.error(`Shortcut "${c.binding}" (${c.keys}) overlaps the widget key "${c.action}". Change it or declare widgetFallback.`)
  }, [])
}

/** Overlay mounting order defines its stack; React Aria retains focus containment and local keys. */
export function useShortcutOverlay(id: string) {
  useShortcutScope({ id, priority: 100, modal: true, bindings: [] })
}

export function shortcutContext(target: EventTarget | null): ShortcutContext {
  const element = target instanceof Element ? target : document.activeElement
  const workspace = document.querySelector<HTMLElement>('[data-workspace-layout]')
  const owner = element?.closest<HTMLElement>('[data-pane], [data-pane-owner], [data-search-pane]')
  return {
    editing: !!element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'),
    pane: owner?.dataset.pane ?? owner?.dataset.paneOwner ?? owner?.dataset.searchPane,
    view: workspace?.dataset.workspaceView as ShortcutContext['view'],
    expanded: workspace?.dataset.workspaceLayout as ShortcutContext['expanded'],
    busy: workspace?.dataset.workspaceBusy === 'true',
    onPage: element === document.body,
    hidden: !!element?.closest('[hidden], [inert]')
  }
}

/** The only application shortcut listener. Child/RAC handlers always get first refusal. */
export function useShortcutRoot(explain: (reason: string) => void) {
  const latest = useRef(explain)
  latest.current = explain
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const context = shortcutContext(e.target)
      const result = getShortcutDispatcher().resolve(e, context)
      if (result.consume) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (result.status === 'handled') result.action.run(context)
      else if (result.status === 'blocked' && result.explain && !e.repeat) latest.current(result.reason)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
