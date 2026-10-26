import { useMemo, type ReactNode } from 'react'
import type { FileDiff } from './diff'
import { useDiffTokens } from './highlight'
import { CodeLine } from '../components/CodeLine'
import type { useFindInFile } from '../lib/useFindInFile'
import { wordChanges, wordSpans } from './wordDiff'
import type { Row } from './diffTypes'

/**
 * Unmatched lines are cached once rendered, per diff/colours; matched lines are redrawn as find moves.
 * Windowed diffs build code only for mounted rows. Syntax colours arrive from a worker after the plain text.
 */
export function useDiffCode(
  diff: FileDiff | null,
  text: string | null,
  rows: Row[],
  syntaxHighlighting: boolean,
  whitespace: boolean,
  find: Pick<ReturnType<typeof useFindInFile>, 'hitsOn'>
) {
  const hunkCount = rows.length ? rows[rows.length - 1].hunk + 1 : 0
  const tokens = useDiffTokens(diff, text, hunkCount, syntaxHighlighting)
  const words = useMemo(() => (diff ? wordChanges(diff, hunkCount) : []), [diff, hunkCount])
  const codeCache = useMemo(() => new Map<string, ReactNode>(), [diff, tokens, words, whitespace])
  const renderCode = (row: Row, hits: readonly [number, number][], currentHit: number) => {
    const line = diff!.hunks[row.hunk].lines[row.line]
    const spans = wordSpans(line.text, tokens?.[row.hunk]?.[row.line], words[row.hunk]?.[row.line] ?? [])
    return (
      <span className="code">
        {/* An empty flex item is skipped by text selection, which would drop blank lines from a copy. */}
        {line.text === '' && '\n'}
        <CodeLine text={line.text} tokens={spans} whitespace={whitespace} hits={hits} currentHit={currentHit} />
      </span>
    )
  }
  return (row: Row, currentSide: boolean): ReactNode => {
    const found = find.hitsOn(row.index)
    if (found.ranges.length) return renderCode(row, found.ranges, currentSide ? found.current : -1)
    let node = codeCache.get(row.key)
    if (node === undefined) {
      node = renderCode(row, found.ranges, -1)
      codeCache.set(row.key, node)
    }
    return node
  }
}
