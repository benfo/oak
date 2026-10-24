import type { DiffLine } from './diff'

export interface SideRow {
  old: number | null
  new: number | null
}

/** Align replacement blocks by position; indices always refer to the original patch lines. */
export function alignDiffLines(lines: readonly DiffLine[]): SideRow[] {
  const result: SideRow[] = []
  let old: number[] = []
  let next: number[] = []
  let oldNotes: number[] = []
  let newNotes: number[] = []
  let previous: DiffLine['type'] = 'ctx'
  const flush = () => {
    for (let i = 0; i < Math.max(old.length, next.length); i++) {
      result.push({ old: old[i] ?? null, new: next[i] ?? null })
    }
    for (let i = 0; i < Math.max(oldNotes.length, newNotes.length); i++) {
      result.push({ old: oldNotes[i] ?? null, new: newNotes[i] ?? null })
    }
    old = []
    next = []
    oldNotes = []
    newNotes = []
  }
  lines.forEach((line, i) => {
    if (line.type === 'del') old.push(i)
    else if (line.type === 'add') next.push(i)
    else if (line.type === 'note' && previous !== 'ctx') {
      if (previous === 'del') oldNotes.push(i)
      else newNotes.push(i)
      return
    } else {
      flush()
      result.push({ old: i, new: i })
    }
    previous = line.type
  })
  flush()
  return result
}
