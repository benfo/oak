import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteBranches, findBranchCleanup } from '../src/main/branchCleanup.ts'
import { cleanupNote, keptNote } from '../src/shared/branchCleanup.ts'

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

test('the default branch, the checked-out branch and branches in other worktrees are never offered', async () => {
  const { dir, root } = cloned()
  run(dir, 'branch', 'elsewhere')
  run(dir, 'worktree', 'add', '-q', join(root, 'other'), 'elsewhere')
  run(dir, 'switch', '-q', '-c', 'here')
  assert.deepEqual(await findBranchCleanup(dir), { target: 'origin/main', candidates: [], kept: [] })
})

test('a gone branch checked out in another worktree is kept and named', async () => {
  const { dir, root } = cloned()
  run(dir, 'switch', '-q', '-c', 'parked')
  run(dir, 'push', '-q', '-u', 'origin', 'parked')
  run(dir, 'switch', '-q', 'main')
  run(dir, 'push', '-q', 'origin', '--delete', 'parked')
  run(dir, 'fetch', '-q', '--prune')
  run(dir, 'worktree', 'add', '-q', join(root, 'other'), 'parked')
  const found = await findBranchCleanup(dir)
  assert.deepEqual(found.candidates, [])
  assert.deepEqual(
    found.kept.map((kept) => kept.name),
    ['parked']
  )
  assert.match(found.kept[0].worktree!, /other$/)
  assert.equal(keptNote(found.kept[0]), `checked out in ${found.kept[0].worktree}`)
  assert.equal(keptNote({ name: 'here', worktree: null }), 'checked out here')
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
