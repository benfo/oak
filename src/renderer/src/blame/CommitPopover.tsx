import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Overlay, useOverlayPosition } from 'react-aria'

/**
 * The commit message popover, placed under the cursor row. React Aria's Popover closes a non-modal popover whenever the
 * anchor's scroller scrolls, which is what moving the cursor past the edge does, so this uses its positioning on its own
 * and follows the scroll instead. Focus stays on the code.
 */
export function CommitPopover({ anchor, scroller, children }: { anchor: HTMLElement; scroller: HTMLElement | null; children: ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const targetRef = useMemo(() => ({ current: anchor }), [anchor])
  const { overlayProps, updatePosition } = useOverlayPosition({ targetRef, overlayRef, placement: 'bottom start', offset: 4, isOpen: true })

  useEffect(() => {
    scroller?.addEventListener('scroll', updatePosition, { passive: true })
    return () => scroller?.removeEventListener('scroll', updatePosition)
  }, [scroller, updatePosition])

  return (
    <Overlay disableFocusManagement>
      <div ref={overlayRef} {...overlayProps} className="commit-popover">
        {children}
      </div>
    </Overlay>
  )
}
