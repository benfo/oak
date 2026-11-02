import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../settings'
import { useShortcutScope } from '../lib/useShortcuts'
import { StatusCard, StatusItem } from './StatusItem'
import { ZoomBubble } from './ZoomBubble'

const CLOSE_AFTER_MS = 3000

/**
 * The item shows in the status bar only while the zoom is not 100%, like Chrome's address-bar icon. Changing the
 * zoom (a key, the wheel, the bubble itself) opens the bubble for a few seconds, held open while the
 * pointer is on it; clicking the item opens it any time. Escape closes it before anything else reacts.
 */
export function ZoomItem() {
  const { zoom } = useSettings()
  const previous = useRef(zoom)
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (previous.current === zoom) return
    previous.current = zoom
    // Any change opens it, 100% included: stepping through 100% with the bubble must not close it.
    setOpen(true)
  }, [zoom])

  // A bubble that closes under the pointer never sees it leave, so the hold must not outlive it.
  useEffect(() => {
    if (!open) setHeld(false)
  }, [open])

  useEffect(() => {
    if (!open || held) return
    const timer = setTimeout(() => setOpen(false), CLOSE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [open, held, zoom])

  useShortcutScope({
    id: 'zoom-bubble',
    // Above the workspace scope (10), so Escape closes the bubble before it restores an expanded layout.
    priority: 20,
    enabled: open,
    bindings: [{ id: 'zoom-bubble-close', keys: 'Escape', allowInInput: true, run: () => setOpen(false) }]
  })

  const percent = `${Math.round(zoom * 100)}%`
  return (
    <>
      {zoom !== 1 && (
        <StatusItem
          label={`Zoom ${percent}`}
          onPress={() => setOpen((o) => !o)}
          onHover={setHeld}
          card={
            <StatusCard title="Zoom" keys="Ctrl+0">
              <div>Click for the zoom controls. Ctrl+= and Ctrl+- step the level; Ctrl+0 resets it.</div>
            </StatusCard>
          }
        >
          {percent}
        </StatusItem>
      )}
      {open && <ZoomBubble onHold={setHeld} />}
    </>
  )
}
