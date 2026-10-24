import { diffWordsWithSpace } from 'diff'
import type { FileDiff } from './diff'
import type { Span } from './syntax'

export interface WordRange {
  start: number
  end: number
}

/** Per hunk and line, UTF-16 offsets into the original text (as used by syntax spans). */
export function wordChanges(diff: FileDiff, hunkCount = diff.hunks.length): WordRange[][][] {
  const deadline = performance.now() + 30
  return diff.hunks.slice(0, hunkCount).map((h) => {
    const ranges: WordRange[][] = h.lines.map(() => [])
    let start = 0
    while (start < h.lines.length) {
      if (h.lines[start].type === 'ctx') {
        start++
        continue
      }
      let end = start
      while (end < h.lines.length && h.lines[end].type !== 'ctx') end++
      const old: number[] = []
      const next: number[] = []
      for (let i = start; i < end; i++) {
        if (h.lines[i].type === 'del') old.push(i)
        if (h.lines[i].type === 'add') next.push(i)
      }
      start = end
      // Pure insertions/deletions already have whole-line colour. Bound synchronous work for
      // minified files and large rewrites; the ordinary diff remains useful if we skip a block.
      if (!old.length || !next.length || performance.now() > deadline) continue
      const before = old.map((i) => h.lines[i].text).join('\n')
      const after = next.map((i) => h.lines[i].text).join('\n')
      if (before.length + after.length > 20000) continue
      const changes = diffWordsWithSpace(before, after, { maxEditLength: 300, timeout: 5 })
      if (!changes) continue
      for (const [indices, removed] of [
        [old, true],
        [next, false]
      ] as const) {
        let line = 0
        let offset = 0
        for (const change of changes) {
          if (removed ? change.added : change.removed) continue
          const changed = Boolean(removed ? change.removed : change.added)
          const pieces = change.value.split('\n')
          pieces.forEach((piece, part) => {
            if (part) {
              line++
              offset = 0
            }
            if (changed && piece.length && indices[line] !== undefined) {
              ranges[indices[line]].push({ start: offset, end: offset + piece.length })
            }
            offset += piece.length
          })
        }
      }
    }
    return ranges
  })
}

/** Split syntax spans at word-change boundaries, preserving every character and colour. */
export function wordSpans(text: string, syntax: Span[] | null | undefined, ranges: WordRange[]): (Span & { changed: boolean })[] {
  const result: (Span & { changed: boolean })[] = []
  let offset = 0
  let ri = 0
  for (const span of syntax ?? [{ t: text }]) {
    const end = offset + span.t.length
    let pos = offset
    while (pos < end) {
      while (ri < ranges.length && ranges[ri].end <= pos) ri++
      const range = ranges[ri]
      const changed = !!range && range.start <= pos
      const stop = Math.min(end, range ? (changed ? range.end : range.start) : end)
      result.push({ t: span.t.slice(pos - offset, stop - offset), c: span.c, changed })
      pos = stop
    }
    offset = end
  }
  return result
}
