import type { ReactNode } from 'react'

/**
 * Wraps each run of spaces and each tab in a span so CSS can draw it (a dot per space, an arrow per tab). The text itself
 * is unchanged, so copying and searching behave as before.
 */
export function showWhitespace(text: string): ReactNode {
  if (!/[ \t]/.test(text)) return text
  return text.split(/( +|\t)/).map((part, i) =>
    part === '' ? null : part === '\t' ? (
      <span key={i} className="ws-tab">
        {part}
      </span>
    ) : part[0] === ' ' ? (
      <span key={i} className="ws-space">
        {part}
      </span>
    ) : (
      part
    )
  )
}
