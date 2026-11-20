import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Overlay } from 'react-aria'
import { displayKeys } from '../commands'
import { createStore } from '../lib/createStore'
import { useShortcutScope } from '../lib/useShortcuts'
import { stepZoom, useSettings, ZOOM_STEPS } from '../settings'
import { Icon } from './Icon'
import { Tip } from './Tip'

/**
 * The zoom controls, floating at the window's bottom-right corner. The whole window zooms, so the bubble
 * counter-scales (see `.zoom-bubble`): its buttons stay exactly where they are while you click + or − again.
 * Focus stays where it was (nothing here is a Tab stop): the keys are the keyboard route, shown in each
 * tooltip, so this is the mouse's.
 */
function ZoomBubble({ onHold }: { onHold: (held: boolean) => void }) {
  const { zoom } = useSettings()
  return (
    <Overlay disableFocusManagement>
      <div
        className="zoom-bubble"
        role="group"
        aria-label="Zoom"
        // A press must not move focus out of the code or list the user was in.
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => onHold(true)}
        onMouseLeave={() => onHold(false)}
      >
        <Tip label="Zoom out" keys="Ctrl+-" focusable={false}>
          <button
            className="btn zoom-step"
            tabIndex={-1}
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_STEPS[0]}
            onClick={() => stepZoom(-1)}
          >
            <Icon name="minus" size={14} />
          </button>
        </Tip>
        <strong className="zoom-level">{Math.round(zoom * 100)}%</strong>
        <Tip label="Zoom in" keys="Ctrl+=" focusable={false}>
          <button
            className="btn zoom-step"
            tabIndex={-1}
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            onClick={() => stepZoom(1)}
          >
            <Icon name="plus" size={14} />
          </button>
        </Tip>
        <button className="btn zoom-reset" tabIndex={-1} onClick={() => stepZoom(0)}>
          Reset <span className="muted">{displayKeys('Ctrl+0')}</span>
        </button>
      </div>
    </Overlay>
  )
}

const CLOSE_AFTER_MS = 3000

/** Open, and held open while the pointer is on the bubble or on the status bar's zoom item. */
const bubble = createStore({ open: false, held: false })
const setBubble = (next: Partial<ReturnType<typeof bubble.get>>) => bubble.set({ ...bubble.get(), ...next })

export const toggleZoomBubble = () => setBubble({ open: !bubble.get().open })
export const holdZoomBubble = (held: boolean) => setBubble({ held })

/**
 * Shows the bubble on every screen, Welcome included: changing the zoom (a key, the wheel, the bubble
 * itself) opens it for a few seconds, held open while the pointer is on it. Escape closes it before
 * anything else reacts.
 */
export function ZoomBubbleHost() {
  const { zoom } = useSettings()
  const { open, held } = useSyncExternalStore(bubble.subscribe, bubble.get)
  const previous = useRef(zoom)

  useEffect(() => {
    if (previous.current === zoom) return
    previous.current = zoom
    // Any change opens it, 100% included: stepping through 100% with the bubble must not close it.
    setBubble({ open: true })
  }, [zoom])

  // A bubble that closes under the pointer never sees it leave, so the hold must not outlive it.
  useEffect(() => {
    if (!open) setBubble({ held: false })
  }, [open])

  useEffect(() => {
    if (!open || held) return
    const timer = setTimeout(() => setBubble({ open: false }), CLOSE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [open, held, zoom])

  useShortcutScope({
    id: 'zoom-bubble',
    // Above the workspace scope (10), so Escape closes the bubble before it restores an expanded layout.
    priority: 20,
    enabled: open,
    bindings: [{ id: 'zoom-bubble-close', keys: 'Escape', allowInInput: true, run: () => setBubble({ open: false }) }]
  })

  return open ? <ZoomBubble onHold={holdZoomBubble} /> : null
}
