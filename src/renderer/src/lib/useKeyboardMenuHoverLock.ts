import { useEffect } from 'react'

/**
 * A menu opened from the keyboard appears wherever the focus is, which may be under a mouse that
 * is just resting there. Browsers then report a hover, and React Aria answers by moving focus to
 * that row or opening its submenu, which takes the keyboard away. While the lock is on, the CSS
 * (`[data-menu-hover-lock]` in menus.css) makes menus ignore the pointer; the first real mouse
 * movement lifts it, so deliberately moving the mouse onto a row works as usual.
 */
export function useKeyboardMenuHoverLock(viaKeyboard: boolean) {
  useEffect(() => {
    if (!viaKeyboard) return
    const root = document.documentElement
    const lift = (e: PointerEvent) => {
      // A resting pointer is re-reported after layout changes with no movement; only real movement counts.
      if (e.movementX === 0 && e.movementY === 0) return
      root.removeAttribute('data-menu-hover-lock')
      window.removeEventListener('pointermove', lift, true)
    }
    root.setAttribute('data-menu-hover-lock', '')
    window.addEventListener('pointermove', lift, true)
    return () => {
      root.removeAttribute('data-menu-hover-lock')
      window.removeEventListener('pointermove', lift, true)
    }
  }, [viaKeyboard])
}
