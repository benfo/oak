import type { ComponentProps, ReactNode } from 'react'
import { PaneFrame } from '../components/Pane'
import { handleNavigation } from '../lib/navigation'

interface Props {
  /** The diff pane's title bar, so the switch and filename stay where they are in both modes. */
  header: ReactNode
  /** Pane ownership and file navigation, as on the diff pane. */
  wrapProps: ComponentProps<'div'>
  /** Focus, sizing and pane plumbing of the diff pane, which this takes over. */
  paneProps: ComponentProps<'div'>
  /** Left at the left edge returns focus to the list this pane belongs to. */
  onBack?: () => void
  label: string
  children: ReactNode
}

/** The frame a preview sits in: the diff pane's title bar and focus behaviour around a previewer's content. */
export function PreviewPane({ header, wrapProps, paneProps, onBack, label, children }: Props) {
  return (
    <div className="diff-wrap" {...wrapProps}>
      {header}
      <PaneFrame>
        <div
          className="diff preview-pane"
          {...paneProps}
          onKeyDown={(e) => handleNavigation(e, { back: onBack })}
          onContextMenu={undefined}
          aria-label={label}
        >
          {children}
        </div>
      </PaneFrame>
    </div>
  )
}
