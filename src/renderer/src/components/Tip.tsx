import type { ReactElement, ReactNode } from 'react'
import { Focusable, Tooltip, TooltipTrigger } from 'react-aria-components'
import type { Placement } from 'react-aria'
import type { DOMAttributes, FocusableElement } from '@react-types/shared'
import { displayKeys } from '../commands'

/** The one tooltip: React Aria shows it on hover and keyboard focus, with a shared warm-up so
 * moving between neighbouring controls is instant. The child must accept a ref and focus/hover
 * props (a native button or a React Aria Button). Disabled controls can't be hovered, so the
 * reason a control is unavailable belongs in visible text, not here.
 */
export function Tip({
  label,
  keys,
  placement = 'bottom',
  children
}: {
  label: ReactNode
  keys?: string
  placement?: Placement
  children: ReactElement
}) {
  if (!label) return children
  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {/* RAC wraps the tooltip's key handler in useKeyboard, which stops propagation
          by default. The tooltip only observes keys; the button and pane own them. */}
      <Focusable onKeyDown={(e) => e.continuePropagation()}>{children as ReactElement<DOMAttributes<FocusableElement>, string>}</Focusable>
      <Tooltip className="tooltip" placement={placement} offset={6}>
        <span>{label}</span>
        {keys && <kbd>{displayKeys(keys)}</kbd>}
      </Tooltip>
    </TooltipTrigger>
  )
}
