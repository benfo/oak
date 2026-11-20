import { useSettings } from '../settings'
import { StatusCard, StatusItem } from './StatusItem'
import { holdZoomBubble, toggleZoomBubble } from './ZoomBubble'

/**
 * The item shows in the status bar only while the zoom is not 100%, like Chrome's address-bar icon.
 * Clicking it opens the zoom bubble (`ZoomBubbleHost`) any time.
 */
export function ZoomItem() {
  const { zoom } = useSettings()
  if (zoom === 1) return null
  const percent = `${Math.round(zoom * 100)}%`
  return (
    <StatusItem
      label={`Zoom ${percent}`}
      onPress={toggleZoomBubble}
      onHover={holdZoomBubble}
      card={
        <StatusCard title="Zoom" keys="Ctrl+0">
          <div>Click for the zoom controls. Ctrl+= and Ctrl+- step the level; Ctrl+0 resets it.</div>
        </StatusCard>
      }
    >
      {percent}
    </StatusItem>
  )
}
