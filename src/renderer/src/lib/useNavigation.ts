import { useEffect, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useSettings } from '../settings'
import { vimArrow, createVimMotions, markHalfPage, movementDelta, isListSearchKey, canHandleNavigation, navigationAction } from './navigation'
import { resizeChord, resizeFocusedPane } from './paneResize'

/** Shared explicit search in lists; Vim adds aliases to existing pane/RAC arrow handlers. */
export function useNavigation({ kind = 'list', withHalfPage }: {
  kind?: 'list' | 'diff' | 'menu'; withHalfPage?: (run: () => void) => void
} = {}) {
  const { vimNavigation } = useSettings()
  const motions = useMemo(createVimMotions, [])
  useEffect(() => { motions.reset() }, [vimNavigation, motions])
  const navigate = (e: ReactKeyboardEvent, search?: () => void): boolean => {
    const target = e.target as HTMLElement
    if (!canHandleNavigation(e)) {
      motions.reset()
      return false
    }
    const resize = kind === 'list' ? resizeChord(e) : undefined
    if (resize) {
      // Collections would otherwise treat Shift+arrow as extending the selection.
      e.preventDefault()
      e.stopPropagation()
      resizeFocusedPane(resize, target)
      return true
    }
    if (kind === 'list' && !e.ctrlKey && !e.metaKey && !e.altKey && movementDelta(e.key) !== undefined && target.closest('[role="row"]')) {
      const boundary = e.currentTarget
      // A virtualized source row can unmount before RAC focuses its destination.
      // Recover only the library's roving focus target, never a different pane/selection.
      requestAnimationFrame(() => {
        if (!target.isConnected && boundary.isConnected && document.activeElement === document.body)
          boundary.querySelector<HTMLElement>('[role="row"][tabindex="0"]')?.focus({ preventScroll: true })
      })
    }
    const motion = vimNavigation && kind !== 'menu' ? motions.read(e.nativeEvent, target) : undefined
    if (motion) {
      e.preventDefault()
      e.stopPropagation()
      if (motion !== 'prefix') {
        const event = new KeyboardEvent('keydown', { key: motion, code: motion, bubbles: true, cancelable: true, repeat: e.repeat })
        const dispatch = () => target.dispatchEvent(event)
        if (motion === 'PageDown' || motion === 'PageUp') {
          markHalfPage(event)
          if (withHalfPage) withHalfPage(dispatch)
          else dispatch()
        } else dispatch()
      }
      return true
    }
    const finding = !!search && isListSearchKey(e.nativeEvent)
    if (!finding && (e.ctrlKey || e.metaKey || e.altKey)) return false
    const arrow = vimNavigation ? vimArrow(e.nativeEvent) : undefined
    // The view's own switch keys are not type-ahead; let the pane's handler see them.
    const switching = kind === 'list' ? navigationAction(e.nativeEvent) : undefined
    if (switching === 'switchList' || switching === 'switchView') return false
    if (!arrow && !finding && !(kind === 'list' && e.key.length === 1 && e.key !== ' ')) return false
    e.preventDefault()
    e.stopPropagation()
    if (arrow) {
      // Re-enter at the same target so RAC retains scrolling and selection anchors. Arrows
      // aren't remapped, so the new event passes straight through this capture handler.
      target.dispatchEvent(new KeyboardEvent('keydown', { key: arrow, code: arrow, bubbles: true, cancelable: true, repeat: e.repeat }))
    } else if (finding) search?.()
    return true
  }
  return Object.assign(navigate, { reset: motions.reset })
}
