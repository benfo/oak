import type { ReactNode } from 'react'
import { useNavigation } from '../lib/useNavigation'
import { useShortcutOverlay } from '../lib/useShortcuts'

/** Capture aliases before React Aria handles menu movement, submenus and focus. */
export function MenuNavigation({ children }: { children: ReactNode }) {
  useShortcutOverlay('menu')
  const menuKeys = useNavigation({ kind: 'menu' })
  return <div onKeyDownCapture={menuKeys}>{children}</div>
}
