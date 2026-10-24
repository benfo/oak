import { useEffect, useRef, useState } from 'react'
import { stepZoom, useSettings } from '../settings'
import { displayKeys } from '../commands'

/** One in-place indicator for every zoom input; it replaces itself instead of stacking like toasts. */
export function ZoomIndicator() {
  const { zoom } = useSettings()
  const previous = useRef(zoom)
  const [shown, setShown] = useState(false)
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    if (previous.current !== zoom) {
      previous.current = zoom
      setShown(true)
    }
  }, [zoom])
  // Restarts on every zoom change and while the pointer leaves; never runs while hovered.
  useEffect(() => {
    if (!shown || hovered) return
    const timer = setTimeout(() => setShown(false), 3000)
    return () => clearTimeout(timer)
  }, [shown, hovered, zoom])
  if (!shown) return null
  return (
    <div className="zoom-indicator" role="status" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <strong>{Math.round(zoom * 100)}%</strong>
      <button className="btn" disabled={zoom === 1} onClick={() => stepZoom(0)}>
        Reset <span className="muted">{displayKeys('Ctrl+0')}</span>
      </button>
    </div>
  )
}
