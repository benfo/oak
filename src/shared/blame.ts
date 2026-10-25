export interface BlameCommit {
  hash: string
  author: string
  email: string
  /** Unix seconds. */
  time: number
  summary: string
  /** Not committed yet: the line only exists in the working tree. */
  uncommitted: boolean
  /** The commit has no earlier version to step back to (the history's root, or the edge of a shallow clone). */
  boundary: boolean
}

export interface BlameLine {
  hash: string
  text: string
  /** The line's number in the commit that introduced it, which is where that commit's diff shows it. */
  origLine: number
  /** The file's path in that commit; it differs from the blamed file after a rename or a moved line. */
  file: string
  /** Blame passed over a commit on the ignore-revs list to name this one, so the line's real last change is hidden. */
  ignored: boolean
}

export interface BlameResult {
  lines: BlameLine[]
  commits: Record<string, BlameCommit>
  binary: boolean
  /** The repository has an ignore-revs list, whether or not this blame applied it. */
  hasIgnoreRevs?: boolean
}

export interface BlameOptions {
  ignoreWhitespace: boolean
  /** A revisions file to skip (for example `.git-blame-ignore-revs`), when Git isn't already configured to use one. */
  ignoreRevsFile?: string
  /** Turns the ignore-revs list off, including one Git is configured to use. */
  skipIgnoreRevs?: boolean
}

/** `-M` follows lines moved within the file; `-C` is left out as slow and surprising. A null `rev` blames the working tree. */
export function blameArgs(file: string, rev: string | null, opts: BlameOptions): string[] {
  return [
    // Without this the output does not say which lines were attributed by skipping an ignored commit.
    '-c',
    'blame.markIgnoredLines=true',
    'blame',
    '--porcelain',
    '-M',
    ...(opts.ignoreWhitespace ? ['-w'] : []),
    // An empty name clears the list, including one that comes from Git's configuration.
    ...(opts.skipIgnoreRevs ? ['--ignore-revs-file', ''] : opts.ignoreRevsFile ? ['--ignore-revs-file', opts.ignoreRevsFile] : []),
    ...(rev ? [rev] : []),
    '--',
    file
  ]
}

const HEADER = /^([0-9a-f]{40,64}) (\d+) \d+(?: \d+)?$/
const ZERO = /^0+$/

/** Parses `git blame --porcelain`. Each line names its commit; a commit's details come with its first line. */
export function parseBlame(output: string): BlameResult {
  const lines: BlameLine[] = []
  const commits: Record<string, BlameCommit> = {}
  const files: Record<string, string> = {}
  let current: BlameCommit | null = null
  let origLine = 0
  let ignored = false
  let binary = false
  for (const raw of output.split('\n')) {
    if (raw.startsWith('\t')) {
      if (!current) continue
      const text = raw.slice(1).replace(/\r$/, '')
      if (text.includes('\0')) binary = true
      lines.push({ hash: current.hash, text, origLine, file: files[current.hash] ?? '', ignored })
      continue
    }
    const header = HEADER.exec(raw)
    if (header) {
      const hash = header[1]
      origLine = Number(header[2])
      ignored = false
      current = commits[hash] ??= { hash, author: '', email: '', time: 0, summary: '', uncommitted: ZERO.test(hash), boundary: false }
      continue
    }
    if (!current) continue
    const space = raw.indexOf(' ')
    const key = space < 0 ? raw : raw.slice(0, space)
    const value = space < 0 ? '' : raw.slice(space + 1)
    if (key === 'author') current.author = value
    else if (key === 'author-mail') current.email = value.replace(/^<|>$/g, '')
    else if (key === 'author-time') current.time = Number(value) || 0
    else if (key === 'summary') current.summary = value
    else if (key === 'filename') files[current.hash] = value
    else if (key === 'boundary') current.boundary = true
    else if (key === 'ignored') ignored = true
  }
  return { lines, commits, binary }
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/**
 * Where a line of the newer version sits in the older one, read from a zero-context diff of the two (`older` to `newer`).
 * `added` means the newer version inserted the line, so it has no counterpart and `line` is the nearest one above it.
 */
export function mapLineToOlder(diff: string, line: number): { line: number; added: boolean } {
  let shift = 0
  for (const row of diff.split('\n')) {
    const hunk = HUNK.exec(row)
    if (!hunk) continue
    const from = Number(hunk[1])
    const removed = hunk[2] === undefined ? 1 : Number(hunk[2])
    const start = Number(hunk[3])
    const added = hunk[4] === undefined ? 1 : Number(hunk[4])
    // A hunk that only deletes names the newer line before it, not one it covers.
    if (added === 0 ? line <= start : line < start) break
    if (added > 0 && line < start + added) {
      return removed === 0 ? { line: Math.max(1, from), added: true } : { line: from + Math.min(line - start, removed - 1), added: false }
    }
    shift += removed - added
  }
  return { line: Math.max(1, line + shift), added: false }
}

/** Indexes of the lines whose text contains the query, ignoring case. An empty query finds nothing. */
export function findLines(lines: readonly Pick<BlameLine, 'text'>[], query: string): number[] {
  const needle = query.toLowerCase()
  const found: number[] = []
  if (!needle) return found
  lines.forEach((line, i) => {
    if (line.text.toLowerCase().includes(needle)) found.push(i)
  })
  return found
}

/** Where the query occurs in a line, as [start, end) offsets, ignoring case and without overlaps. */
export function findRanges(text: string, query: string): [number, number][] {
  const hay = text.toLowerCase()
  const needle = query.toLowerCase()
  // Lowering the case of a few characters changes their length, which would put the offsets out of step with the text.
  if (!needle || hay.length !== text.length) return []
  const ranges: [number, number][] = []
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) ranges.push([at, at + needle.length])
  return ranges
}

/** Every occurrence of the query in the file, in reading order: a line that contains it twice has two. */
export function findHits(lines: readonly Pick<BlameLine, 'text'>[], query: string): { line: number; start: number; end: number }[] {
  return lines.flatMap((l, line) => findRanges(l.text, query).map(([start, end]) => ({ line, start, end })))
}

/** The 0-based line a ":120" query names, kept within the file; null when the query is not a line number. */
export function gotoLine(query: string, count: number): number | null {
  const match = /^:\s*(\d+)\s*$/.exec(query)
  if (!match || count < 1) return null
  return Math.min(count, Math.max(1, Number(match[1]))) - 1
}

/** Indexes of the lines that start a run from the same commit. */
export function blameBlockStarts(lines: readonly Pick<BlameLine, 'hash'>[]): number[] {
  const starts: number[] = []
  lines.forEach((line, i) => {
    if (i === 0 || line.hash !== lines[i - 1].hash) starts.push(i)
  })
  return starts
}

/** The start of the run containing `index`. */
export function blockStartOf(starts: readonly number[], index: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid] <= index) low = mid
    else high = mid - 1
  }
  return starts[low] ?? 0
}

/** The line to move to for next (1) or previous (-1) block, or null at the ends. */
export function adjacentBlockStart(starts: readonly number[], index: number, delta: 1 | -1): number | null {
  if (!starts.length) return null
  const start = blockStartOf(starts, index)
  const at = starts.indexOf(start)
  if (delta === 1) return starts[at + 1] ?? null
  return start < index ? start : (starts[at - 1] ?? null)
}
