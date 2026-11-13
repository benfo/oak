import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteBranches, findBranchCleanup, removeWorktrees } from '../src/main/branchCleanup.ts'
import { cleanupNote, parseWorktrees } from '../src/shared/branchCleanup.ts'

const run = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim()

function commit(dir: string, file: string) {
  writeFileSync(join(dir, file), file)
  run(dir, 'add', file)
  run(dir, 'commit', '-q', '-m', file)
}

/** A clone of a bare remote with `main` pushed, so origin/HEAD is set as after a real clone. */
function cloned() {
  const root = mkdtempSync(join(tmpdir(), 'oak-cleanup-'))
  const remote = join(root, 'remote.git')
  const seed = join(root, 'seed')
  run(root, 'init', '-q', '--bare', '-b', 'main', remote)
  run(root, 'init', '-q', '-b', 'main', seed)
  commit(seed, 'base')
  run(seed, 'push', '-q', remote, 'main')
  const dir = join(root, 'work')
  run(root, 'clone', '-q', remote, dir)
  return { dir, root }
}

/** A branch with one commit of its own, pushed with an upstream, leaving `main` checked out. */
function pushedBranch(dir: string, name: string) {
  run(dir, 'switch', '-q', '-c', name)
  commit(dir, name)
  run(dir, 'push', '-q', '-u', 'origin', name)
  run(dir, 'switch', '-q', 'main')
}

const goneUpstream = (dir: string, name: string) => {
  run(dir, 'push', '-q', 'origin', '--delete', name)
  run(dir, 'fetch', '-q', '--prune')
}

test('a branch merged into the default branch is offered, an unmerged one with a live upstream is not', async () => {
  const { dir } = cloned()
  pushedBranch(dir, 'done')
  pushedBranch(dir, 'ongoing')
  run(dir, 'merge', '-q', '--no-ff', '--no-edit', 'done')
  run(dir, 'push', '-q', 'origin', 'main')
  const found = await findBranchCleanup(dir)
  assert.equal(found.target, 'origin/main')
  assert.deepEqual(found.candidates, [{ name: 'done', reason: 'merged', unmerged: 0 }])
})

test('a branch whose upstream was deleted is offered with the commits the default branch lacks', async () => {
  const { dir } = cloned()
  pushedBranch(dir, 'squashed')
  goneUpstream(dir, 'squashed')
  const { candidates, target } = await findBranchCleanup(dir)
  assert.deepEqual(candidates, [{ name: 'squashed', reason: 'gone', unmerged: 1 }])
  assert.equal(cleanupNote(candidates[0], target!), 'upstream gone, 1 commit not in origin/main')
})

test('the default branch and the checked-out branch are never offered', async () => {
  const { dir } = cloned()
  run(dir, 'switch', '-q', '-c', 'here')
  assert.deepEqual(await findBranchCleanup(dir), { target: 'origin/main', candidates: [], kept: [] })
})

test('a finished branch in another worktree is offered with its worktree, unless that has changes or a lock', async () => {
  const { dir, root } = cloned()
  for (const name of ['gone', 'dirty', 'held']) {
    pushedBranch(dir, name)
    run(dir, 'worktree', 'add', '-q', join(root, name), name)
  }
  goneUpstream(dir, 'gone')
  run(dir, 'branch', 'merged')
  run(dir, 'worktree', 'add', '-q', join(root, 'merged'), 'merged')
  goneUpstream(dir, 'dirty')
  writeFileSync(join(root, 'dirty', 'note.txt'), 'unsaved')
  goneUpstream(dir, 'held')
  run(dir, 'worktree', 'lock', join(root, 'held'))

  const found = await findBranchCleanup(dir)
  assert.deepEqual(
    found.candidates.map((c) => [c.name, c.reason, /[\\/](gone|merged)$/.test(c.worktree ?? '')]),
    [
      ['gone', 'gone', true],
      ['merged', 'merged', true]
    ]
  )
  assert.deepEqual(
    found.kept.map((kept) => [kept.name, kept.why]),
    [
      ['dirty', 'changes'],
      ['held', 'locked']
    ]
  )

  await removeWorktrees(
    dir,
    found.candidates.map((c) => c.worktree!)
  )
  await deleteBranches(
    dir,
    found.candidates.map((c) => c.name)
  )
  assert.equal(run(dir, 'branch', '--format=%(refname:short)'), 'dirty\nheld\nmain')
  await assert.rejects(removeWorktrees(dir, [join(root, 'dirty')]), /modified or untracked/)
})

test('seen from a linked worktree, a finished branch in the main worktree is kept', async () => {
  const { dir, root } = cloned()
  pushedBranch(dir, 'old')
  goneUpstream(dir, 'old')
  run(dir, 'switch', '-q', 'old')
  run(dir, 'worktree', 'add', '-q', join(root, 'linked'), '-b', 'work')
  const found = await findBranchCleanup(join(root, 'linked'))
  assert.deepEqual(found.candidates, [])
  assert.deepEqual(
    found.kept.map((kept) => [kept.name, kept.why]),
    [['old', 'main']]
  )
})

test('a worktree with paths longer than Windows allows by default is still read and removed', async () => {
  const { dir, root } = cloned()
  writeFileSync(join(dir, '.gitignore'), 'deep/')
  run(dir, 'add', '.gitignore')
  run(dir, 'commit', '-q', '-m', 'ignore')
  run(dir, 'push', '-q', 'origin', 'main')
  run(dir, 'branch', 'long')
  const worktree = join(root, 'long')
  run(dir, 'worktree', 'add', '-q', worktree, 'long')
  const deep = join(worktree, 'deep', ...Array.from({ length: 8 }, () => 'd'.repeat(40)))
  mkdirSync(deep, { recursive: true })
  writeFileSync(join(deep, 'file.txt'), 'x')
  const found = await findBranchCleanup(dir)
  assert.deepEqual(
    found.candidates.map((c) => c.name),
    ['long']
  )
  await removeWorktrees(dir, [worktree])
  assert.equal(existsSync(worktree), false)
})

test('the worktree list is read with its locks and missing folders', () => {
  const out =
    'worktree C:/r\nHEAD 1\nbranch refs/heads/main\n\nworktree C:/a\nHEAD 1\nbranch refs/heads/feature/a\nlocked\n\nworktree C:/b\nHEAD 1\ndetached\nprunable gone\n\n'
  assert.deepEqual(parseWorktrees(out), [
    { path: 'C:/r', branch: 'main', main: true, locked: false, prunable: false },
    { path: 'C:/a', branch: 'feature/a', main: false, locked: true, prunable: false },
    { path: 'C:/b', branch: null, main: false, locked: false, prunable: true }
  ])
})

test('without a remote the conventional local branch is the target', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oak-cleanup-'))
  run(dir, 'init', '-q', '-b', 'main')
  commit(dir, 'base')
  run(dir, 'branch', 'old')
  assert.deepEqual(await findBranchCleanup(dir), { target: 'main', candidates: [{ name: 'old', reason: 'merged', unmerged: 0 }], kept: [] })
})

test('no default branch means nothing is offered', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oak-cleanup-'))
  run(dir, 'init', '-q', '-b', 'trunk')
  commit(dir, 'base')
  run(dir, 'branch', 'old')
  assert.deepEqual(await findBranchCleanup(dir), { target: null, candidates: [], kept: [] })
})

test('deleting removes unmerged branches too and leaves the rest', async () => {
  const { dir } = cloned()
  pushedBranch(dir, 'squashed')
  pushedBranch(dir, 'keep')
  goneUpstream(dir, 'squashed')
  await deleteBranches(dir, ['squashed'])
  assert.equal(run(dir, 'branch', '--format=%(refname:short)'), 'keep\nmain')
})
