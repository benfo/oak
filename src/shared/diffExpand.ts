import type { DiffLine, FileDiff, Hunk } from './diff.ts'

/** Lines one click reveals. */
export const EXPAND_STEP = 20
/** Enough to reveal any gap. */
export const EXPAND_ALL = 1_000_000_000

/** Lines revealed on each edge of one gap: `down` continues the hunk above it, `up` the hunk below. */
export interface GapExpansion {
  up: number
  down: number
}

/** Revealed lines per gap, keyed by `Gap.key`. */
export type Expansion = ReadonlyMap<number, GapExpansion>

/** Unchanged lines hidden between two hunks, before the first one or after the last one. */
export interface Gap {
  /** The new-side number of the gap's first line in the diff as it first showed, so it stays the same while the gap shrinks. */
  key: number
  /** Index of the hunk below the gap; the hunk count for the gap after the last hunk. */
  before: number
  /** Hidden lines; null after the last hunk while the rest of the file is not loaded. */
  hidden: number | null
}

export interface ExpandedDiff {
  diff: FileDiff
  gaps: Gap[]
}

const RANGE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Whether a diff covers its whole file: one hunk from the first line (what `git diff -U<huge>` gives). */
export function isWholeFile(diff: FileDiff): boolean {
  if (diff.hunks.length !== 1) return false
  const m = RANGE.exec(diff.hunks[0].header)
  return !!m && (m[1] === '1' || (m[1] === '0' && m[2] === '0')) && (m[3] === '1' || (m[3] === '0' && m[4] === '0'))
}

/** Where the new side's lines start and how many there are, as the lines they number. */
function newSpan(header: string) {
  const m = RANGE.exec(header)!
  const count = m[4] === undefined ? 1 : Number(m[4])
  return { first: Number(m[3]) + (count === 0 ? 1 : 0), count }
}

const expandable = (diff: FileDiff) =>
  !diff.binary && !diff.isNew && !diff.isDeleted && diff.hunks.length > 0 && diff.hunks.every((h) => RANGE.test(h.header))

/** The gaps of a diff cut by git itself, from the hunk headers; what follows the last hunk is unknown. */
function headerGaps(diff: FileDiff): Gap[] {
  if (!expandable(diff)) return []
  const gaps: Gap[] = []
  let end = 1
  diff.hunks.forEach((h, i) => {
    const { first, count } = newSpan(h.header)
    if (first > end) gaps.push({ key: end, before: i, hidden: first - end })
    end = first + count
  })
  gaps.push({ key: end, before: diff.hunks.length, hidden: null })
  return gaps
}

/**
 * Cuts a whole-file diff down to `context` lines around each change, then shows `expansion` more lines at the
 * edges of the gaps. Lines keep their numbers, so what is revealed is ordinary context. Any other diff is
 * returned as it is, with the gaps its headers imply.
 */
export function expandDiff(diff: FileDiff, context: number, expansion: Expansion, wholeLoaded: boolean): ExpandedDiff {
  if (!wholeLoaded || !expandable(diff) || !isWholeFile(diff)) return { diff, gaps: headerGaps(diff) }
  const hunk = diff.hunks[0]
  const lines = hunk.lines
  const pad = Math.max(1, context)

  const ranges: { start: number; end: number }[] = []
  lines.forEach((line, i) => {
    if (line.type !== 'add' && line.type !== 'del') return
    const start = Math.max(0, i - pad)
    let end = Math.min(lines.length, i + pad + 1)
    if (lines[end]?.type === 'note') end++
    const previous = ranges[ranges.length - 1]
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end)
    else ranges.push({ start, end })
  })
  if (!ranges.length) return { diff, gaps: [] }

  // Each gap is the run between two ranges, with the ranges on either side already carrying what was revealed.
  const spans: { key: number; below: number; first: number; stop: number }[] = []
  const bounds = [{ start: 0, end: 0 }, ...ranges, { start: lines.length, end: lines.length }]
  for (let g = 0; g + 1 < bounds.length; g++) {
    const first = bounds[g].end
    const stop = bounds[g + 1].start
    if (first >= stop) continue
    spans.push({ key: lines[first].newNo ?? lines[first].oldNo ?? first, below: g, first, stop })
  }

  // Gap g lies above range g, so the last gap has no range below it.
  const lastRange = ranges.length - 1
  const edit = ranges.map((r) => ({ ...r }))
  const remaining: { key: number; below: number; hidden: number }[] = []
  for (const { key, below, first, stop } of spans) {
    const wanted = expansion.get(key)
    let down = first
    let up = stop
    if (wanted && below > 0) down = revealDown(lines, first, stop, wanted.down)
    if (wanted && below <= lastRange) up = revealUp(lines, down, stop, wanted.up)
    if (below > 0) edit[below - 1].end = Math.max(edit[below - 1].end, down)
    if (below <= lastRange) edit[below].start = Math.min(edit[below].start, up)
    remaining.push({ key, below, hidden: Math.max(0, count(lines, down, up)) })
  }

  const merged: { start: number; end: number }[] = []
  const mergedIndex = edit.map((r) => {
    const previous = merged[merged.length - 1]
    if (previous && r.start <= previous.end) previous.end = Math.max(previous.end, r.end)
    else merged.push({ ...r })
    return merged.length - 1
  })
  const gaps: Gap[] = remaining
    .filter((g) => g.hidden > 0)
    .map((g) => ({ key: g.key, before: g.below <= lastRange ? mergedIndex[g.below] : merged.length, hidden: g.hidden }))
  return { diff: { ...diff, hunks: buildHunks(hunk, merged) }, gaps }
}

const count = (lines: DiffLine[], from: number, to: number) => {
  let n = 0
  for (let i = from; i < to; i++) if (lines[i].type !== 'note') n++
  return n
}

/** The end of the first `wanted` lines of lines[first, stop), taking along a note that belongs to the last one. */
function revealDown(lines: DiffLine[], first: number, stop: number, wanted: number) {
  let i = first
  let shown = 0
  while (i < stop && shown < wanted) {
    if (lines[i].type !== 'note') shown++
    i++
  }
  while (i < stop && lines[i].type === 'note') i++
  return i
}

/** The start of the last `wanted` lines of lines[first, stop). */
function revealUp(lines: DiffLine[], first: number, stop: number, wanted: number) {
  let i = stop
  let shown = 0
  while (i > first && shown < wanted) {
    i--
    if (lines[i].type !== 'note') shown++
  }
  return i
}

/** One hunk per range of the whole-file hunk, with headers that count what each holds. */
function buildHunks(hunk: Hunk, ranges: { start: number; end: number }[]): Hunk[] {
  const m = RANGE.exec(hunk.header)!
  let oldNo = Number(m[1]) + (m[2] === '0' ? 1 : 0)
  let newNo = Number(m[3]) + (m[4] === '0' ? 1 : 0)
  let cursor = 0
  return ranges.map(({ start, end }) => {
    while (cursor < start) {
      if (hunk.lines[cursor].oldNo !== null) oldNo++
      if (hunk.lines[cursor].newNo !== null) newNo++
      cursor++
    }
    const chunk = hunk.lines.slice(start, end)
    const oldCount = chunk.filter((l) => l.oldNo !== null).length
    const newCount = chunk.filter((l) => l.newNo !== null).length
    const header = `@@ -${oldNo - (oldCount ? 0 : 1)},${oldCount} +${newNo - (newCount ? 0 : 1)},${newCount} @@`
    return { header, lines: chunk, raw: [header, ...hunk.raw.slice(start + 1, end + 1)] }
  })
}

/** What one click on a gap changes: the lines it adds on the edge it was clicked at. */
export function expandGap(expansion: Expansion, key: number, edge: 'up' | 'down' | 'all', amount = EXPAND_STEP): Expansion {
  const next = new Map(expansion)
  const current = next.get(key) ?? { up: 0, down: 0 }
  next.set(key, edge === 'all' ? { up: EXPAND_ALL, down: EXPAND_ALL } : { ...current, [edge]: current[edge] + amount })
  return next
}
