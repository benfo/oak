/** Keyboard pane resizing: the divider moves in the arrow's direction, like Windows Terminal. */
export type ResizeKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

export const RESIZE_KEYS: readonly ResizeKey[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
export const RESIZE_STEP = 32

/** Shift+Alt+arrow, without Ctrl/Meta. */
export function resizeChord(e: Pick<KeyboardEvent, 'key' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>): ResizeKey | undefined {
  return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey ? RESIZE_KEYS.find((key) => key === e.key) : undefined
}

export interface SplitController {
  /** Only splits whose divider is currently usable take part. */
  enabled: () => boolean
  resizeBy: (pixels: number) => void
}

const controllers = new WeakMap<Element, SplitController>()

export function registerSplit(element: Element, controller: SplitController) {
  controllers.set(element, controller)
  return () => { controllers.delete(element) }
}

/** Left/Right resize the nearest enclosing side-by-side split, Up/Down the nearest stacked one. */
export function resizeFocusedPane(key: ResizeKey, from: Element | null = document.activeElement) {
  const axis = key === 'ArrowLeft' || key === 'ArrowRight' ? 'split-row' : 'split-column'
  const sign = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
  for (let el = from?.closest('.split') ?? null; el; el = el.parentElement?.closest('.split') ?? null) {
    if (!el.classList.contains(axis)) continue
    const controller = controllers.get(el)
    if (!controller?.enabled()) continue
    controller.resizeBy(sign * RESIZE_STEP)
    return true
  }
  return false
}
