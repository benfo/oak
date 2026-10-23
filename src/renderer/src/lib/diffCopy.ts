import type { FileDiff } from './diff.ts'

/** One diff line, as hunk index and line index within that hunk, in display order. */
export interface CopyRef { hunk: number; line: number }

export interface Copied { text: string; lines: number }

const countable = (diff: FileDiff, refs: CopyRef[]) => refs.filter((r) => diff.hunks[r.hunk]?.lines[r.line]?.type !== 'note')

/** The code of the lines only: no +/- signs, line numbers or hunk headers. */
export function copiedText(diff: FileDiff, refs: CopyRef[]): Copied | null {
  const lines = countable(diff, refs)
  if (!lines.length) return null
  return { text: lines.map((r) => diff.hunks[r.hunk].lines[r.line].text).join('\n'), lines: lines.length }
}

/** The lines as they appear in the patch (with their prefixes), each run under its hunk header. */
export function copiedPatch(diff: FileDiff, refs: CopyRef[]): Copied | null {
  const lines = countable(diff, refs).length
  if (!lines) return null
  const out: string[] = []
  let current = -1
  for (const r of refs) {
    const hunk = diff.hunks[r.hunk]
    if (!hunk) continue
    if (r.hunk !== current) {
      current = r.hunk
      out.push(hunk.header)
    }
    out.push(hunk.raw[r.line + 1])
  }
  return { text: out.join('\n'), lines }
}

export const copiedLabel = (lines: number, patch: boolean) => `Copied ${lines} ${lines === 1 ? 'line' : 'lines'}${patch ? ' as patch' : ''}`

/** Which diff view the Copy commands act on. Views register while mounted; the focused one wins. */
export interface DiffCopySource {
  element: () => HTMLElement | null
  copy: (patch: boolean) => void
}

const sources = new Set<DiffCopySource>()
let lastFocused: DiffCopySource | null = null

export function registerDiffCopy(source: DiffCopySource) {
  sources.add(source)
  return () => {
    sources.delete(source)
    if (lastFocused === source) lastFocused = null
  }
}

export function noteDiffFocus(source: DiffCopySource) {
  lastFocused = source
}

/** The diff that has focus; when focus has just returned from the palette, the last focused one. */
export function activeDiffCopy(strict = false): DiffCopySource | null {
  const active = typeof document === 'undefined' ? null : document.activeElement
  for (const source of sources) if (active && source.element()?.contains(active)) return source
  if (strict) return null
  return lastFocused && sources.has(lastFocused) && lastFocused.element()?.isConnected ? lastFocused : null
}
