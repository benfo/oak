import type { ComponentProps } from 'react'
import { handleSearchNavigation } from '../lib/navigation'

/** The existing overlay frame; focusRing.ts owns keyboard-arrival indication.
 * No focusable wrapper or extra scroll container around the collection.
 */
export function PaneFrame({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={`pane-frame${className ? ` ${className}` : ''}`} />
}

type PaneSearchProps = Omit<ComponentProps<'input'>, 'tabIndex' | 'onKeyDown'> & {
  paneId: string
  onFind: (backwards: boolean) => void
  onLeave: () => void
}

/** Persistent find, not an accepting picker: Enter finds; Escape/Tab return to
 * the owning list; Shift+Tab and F6 use the shared pane traversal policy.
 * A native input preserves ordinary editing and the existing search markup.
 */
export function PaneSearch({ paneId, onFind, onLeave, ...props }: PaneSearchProps) {
  return <input {...props} data-search-pane={paneId} tabIndex={-1} onKeyDown={(e) => handleSearchNavigation(e, onFind, onLeave)} />
}
