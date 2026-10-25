export interface BlameCommit {
  hash: string
  author: string
  email: string
  /** Unix seconds. */
  time: number
  summary: string
  /** Not committed yet: the line only exists in the working tree. */
  uncommitted: boolean
}

export interface BlameLine {
  hash: string
  text: string
}

export interface BlameResult {
  lines: BlameLine[]
  commits: Record<string, BlameCommit>
  binary: boolean
}

export interface BlameOptions {
  ignoreWhitespace: boolean
  /** A revisions file to skip (for example `.git-blame-ignore-revs`), when Git isn't already configured to use one. */
  ignoreRevsFile?: string
}

/** `-M` follows lines moved within the file; `-C` is left out as slow and surprising. A null `rev` blames the working tree. */
export function blameArgs(file: string, rev: string | null, opts: BlameOptions): string[] {
  return [
    'blame',
    '--porcelain',
    '-M',
    ...(opts.ignoreWhitespace ? ['-w'] : []),
    ...(opts.ignoreRevsFile ? ['--ignore-revs-file', opts.ignoreRevsFile] : []),
    ...(rev ? [rev] : []),
    '--',
    file
  ]
}

const HEADER = /^([0-9a-f]{40,64}) \d+ \d+(?: \d+)?$/
const ZERO = /^0+$/

/** Parses `git blame --porcelain`. Each line names its commit; a commit's details come with its first line. */
export function parseBlame(output: string): BlameResult {
  const lines: BlameLine[] = []
  const commits: Record<string, BlameCommit> = {}
  let current: BlameCommit | null = null
  let binary = false
  for (const raw of output.split('\n')) {
    if (raw.startsWith('\t')) {
      if (!current) continue
      const text = raw.slice(1).replace(/\r$/, '')
      if (text.includes('\0')) binary = true
      lines.push({ hash: current.hash, text })
      continue
    }
    const header = HEADER.exec(raw)
    if (header) {
      const hash = header[1]
      current = commits[hash] ??= { hash, author: '', email: '', time: 0, summary: '', uncommitted: ZERO.test(hash) }
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
  }
  return { lines, commits, binary }
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
