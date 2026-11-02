import type { ReactNode } from 'react'
import { displayKeys } from '../commands'
import { Tip } from './Tip'

/** A hover card's content: a title, what a click does or the facts behind the text, and the key. */
export function StatusCard({ title, keys, children }: { title: string; keys?: string; children?: ReactNode }) {
  return (
    <div className="status-card">
      <div className="status-card-title">
        <strong>{title}</strong>
        {keys && <kbd>{displayKeys(keys)}</kbd>}
      </div>
      {children}
    </div>
  )
}

/**
 * One item in the status bar. With `onPress` it is an action: it tints on hover and runs the same command
 * as everywhere else. `inert` keeps the look of an action that is unavailable right now (the text says why
 * elsewhere, so it has no card). Without `onPress` it is a plain fact. Never a Tab stop (see AGENTS.md):
 * every action here has a key, named in its card.
 */
export function StatusItem({
  children,
  onPress,
  inert,
  attention,
  card,
  label,
  onHover
}: {
  children: ReactNode
  onPress?: () => void
  inert?: boolean
  /** Something to notice, such as an operation left half done. */
  attention?: boolean
  card?: ReactNode
  /** Accessible name when the visible text alone is not enough. */
  label?: string
  onHover?: (hovered: boolean) => void
}) {
  const action = !!onPress && !inert
  const classes = ['status-item', action ? 'is-action' : '', inert ? 'is-inert' : '', attention ? 'is-attention' : '']
    .filter(Boolean)
    .join(' ')
  const hover = onHover && { onMouseEnter: () => onHover(true), onMouseLeave: () => onHover(false) }
  const content = action ? (
    <button className={classes} tabIndex={-1} aria-label={label} onClick={onPress} {...hover}>
      {children}
    </button>
  ) : (
    <span className={classes} aria-label={label} {...hover}>
      {children}
    </span>
  )
  // An inert item has no card: its reason is already on screen.
  return card && !inert ? (
    <Tip label={card} placement="top" excludeFromTabOrder>
      {content}
    </Tip>
  ) : (
    content
  )
}
