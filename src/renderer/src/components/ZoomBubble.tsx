import { Overlay } from 'react-aria'
import { displayKeys } from '../commands'
import { stepZoom, useSettings, ZOOM_STEPS } from '../settings'
import { Icon } from './Icon'
import { Tip } from './Tip'

/**
 * The zoom controls, floating at the window's bottom-right corner. The whole window zooms, so the bubble
 * counter-scales (see `.zoom-bubble`): its buttons stay exactly where they are while you click + or − again.
 * Focus stays where it was (nothing here is a Tab stop): the keys are the keyboard route, shown in each
 * tooltip, so this is the mouse's.
 */
export function ZoomBubble({ onHold }: { onHold: (held: boolean) => void }) {
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
