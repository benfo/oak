import { diffArrays } from 'diff'
import type { DiffLine, FileDiff, Hunk } from './diff.ts'

interface SourceLine {
  raw: string
  normalized: string
  noEol: boolean
}
interface Entry {
  line: DiffLine
  raw: string
}

function sourceLines(hunk: Hunk, side: 'old' | 'new'): SourceLine[] {
  const result: SourceLine[] = []
  hunk.lines.forEach((line, i) => {
    if (line.type === 'note') return
    if (side === 'old' ? line.oldNo === null : line.newNo === null) return
    const raw = hunk.raw[i + 1].slice(1)
    result.push({ raw, normalized: raw.replace(/[\t\r\v\f ]/g, ''), noEol: hunk.lines[i + 1]?.type === 'note' })
  })
  return result
}

/** Hide whitespace-only edits without losing either side's exact patch context.
 * Line breaks remain tokens, so added and removed blank lines are still changes.
 * Work one original hunk at a time: unchanged gaps cannot acquire new matches.
 */
export function ignoreWhitespaceChanges(diff: FileDiff, context: number): FileDiff {
  if (diff.binary || diff.hunks.some((h) => h.header.startsWith('@@@'))) return diff
  return { ...diff, hunks: diff.hunks.flatMap((hunk) => filterHunk(hunk, Math.max(1, context))) }
}

function filterHunk(hunk: Hunk, context: number): Hunk[] {
  const before = sourceLines(hunk, 'old')
  const after = sourceLines(hunk, 'new')
  const changes = diffArrays(before, after, { comparator: (a, b) => a.normalized === b.normalized && a.noEol === b.noEol })
  const range = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(hunk.header)!
  let oldNo = Number(range[1]) + (range[2] === '0' ? 1 : 0)
  let newNo = Number(range[3]) + (range[4] === '0' ? 1 : 0)
  let oldIndex = 0
  let newIndex = 0
  const entries: Entry[] = []
  for (const change of changes) {
    for (let i = 0; i < change.count; i++) {
      const old = change.added ? null : before[oldIndex++]
      const next = change.removed ? null : after[newIndex++]
      const source = next ?? old!
      const type = change.added ? 'add' : change.removed ? 'del' : 'ctx'
      const line: DiffLine = {
        type,
        text: source.raw.replace(/\r$/, ''),
        oldNo: old ? oldNo++ : null,
        newNo: next ? newNo++ : null,
        ...(old && next && old.raw !== next.raw ? { beforeText: old.raw } : {})
      }
      entries.push({ line, raw: (type === 'add' ? '+' : type === 'del' ? '-' : ' ') + source.raw })
      if (source.noEol)
        entries.push({
          line: { type: 'note', text: 'No newline at end of file', oldNo: null, newNo: null },
          raw: '\\ No newline at end of file'
        })
    }
  }
  return regroup(entries, hunk.header, context)
}

/** Re-trim context after filtering, keeping source line numbers for both sides. */
function regroup(entries: Entry[], originalHeader: string, context: number): Hunk[] {
  const ranges: { start: number; end: number }[] = []
  entries.forEach(({ line }, i) => {
    if (line.type !== 'add' && line.type !== 'del') return
    const start = Math.max(0, i - context)
    let end = Math.min(entries.length, i + context + 1)
    if (entries[end]?.line.type === 'note') end++
    const previous = ranges[ranges.length - 1]
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end)
    else ranges.push({ start, end })
  })
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(originalHeader)!
  let oldNo = Number(match[1]) + (match[2] === '0' ? 1 : 0)
  let newNo = Number(match[3]) + (match[4] === '0' ? 1 : 0)
  let cursor = 0
  return ranges.map(({ start, end }) => {
    while (cursor < start) {
      if (entries[cursor].line.oldNo !== null) oldNo++
      if (entries[cursor].line.newNo !== null) newNo++
      cursor++
    }
    const chunk = entries.slice(start, end)
    const oldCount = chunk.filter(({ line }) => line.oldNo !== null).length
    const newCount = chunk.filter(({ line }) => line.newNo !== null).length
    const header = `@@ -${oldNo - (oldCount ? 0 : 1)},${oldCount} +${newNo - (newCount ? 0 : 1)},${newCount} @@`
    return { header, lines: chunk.map((e) => e.line), raw: [header, ...chunk.map((e) => e.raw)] }
  })
}
