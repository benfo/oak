import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCommitPreviewLoader } from '../src/renderer/src/history/commitPreview.ts'
import { comparisonSummary } from '../src/renderer/src/history/comparisonModes.ts'
import type { CommitDetails } from '../src/shared/types.ts'

const info = (hash: string): CommitDetails => ({
  hash,
  parents: ['parent'],
  author: 'Test',
  email: 'test@example.invalid',
  authorDate: 1,
  committer: 'Test',
  committerEmail: 'test@example.invalid',
  commitDate: 1,
  message: hash,
  files: ['a.ts', 'b.ts'].map((path) => ({ path, status: 'M', additions: 1, deletions: 1 }))
})

test('file history previews skip the commit file listing and diff only the file, following renames', async () => {
  const calls: unknown[][] = []
  const load = createCommitPreviewLoader({
    commitDetails: async () => {
      throw new Error('commit details are not needed')
    },
    commitFileDiff: async (...args) => {
      calls.push(args)
      return 'diff'
    }
  })
  const commit = {
    hash: 'A',
    parents: ['P'],
    author: 'Ann',
    email: 'a@example.invalid',
    date: 5,
    subject: 'Rename it',
    refs: [],
    path: 'new.ts',
    oldPath: 'old.ts',
    status: 'R'
  }
  const result = await load('repo', 'A', 'new.ts', 3, undefined, undefined, undefined, commit)
  assert.deepEqual(calls, [['repo', 'A', 'P', 'new.ts', 'old.ts', 3]])
  assert.equal(result.details.message, 'Rename it')
  assert.deepEqual(
    result.details.files.map((f) => [f.path, f.oldPath, f.status]),
    [['new.ts', 'old.ts', 'R']]
  )
  assert.equal(result.diff, 'diff')
})

test('a preview is not ready until the matching file diff is ready', async () => {
  let resolveDiff!: (diff: string) => void
  const diff = new Promise<string>((resolve) => {
    resolveDiff = resolve
  })
  const load = createCommitPreviewLoader({ commitDetails: async (repo, hash) => info(hash), commitFileDiff: () => diff })
  let ready = false
  const preview = load('repo', 'A', null, 3).then((p) => {
    ready = true
    return p
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(ready, false)
  resolveDiff('diff A/a.ts')
  const result = await preview
  assert.equal(result.details.hash, 'A')
  assert.equal(result.file?.path, 'a.ts')
  assert.equal(result.diff, 'diff A/a.ts')
})

test('revisits and simultaneous requests reuse metadata and file diffs', async () => {
  let metadataCalls = 0
  let diffCalls = 0
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash) => {
      metadataCalls++
      return info(hash)
    },
    commitFileDiff: async (_, hash, parent, path) => {
      diffCalls++
      return `${hash}/${path}`
    }
  })
  const [a, b] = await Promise.all([load('repo', 'A', null, 3), load('repo', 'A', null, 3)])
  assert.deepEqual(a, b)
  await load('repo', 'A', null, 3)
  assert.equal(metadataCalls, 1)
  assert.equal(diffCalls, 1)
  assert.equal((await load('repo', 'A', 'b.ts', 3)).diff, 'A/b.ts')
  assert.equal(metadataCalls, 1)
  assert.equal(diffCalls, 2)
})

test('repository and context changes do not reuse the wrong diff', async () => {
  let metadataCalls = 0
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash) => {
      metadataCalls++
      return info(hash)
    },
    commitFileDiff: async (repo, hash, parent, path, oldPath, context) => `${repo}/${hash}/${path}/${context}`
  })
  assert.equal((await load('one', 'A', null, 3)).diff, 'one/A/a.ts/3')
  assert.equal((await load('one', 'A', null, 10)).diff, 'one/A/a.ts/10')
  assert.equal((await load('two', 'A', null, 3)).diff, 'two/A/a.ts/3')
  assert.equal(metadataCalls, 2)
})

test('failed diffs can be retried without refetching metadata', async () => {
  let attempts = 0
  let metadataCalls = 0
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash) => {
      metadataCalls++
      return info(hash)
    },
    commitFileDiff: async () => {
      if (++attempts === 1) throw new Error('temporary failure')
      return 'ready'
    }
  })
  await assert.rejects(load('repo', 'A', null, 3), /temporary failure/)
  assert.equal((await load('repo', 'A', null, 3)).diff, 'ready')
  assert.equal(metadataCalls, 1)
})

test('empty commits have no file diff, and a missing requested path falls back to the first file', async () => {
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash) => (hash === 'empty' ? { ...info(hash), files: [] } : info(hash)),
    commitFileDiff: async (_, hash, parent, path) => `${hash}/${path}`
  })
  const empty = await load('repo', 'empty', null, 3)
  assert.equal(empty.file, null)
  assert.equal(empty.diff, null)
  assert.equal((await load('repo', 'A', 'missing.ts', 3)).file?.path, 'a.ts')
})

test('comparison baselines isolate file lists and diffs from single commits and each other', async () => {
  const calls: string[] = []
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash, base) => {
      calls.push(`${base}/${hash}`)
      return { ...info(hash), files: [{ path: `${base ?? 'parent'}.ts`, status: 'M', additions: 1, deletions: 1 }] }
    },
    commitFileDiff: async (_, hash, parent, path) => `${parent}/${hash}/${path}`
  })
  assert.equal((await load('repo', 'A', null, 3)).diff, 'parent/A/parent.ts')
  const ab = await load('repo', 'A', null, 3, 'B')
  assert.equal(ab.compareBase, 'B')
  assert.equal(ab.diff, 'B/A/B.ts')
  assert.equal((await load('repo', 'A', 'B.ts', 3, 'C')).diff, 'C/A/C.ts')
  assert.equal((await load('repo', 'B', null, 3, 'A')).diff, 'A/B/A.ts')
  assert.deepEqual(await load('repo', 'A', null, 3, 'B'), ab)
  assert.equal(calls.length, 4)
})

test('branch comparisons show changes since the common ancestor and follow target hashes', async () => {
  const baseCalls: string[] = []
  const load = createCommitPreviewLoader({
    mergeBase: async (_, target, hash) => {
      baseCalls.push(`${target}/${hash}`)
      return target === 'main-2' ? 'fork-2' : 'fork'
    },
    commitDetails: async (_, hash) => info(hash),
    commitFileDiff: async (_, hash, parent, path) => `${parent}/${hash}/${path}`
  })
  const target = { targetName: 'main', targetHash: 'main-1' }
  assert.equal((await load('repo', 'feature', null, 3, undefined, target)).diff, 'fork/feature/a.ts')
  assert.equal((await load('repo', 'feature', 'b.ts', 3, undefined, target)).diff, 'fork/feature/b.ts')
  assert.equal(baseCalls.length, 1)
  assert.equal((await load('repo', 'feature', null, 3, undefined, { ...target, targetHash: 'main-2' })).diff, 'fork-2/feature/a.ts')
  assert.equal((await load('repo', 'earlier', null, 3, undefined, target)).diff, 'fork/earlier/a.ts')
  assert.deepEqual(baseCalls, ['main-1/feature', 'main-2/feature', 'main-1/earlier'])
})

test('a deleted target fails clearly and merge-base failures can be retried', async () => {
  let attempts = 0
  const load = createCommitPreviewLoader({
    mergeBase: async () => {
      if (++attempts === 1) throw new Error('No common ancestor')
      return 'fork'
    },
    commitDetails: async (_, hash) => info(hash),
    commitFileDiff: async (_, hash, parent) => `${parent}/${hash}`
  })
  const target = { targetName: 'main', targetHash: 'tip' }
  await assert.rejects(load('repo', 'feature', null, 3, undefined, { ...target, targetHash: null }), /no longer exists/)
  await assert.rejects(load('repo', 'feature', null, 3, undefined, target), /No common ancestor/)
  assert.equal((await load('repo', 'feature', null, 3, undefined, target)).diff, 'fork/feature')
})

test('without a single common ancestor changes fall back to the tip difference', async () => {
  const load = createCommitPreviewLoader({
    mergeBase: async () => null,
    commitDetails: async (_, hash) => info(hash),
    commitFileDiff: async (_, hash, parent) => `${parent}/${hash}`
  })
  const preview = await load('repo', 'feature', null, 3, undefined, { targetName: 'main', targetHash: 'tip' })
  assert.equal(preview.comparisonMode, 'snapshots')
  assert.equal(preview.diff, 'tip/feature')
})

test('the summary says when the target has newer commits that are not shown', () => {
  assert.match(comparisonSummary('main', 'changes', { ahead: 3 }), /3 newer commits are not shown/)
  assert.match(comparisonSummary('main', 'changes', { ahead: 1 }), /1 newer commit is not shown/)
  assert.doesNotMatch(comparisonSummary('main', 'changes', { ahead: 0 }), /not shown/)
  assert.match(comparisonSummary('main', 'snapshots', null), /No single common ancestor/)
})

test('working changes are never cached, so edits show on the next load', async () => {
  let calls = 0
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash) => info(hash),
    commitFileDiff: async () => '',
    workingChanges: async () => [{ path: 'a.ts', status: '?', additions: null, deletions: null }],
    workingFileDiff: async (_repo, path, status) => `${status}:${path}:${++calls}`
  })
  assert.equal((await load('repo', 'working-changes', null, 3)).diff, '?:a.ts:1')
  assert.equal((await load('repo', 'working-changes', null, 3)).diff, '?:a.ts:2')
})

test('working file list is reused within a refresh revision so picking a file only loads its diff', async () => {
  let listings = 0
  const load = createCommitPreviewLoader({
    commitDetails: async (_, hash) => info(hash),
    commitFileDiff: async () => '',
    workingChanges: async () => {
      listings++
      return [
        { path: 'a.ts', status: 'M', additions: 1, deletions: 0 },
        { path: 'b.ts', status: 'M', additions: 1, deletions: 0 }
      ]
    },
    workingFileDiff: async (_repo, path) => path
  })
  assert.equal((await load('repo', 'working-changes', 'a.ts', 3, undefined, undefined, 1)).diff, 'a.ts')
  assert.equal((await load('repo', 'working-changes', 'b.ts', 3, undefined, undefined, 1)).diff, 'b.ts')
  assert.equal(listings, 1)
  await load('repo', 'working-changes', 'b.ts', 3, undefined, undefined, 2)
  assert.equal(listings, 2)
})
