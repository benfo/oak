import { useCallback, useMemo, useState } from 'react'
import { expandDiff, expandGap, isWholeFile, type Expansion } from '../../../shared/diffExpand'
import { ignoreWhitespaceChanges } from '../../../shared/whitespaceDiff'
import { parseDiff } from './diff'
import { FULL_CONTEXT, isFullContext } from './diffContext'
import { requestWholeFile, useContextLines, useWholeFileLoaded } from './useDiffContext'
import { useIgnoreWhitespace } from './useIgnoreWhitespace'

const NO_EXPANSION: Expansion = new Map()

/** One parsed source and one displayed model, shared by rendering, find and patch actions. */
export function useDiffDocument(text: string | null, plain: boolean) {
  const context = useContextLines()
  const ignoreWhitespace = useIgnoreWhitespace()
  const wholeLoaded = useWholeFileLoaded() || isFullContext(context)
  const source = useMemo(() => (text === null ? null : parseDiff(text)), [text])
  const whole = wholeLoaded && !!source && isWholeFile(source)
  const filtered = useMemo(
    () => source && (ignoreWhitespace && !plain ? ignoreWhitespaceChanges(source, whole ? FULL_CONTEXT : context) : source),
    [source, ignoreWhitespace, plain, context, whole]
  )

  // Revealed lines belong to this version of the file under these options; another one starts collapsed.
  const identity = `${source?.header.join('\n')}:${context}:${ignoreWhitespace}`
  const [revealed, setRevealed] = useState({ identity, expansion: NO_EXPANSION })
  const expansion = revealed.identity === identity ? revealed.expansion : NO_EXPANSION
  const expand = useCallback(
    (key: number, edge: 'up' | 'down' | 'all') => {
      requestWholeFile()
      setRevealed((r) => ({ identity, expansion: expandGap(r.identity === identity ? r.expansion : NO_EXPANSION, key, edge) }))
    },
    [identity]
  )
  const { diff, gaps } = useMemo(
    () => (filtered && !plain ? expandDiff(filtered, context, expansion, wholeLoaded) : { diff: filtered, gaps: [] }),
    [filtered, plain, context, expansion, wholeLoaded]
  )

  // Highlighting caches must distinguish the filtered hunks from the original diff.
  const displayText = useMemo(
    () => (diff && diff !== source ? [...diff.header, ...diff.hunks.flatMap((h) => h.raw)].join('\n') : text),
    [diff, source, text]
  )
  const reviewMode = `${context}:${ignoreWhitespace}:${JSON.stringify([...expansion])}`
  return { diff, source, displayText, reviewMode, gaps, expand }
}
