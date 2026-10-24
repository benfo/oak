import { useMemo, type ReactNode } from 'react'
import type { FileDiff } from './diff'
import { useDiffTokens } from './highlight'
import { wordChanges, wordSpans } from './wordDiff'
import type { Row } from './diffTypes'

/**
 * Each line's code element is built when first rendered, once per diff/colours, so moving the cursor
 * doesn't re-render every span and a long diff doesn't build elements it never shows. Syntax colours
 * arrive from a worker a moment after the plain text.
 */
export function useDiffCode(diff: FileDiff | null, text: string | null, rows: Row[], syntaxHighlighting: boolean) {
  const hunkCount = rows.length ? rows[rows.length - 1].hunk + 1 : 0
  const tokens = useDiffTokens(diff, text, hunkCount, syntaxHighlighting)
  const words = useMemo(() => (diff ? wordChanges(diff, hunkCount) : []), [diff, hunkCount])
  const codeCache = useMemo(() => new Map<string, ReactNode>(), [diff, tokens, words])
  return (r: Row): ReactNode => {
    let node = codeCache.get(r.key)
    if (node === undefined) {
      const l = diff!.hunks[r.hunk].lines[r.line]
      const spans = wordSpans(l.text, tokens?.[r.hunk]?.[r.line], words[r.hunk]?.[r.line] ?? [])
      node = (
        <span className="code">
          {/* An empty flex item is skipped by text selection, which would drop blank lines from a copy. */}
          {l.text === '' && '\n'}
          {spans.map((s, i) => (
            <span key={i} className={s.changed ? 'word-change' : undefined} style={s.c ? { color: s.c } : undefined}>
              {s.t}
            </span>
          ))}
        </span>
      )
      codeCache.set(r.key, node)
    }
    return node
  }
}
