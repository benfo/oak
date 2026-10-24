import { useEffect } from 'react'
import { getSettings, stepZoom } from '../settings'

/** Wheel distance that counts as one zoom level: a mouse notch is 100, a touchpad pinch sends many small deltas. */
const THRESHOLD = 60
const IDLE_MS = 250

/** Ctrl+wheel (and touchpad pinch) steps the same zoom levels as Ctrl+= / Ctrl+-, anywhere in the window. */
export function useWheelZoom() {
  useEffect(() => {
    let travelled = 0
    let idle: ReturnType<typeof setTimeout> | undefined
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !getSettings().wheelZoom) return
      // Never let the list or diff underneath scroll while zooming.
      e.preventDefault()
      const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY
      // A reversal starts over, so changing direction responds immediately.
      if (Math.sign(delta) !== Math.sign(travelled)) travelled = 0
      travelled += delta
      clearTimeout(idle)
      idle = setTimeout(() => {
        travelled = 0
      }, IDLE_MS)
      if (Math.abs(travelled) < THRESHOLD) return
      stepZoom(travelled < 0 ? 1 : -1)
      travelled = 0
    }
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true })
      clearTimeout(idle)
    }
  }, [])
}
