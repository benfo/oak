import { useEffect, useEffectEvent } from 'react'

/**
 * Let a second right-click open a context menu on a different target.
 * React Aria's outside-interaction handler ignores secondary buttons. Keep its modal
 * behavior, but remove the dismiss layer before the browser dispatches contextmenu.
 * `dismiss` must synchronously unmount the current menu (including its dismiss layer).
 */
export function useContextMenuRetargeting(dismiss: () => void) {
  const dismissMenu = useEffectEvent(dismiss)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2 || !(e.target instanceof Element) || e.target.closest('.menu-popover')) return
      // The original target is the soon-removed dismiss layer. Prevent its default focus
      // action from moving focus to body, then give the replacement menu a real opener.
      e.preventDefault()
      dismissMenu()
      const target = document.elementFromPoint(e.clientX, e.clientY)
      target?.closest<HTMLElement>('[data-pane]')?.focus()
      target?.closest<HTMLElement>('[role=row]')?.focus()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])
}
