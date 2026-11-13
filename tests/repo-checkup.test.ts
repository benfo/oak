import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compactRepo, runCheckup } from '../src/main/repoCheckup.ts'
import {
  checkupDone,
  checkupKept,
  checkupStopped,
  checkupTasks,
  compactNote,
  checkupCaution,
  checkupRows,
  checkupTiles,
  checkupVerdict,
  formatSize,
  parseCountObjects,
  tickedBranches,
  worthCompacting,
  type RepoCheckup
} from '../src/shared/repoCheckup.ts'

const run = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim()

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'oak-checkup-'))
  run(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'f.txt'), 'x')
  run(dir, 'add', 'f.txt')
  run(dir, 'commit', '-q', '-m', 'base')
  return dir
}

const storage = { looseCount: 4100, looseBytes: 2 * 1024 * 1024, packs: 3, packBytes: 310 * 1024 * 1024 }
const checkup: RepoCheckup = {
  cleanup: {
    target: 'origin/main',
    kept: [],
    candidates: [
      { name: 'done', reason: 'merged', unmerged: 0 },
      { name: 'squashed', reason: 'gone', unmerged: 3 }
    ]
  },
  storage,
  staleLock: false
}
const tidy: RepoCheckup = {
  cleanup: { target: 'main', candidates: [], kept: [] },
  storage: { ...storage, looseCount: 12, packs: 1 },
  staleLock: true
}

test('count-objects output is read in bytes', () => {
  const out = 'count: 12\nsize: 48\nin-pack: 900\npacks: 2\nsize-pack: 1024\nprune-packable: 0\ngarbage: 0\nsize-garbage: 0\n'
  assert.deepEqual(parseCountObjects(out), { looseCount: 12, looseBytes: 48 * 1024, packs: 2, packBytes: 1024 * 1024 })
})

test('sizes read in the unit a person would use', () => {
  assert.equal(formatSize(2048), '2 KB')
  assert.equal(formatSize(5.5 * 1024 * 1024), '5.5 MB')
  assert.equal(formatSize(312 * 1024 * 1024), '312 MB')
  assert.equal(formatSize(3 * 1024 ** 3), '3.0 GB')
})

test('compacting is suggested only for many loose objects or packs', () => {
  assert.equal(worthCompacting(storage), true)
  assert.equal(worthCompacting({ ...storage, looseCount: 12 }), false)
  assert.equal(worthCompacting({ ...storage, looseCount: 0, packs: 40 }), true)
})

test('tiles cover every area, also with nothing to do', () => {
  assert.deepEqual(
    checkupTiles(checkup, 'clean').map((t) => [t.label, t.value, t.detail, t.attention]),
    [
      ['Branches', '2 to clean up', '1 merged, 1 upstream gone', true],
      ['Storage', '312 MB', '4,100 loose objects, 3 packs', true],
      ['State', 'Clean', 'No operation left unfinished', false]
    ]
  )
  assert.deepEqual(
    checkupTiles(tidy, 'clean').map((t) => [t.value, t.detail, t.attention]),
    [
      ['Tidy', 'Nothing merged into main or gone', false],
      ['312 MB', '12 loose objects, 1 pack', false],
      ['Stale lock', 'A leftover index.lock may be blocking Git', true]
    ]
  )
  assert.equal(checkupTiles(tidy, 'rebasing')[2].value, 'Rebase in progress')
})

test('gone branches that are checked out are named as kept', () => {
  const kept = (names: string[]) => ({ ...tidy.cleanup, kept: names })
  assert.equal(checkupKept(kept([])), undefined)
  assert.equal(checkupKept(kept(['a'])), 'a has a gone upstream but is checked out in a worktree, so it stays.')
  assert.equal(checkupKept(kept(['a', 'b'])), 'a and b have a gone upstream but are checked out in worktrees, so they stay.')
  assert.equal(
    checkupKept(kept(['a', 'b', 'c', 'd'])),
    'a, b and 2 more have a gone upstream but are checked out in worktrees, so they stay.'
  )
  assert.equal(checkupTiles({ ...tidy, cleanup: kept(['a', 'b']) }, 'clean')[0].detail, '2 gone but checked out')
})

test('the verdict and caution follow what is listed', () => {
  assert.equal(checkupVerdict(checkupRows(checkup)), 'Tick what to clean up, then confirm.')
  assert.match(checkupVerdict(checkupRows(tidy)), /^Everything looks tidy/)
  assert.match(checkupCaution(checkup) ?? '', /lost with it/)
  assert.equal(checkupCaution(tidy), undefined)
})

test('rows offer each branch and compacting, ticked when worth doing', () => {
  const rows = checkupRows(checkup)
  assert.deepEqual(
    rows.map((r) => [r.id, r.group, r.checked, r.warn]),
    [
      ['branch:done', 'Delete branches', true, false],
      ['branch:squashed', 'Delete branches', true, true],
      ['compact', 'Storage', true, false]
    ]
  )
  assert.deepEqual(tickedBranches(rows.map((r) => r.id)), ['done', 'squashed'])
  assert.deepEqual(
    checkupRows(tidy).map((r) => [r.id, r.checked, r.note]),
    [['compact', false, 'already compact']]
  )
})

test('the result says what was done', () => {
  assert.equal(checkupDone(['done'], null), 'Deleted done')
  assert.equal(checkupDone(['a', 'b'], 12 * 1024 * 1024), 'Deleted 2 branches, compacted, freed 12.0 MB')
  assert.equal(checkupDone([], 0), 'Compacted, nothing to free')
  assert.equal(compactNote(2048), 'freed 2 KB')
  assert.equal(checkupStopped('Delete a'), 'Stopped at "Delete a". Nothing after it ran.')
})

test('the ticked rows become one task per step', () => {
  assert.deepEqual(checkupTasks(['branch:a', 'branch:b', 'compact']), [
    { id: 'branches', label: 'Delete 2 branches' },
    { id: 'compact', label: 'Compact repository' }
  ])
  assert.deepEqual(checkupTasks(['branch:a']), [{ id: 'branches', label: 'Delete a' }])
  assert.deepEqual(checkupTasks(['compact']), [{ id: 'compact', label: 'Compact repository' }])
})

test('a check-up reads branches, storage and a stale lock without changing the repository', async () => {
  const dir = repo()
  run(dir, 'branch', 'old')
  const lock = join(dir, '.git', 'index.lock')
  writeFileSync(lock, '')
  assert.equal((await runCheckup(dir)).staleLock, false, 'a fresh lock may belong to a running git')
  const longAgo = new Date(Date.now() - 10 * 60_000)
  utimesSync(lock, longAgo, longAgo)
  const found = await runCheckup(dir)
  assert.equal(found.staleLock, true)
  assert.deepEqual(found.cleanup.candidates, [{ name: 'old', reason: 'merged', unmerged: 0 }])
  assert.ok(found.storage.looseCount > 0)
  assert.equal(run(dir, 'branch', '--format=%(refname:short)'), 'main\nold')
})

test('compacting packs the loose objects', async () => {
  const dir = repo()
  const after = await compactRepo(dir)
  assert.equal(after.looseCount, 0)
  assert.equal(after.packs, 1)
})
