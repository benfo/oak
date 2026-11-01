import { useMemo, useState } from 'react'
import { WORKING_HASH } from '../../../shared/working.ts'
import { commitsBetween } from './commitRange'

/**
 * The commits selected as a range (Shift+click or Shift+arrows). The range is stored as the two commits it was
 * extended between and counts only while `selected` is still the end it was extended to, so any other change of
 * selection (a click, a refresh, a jump from search) ends it without being told.
 */
export function useCommitRange(hashes: readonly string[], selected: string | null, enabled: boolean) {
  const [extent, setExtent] = useState<{ anchor: string; end: string } | null>(null)
  const live = enabled && extent && extent.end === selected ? extent : null
  const range = useMemo(() => (live ? commitsBetween(hashes, live.anchor, live.end) : null), [hashes, live?.anchor, live?.end])
  const set = useMemo(() => (range ? new Set(range) : null), [range])

  return {
    /** The selected commits, newest first, or null when there is no range. */
    range,
    set,
    /** Grows the range from its anchor (or from the current selection) to `end`; false when this selection cannot be a range. */
    extendTo(end: string) {
      const anchor = live ? live.anchor : selected
      if (!enabled || !anchor || anchor === WORKING_HASH || end === WORKING_HASH) return false
      setExtent({ anchor, end })
      return true
    },
    clear: () => setExtent(null)
  }
}
