import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import type { FileDiff } from './diff'
import { toggleIgnoreWhitespace } from './useIgnoreWhitespace'

/**
 * What to show instead of code when a loaded diff has none to show, or null when it has.
 * `source` is the diff before review options (ignoring whitespace) filtered it.
 */
export function diffEmptyContent(diff: FileDiff, source: FileDiff | null, hasPreview: boolean): ReactNode | null {
  if (diff.binary) return hasPreview ? 'Binary file, no text diff' : 'Binary file, no preview'
  if (diff.hunks.length) return null
  if (source?.hunks.length && diff !== source)
    return (
      <span>
        Only whitespace changes.{' '}
        <button className="link" onClick={toggleIgnoreWhitespace}>
          Show whitespace changes
        </button>
      </span>
    )
  const info = diff.header.filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l))
  return info.length ? info.map((l, i) => <div key={i}>{l}</div>) : 'No content changes'
}

/** Shown after the rows of a diff too large to render at once. */
export function DiffTruncated({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="diff-truncated">
      Large diff truncated.{' '}
      <button className="link" onClick={onShowAll}>
        Show everything
      </button>
    </div>
  )
}

/** Why a diff offers no line actions (a deleted file, say), above the code. */
export function ReadOnlyNotice({ reason }: { reason: string }) {
  return (
    <div className="diff-notice" role="note">
      <Icon name="info" size={14} />
      {reason}
    </div>
  )
}
