import { test } from 'node:test'
import assert from 'node:assert/strict'
import { workingFiles } from '../src/shared/working.ts'
import { parseNumstat } from '../src/shared/numstat.ts'
import type { FileChange, RepoStatus } from '../src/shared/types.ts'

const status = (staged: FileChange[], unstaged: FileChange[], conflicted: FileChange[] = []): RepoStatus => ({
  branch: 'main',
  head: 'abc',
  upstream: null,
  ahead: 0,
  behind: 0,
  staged,
  unstaged,
  conflicted,
  state: 'clean'
})
const listed = (s: RepoStatus) => workingFiles(s).map((f) => [f.path, f.status, f.oldPath])

test('working files list each path once against HEAD, sorted, staged status first', () => {
  const s = status(
    [
      { path: 'b.ts', status: 'A' },
      { path: 'new.ts', oldPath: 'old.ts', status: 'R' }
    ],
    [
      { path: 'b.ts', status: 'M' },
      { path: 'new.ts', status: 'M' },
      { path: 'a.ts', status: 'M' },
      { path: 'z.txt', status: '?' }
    ],
    [{ path: 'c.ts', status: 'UU' }]
  )
  assert.deepEqual(listed(s), [
    ['a.ts', 'M', undefined],
    ['b.ts', 'A', undefined],
    ['c.ts', 'M', undefined],
    ['new.ts', 'R', 'old.ts'],
    ['z.txt', '?', undefined]
  ])
})

test('a file deleted from the working tree is deleted, and one added then deleted is no change', () => {
  const s = status(
    [
      { path: 'added.ts', status: 'A' },
      { path: 'edited.ts', status: 'M' },
      { path: 'moved.ts', oldPath: 'was.ts', status: 'R' }
    ],
    [
      { path: 'added.ts', status: 'D' },
      { path: 'edited.ts', status: 'D' },
      { path: 'moved.ts', status: 'D' }
    ]
  )
  assert.deepEqual(listed(s), [
    ['edited.ts', 'D', undefined],
    ['was.ts', 'D', undefined]
  ])
  assert.deepEqual(workingFiles(null), [])
})

test('numstat counts are keyed by the new path, with null for binary files', () => {
  const out = ['3\t1\ta.ts', '-\t-\timg.png', '0\t0\t', 'old.ts', 'new.ts', ''].join('\0')
  assert.deepEqual(
    [...parseNumstat(out)],
    [
      ['a.ts', { additions: 3, deletions: 1 }],
      ['img.png', { additions: null, deletions: null }],
      ['new.ts', { additions: 0, deletions: 0 }]
    ]
  )
  assert.equal(parseNumstat('').size, 0)
})
