import type { Commit } from './types'

// A file's commits are not connected to each other, so they are drawn as one line.
export function singleLane(commits: Commit[]): Commit[] {
  return commits.map((c, i) => ({ ...c, parents: commits[i + 1] ? [commits[i + 1].hash] : [] }))
}

// One `git log --follow --name-status` chunk: the formatted record, then `STATUS\tpath` lines
// (`R100\told\tnew` for renames). Returns the record, the file's path in that commit, and its status
// and previous path when the log reported them.
export function splitFileLogChunk(chunk: string, file: string): { record: string; path: string; status?: string; oldPath?: string } {
  const [record, ...changes] = chunk.split('\n')
  const columns = changes.find((l) => l.trim())?.split('\t')
  if (!columns || columns.length < 2) return { record, path: file }
  const status = columns[0][0]
  return {
    record,
    path: columns[columns.length - 1],
    status,
    ...(columns.length > 2 && /^[RC]/.test(status) ? { oldPath: columns[1] } : {})
  }
}
