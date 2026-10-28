import { useMemo } from 'react'
import { ignoreWhitespaceChanges } from '../../../shared/whitespaceDiff'
import { parseDiff } from './diff'
import { useContextLines } from './useDiffContext'
import { useIgnoreWhitespace } from './useIgnoreWhitespace'

/** One parsed source and one displayed model, shared by rendering, find and patch actions. */
export function useDiffDocument(text: string | null, plain: boolean) {
  const context = useContextLines()
  const ignoreWhitespace = useIgnoreWhitespace()
  const source = useMemo(() => (text === null ? null : parseDiff(text)), [text])
  const diff = useMemo(
    () => source && (ignoreWhitespace && !plain ? ignoreWhitespaceChanges(source, context) : source),
    [source, ignoreWhitespace, plain, context]
  )
  // Highlighting caches must distinguish the filtered hunks from the original diff.
  const displayText = useMemo(
    () => (diff && diff !== source ? [...diff.header, ...diff.hunks.flatMap((h) => h.raw)].join('\n') : text),
    [diff, source, text]
  )
  return { diff, source, displayText, reviewMode: `${context}:${ignoreWhitespace}` }
}
