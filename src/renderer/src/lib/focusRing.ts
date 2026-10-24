/*
 * When a pane shows its focus ring. The browser's :focus-visible (and React Aria's data-focus-visible)
 * switch on as soon as any key is pressed, so clicking into a list and then using the arrows would
 * suddenly show a ring. Instead a pane gets `data-focus-ring` only when focus *arrives* in it from
 * the keyboard (Tab, F6, →/←, Ctrl+1 and other shortcuts); moving around inside it keeps whatever
 * it got on arrival, and a click never shows it.
 */

let fromKeyboard = false

/** Whether the latest input was a key press (rather than the mouse). */
export const lastInputWasKeyboard = () => fromKeyboard

let pointer = { x: 0, y: 0 }
/** Where the mouse was last pressed (page coordinates): where a right-click menu opens. */
export const lastPointer = () => pointer

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

const paneOf = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-pane]') : null)

export function installFocusRing() {
  window.addEventListener(
    'pointerdown',
    (e) => {
      fromKeyboard = false
      pointer = { x: e.clientX, y: e.clientY }
      // Clicking inside a pane that showed the ring means you're using the mouse there now.
      paneOf(e.target)?.removeAttribute('data-focus-ring')
    },
    true
  )
  window.addEventListener('keydown', (e) => !MODIFIERS.has(e.key) && (fromKeyboard = true), true)
  window.addEventListener(
    'contextmenu',
    (e) => {
      // Keyboard (Menu key) contextmenu events have button 0. Menus from the keyboard open through the
      // keymap "menu" action, so the native event must not open a second, pointer-style menu.
      if (e.button === 0 && !e.ctrlKey && !(e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]'))) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      pointer = { x: e.clientX, y: e.clientY }
    },
    true
  )

  document.addEventListener('focusin', (e) => {
    const pane = paneOf(e.target)
    if (!pane || pane === paneOf(e.relatedTarget)) return
    pane.toggleAttribute('data-focus-ring', fromKeyboard)
  })
  document.addEventListener('focusout', (e) => {
    const pane = paneOf(e.target)
    if (pane && pane !== paneOf(e.relatedTarget)) pane.removeAttribute('data-focus-ring')
  })
}
