import { cloneElement, useRef } from 'react'
import type { ReactElement, ReactNode, Ref } from 'react'
import { Focusable, Tooltip, TooltipTrigger, TooltipTriggerStateContext } from 'react-aria-components'
import { useTooltipTrigger } from 'react-aria'
import type { Placement } from 'react-aria'
import { useTooltipTriggerState } from 'react-stately'
import type { DOMAttributes, FocusableElement } from '@react-types/shared'
import { displayKeys } from '../commands'

function TipBody({ label, keys }: { label: ReactNode; keys?: string }) {
  return (
    <>
      <span>{label}</span>
      {keys && <kbd>{displayKeys(keys)}</kbd>}
    </>
  )
}

/** Hover-only tooltip for non-interactive elements (badges, dates, filenames). The child is not
 * made focusable, so it adds no Tab stop and doesn't take focus when clicked. */
function HoverTip({ label, keys, placement, children }: { label: ReactNode; keys?: string; placement: Placement; children: ReactElement }) {
  const ref = useRef<HTMLElement>(null)
  const state = useTooltipTriggerState({ delay: 500, closeDelay: 0 })
  const { triggerProps } = useTooltipTrigger({}, state, ref)
  return (
    <>
      {cloneElement(children as ReactElement<Record<string, unknown> & { ref?: Ref<HTMLElement> }>, { ...triggerProps, ref })}
      <TooltipTriggerStateContext.Provider value={state}>
        <Tooltip className="tooltip" placement={placement} offset={6} triggerRef={ref}>
          <TipBody label={label} keys={keys} />
        </Tooltip>
      </TooltipTriggerStateContext.Provider>
    </>
  )
}

/** The one tooltip: React Aria shows it on hover and keyboard focus, with a shared warm-up so
 * moving between neighbouring controls is instant. The child must accept a ref and focus/hover
 * props (a native button or a React Aria Button). Pass `focusable={false}` for non-interactive
 * elements: hover only, no Tab stop. Disabled controls can't be hovered, so the reason a control
 * is unavailable belongs in visible text, not here.
 */
export function Tip({
  label,
  keys,
  placement = 'bottom',
  focusable = true,
  children
}: {
  label: ReactNode
  keys?: string
  placement?: Placement
  focusable?: boolean
  children: ReactElement
}) {
  if (!label) return children
  if (!focusable)
    return (
      <HoverTip label={label} keys={keys} placement={placement}>
        {children}
      </HoverTip>
    )
  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {/* RAC wraps the tooltip's key handler in useKeyboard, which stops propagation
          by default. The tooltip only observes keys; the button and pane own them. */}
      <Focusable onKeyDown={(e) => e.continuePropagation()}>{children as ReactElement<DOMAttributes<FocusableElement>, string>}</Focusable>
      <Tooltip className="tooltip" placement={placement} offset={6}>
        <TipBody label={label} keys={keys} />
      </Tooltip>
    </TooltipTrigger>
  )
}
