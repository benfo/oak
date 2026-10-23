export interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'note'
  text: string
  oldNo: number | null
  newNo: number | null
}

export interface Hunk {
  header: string
  lines: DiffLine[]
  /** Raw patch lines including the @@ header, used to build partial patches. */
  raw: string[]
}

export interface FileDiff {
  header: string[]
  hunks: Hunk[]
  binary: boolean
  isNew: boolean
  isDeleted: boolean
  isRename: boolean
}

export function parseDiff(text: string): FileDiff {
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const header: string[] = []
  const hunks: Hunk[] = []
  let cur: Hunk | null = null
  let oldNo = 0
  let newNo = 0
  let binary = false
  // Combined diffs (conflicts, merges) use @@@ headers and one prefix column per parent.
  let cols = 1

  for (const l of lines) {
    if (l.startsWith('@@')) {
      cols = /^@+/.exec(l)![0].length - 1
      if (cols > 1) {
        const m = /\+(\d+)(?:,\d+)? @@/.exec(l)
        oldNo = 0
        newNo = m ? Number(m[1]) : 0
      } else {
        const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l)
        oldNo = m ? Number(m[1]) : 0
        newNo = m ? Number(m[2]) : 0
      }
      cur = { header: l, lines: [], raw: [l] }
      hunks.push(cur)
      continue
    }
    if (cur && cols > 1) {
      cur.raw.push(l)
      const prefix = l.slice(0, cols)
      const body = l.slice(cols).replace(/\r$/, '')
      if (prefix.includes('-')) cur.lines.push({ type: 'del', text: body, oldNo: null, newNo: null })
      else if (prefix.includes('+')) cur.lines.push({ type: 'add', text: body, oldNo: null, newNo: newNo++ })
      else cur.lines.push({ type: 'ctx', text: body, oldNo: null, newNo: newNo++ })
      continue
    }
    if (!cur) {
      header.push(l)
      if (l.startsWith('Binary files') || l.startsWith('GIT binary patch')) binary = true
      continue
    }
    cur.raw.push(l)
    const sign = l[0]
    const body = l.slice(1).replace(/\r$/, '')
    if (sign === '+') cur.lines.push({ type: 'add', text: body, oldNo: null, newNo: newNo++ })
    else if (sign === '-') cur.lines.push({ type: 'del', text: body, oldNo: oldNo++, newNo: null })
    else if (sign === '\\') cur.lines.push({ type: 'note', text: l.slice(2), oldNo: null, newNo: null })
    else cur.lines.push({ type: 'ctx', text: body, oldNo: oldNo++, newNo: newNo++ })
  }

  const h = header.join('\n')
  return {
    header,
    hunks,
    binary,
    isNew: /^new file mode/m.test(h),
    isDeleted: /^deleted file mode/m.test(h),
    isRename: /^rename from/m.test(h)
  }
}

/** A standalone patch containing only one hunk, for `git apply`. */
export function hunkPatch(diff: FileDiff, hunk: Hunk) {
  return [...diff.header, ...hunk.raw].join('\n') + '\n'
}

/** Identifies one line: hunk index and line index within that hunk. */
export const lineKey = (hunk: number, line: number) => `${hunk}:${line}`

/**
 * A patch containing only the selected +/- lines, for `git apply --recount`.
 *
 * Forward (staging): unselected additions are dropped and unselected deletions become context,
 * so the patch applies to the index as if only the selected lines had changed.
 * Reverse (unstaging, discarding): the patch is applied with --reverse, so its *new* side must
 * match the target. Unselected additions become context and unselected deletions are dropped.
 */
export function linesPatch(diff: FileDiff, selected: Set<string>, reverse: boolean): string | null {
  // Some lines of a new file: git won't apply a partial "new file" patch, so describe it as a
  // change to the file as it is now (the index has it, via --intent-to-add or an earlier stage).
  const partial = diff.hunks.some((h, hi) => h.lines.some((l, li) => (l.type === 'add' || l.type === 'del') && !selected.has(lineKey(hi, li))))
  const out = partial && diff.isNew ? asModification(diff.header) : [...diff.header]
  let any = false
  diff.hunks.forEach((h, hi) => {
    if (!h.lines.some((_, li) => selected.has(lineKey(hi, li)))) return
    const body: string[] = []
    let oldCount = 0
    let newCount = 0
    let keptPrevious = true
    for (const li of replacementLineOrder(h.lines)) {
      const l = h.lines[li]
      const raw = h.raw[li + 1]
      const picked = selected.has(lineKey(hi, li))
      const asContext = () => {
        body.push(' ' + raw.slice(1))
        oldCount++
        newCount++
        keptPrevious = true
      }
      if (l.type === 'note') {
        if (keptPrevious) body.push(raw)
      } else if (l.type === 'ctx') {
        asContext()
      } else if (l.type === 'add') {
        if (picked) {
          body.push(raw)
          newCount++
          keptPrevious = true
        } else if (reverse) asContext()
        else keptPrevious = false
      } else {
        if (picked) {
          body.push(raw)
          oldCount++
          keptPrevious = true
        } else if (!reverse) asContext()
        else keptPrevious = false
      }
    }
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(h.header)
    if (!m) return
    out.push(`@@ -${m[1]},${oldCount} +${m[2]},${newCount} @@${m[3]}`, ...body)
    any = true
  })
  return any ? out.join('\n') + '\n' : null
}

/** Emit changes in display-row order so retained context cannot move a selected line
 * past its neighbours. Unequal blocks keep their extra lines after the aligned rows,
 * as in the side-by-side display, without making those rows selection partners.
 * Keep original indices for selection and raw end-of-file notes.
 */
function replacementLineOrder(lines: DiffLine[]): number[] {
  const order: number[] = []
  let cursor = 0
  for (const { start, end, old, next } of replacementBlocks(lines)) {
    while (cursor < start) order.push(cursor++)
    for (let row = 0; row < Math.max(old.length, next.length); row++) {
      order.push(...(old[row] ?? []), ...(next[row] ?? []))
    }
    cursor = end
  }
  while (cursor < lines.length) order.push(cursor++)
  return order
}

/** Notes travel with the line they describe, including when pairs are reordered. */
function* replacementBlocks(lines: DiffLine[]) {
  let i = 0
  while (i < lines.length) {
    if (lines[i].type !== 'add' && lines[i].type !== 'del') {
      i++
      continue
    }
    const start = i
    const old: number[][] = []
    const next: number[][] = []
    while (i < lines.length && (lines[i].type === 'add' || lines[i].type === 'del')) {
      const side = lines[i].type === 'del' ? old : next
      const entry = [i++]
      while (i < lines.length && lines[i].type === 'note') entry.push(i++)
      side.push(entry)
    }
    yield { start, end: i, old, next }
  }
}

/** A "new file" patch header rewritten as a plain modification of the same path. */
function asModification(header: string[]) {
  const target = header.find((l) => l.startsWith('+++ b/'))?.slice(6)
  if (!target) return [...header]
  return header
    .filter((l) => !/^(new file mode|index) /.test(l))
    .map((l) => (l === '--- /dev/null' ? `--- a/${target}` : l))
}
