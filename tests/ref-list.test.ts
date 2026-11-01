import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { branchDetails, listBranches } from '../src/main/refs.ts'
import { findBranch, logNeedsBranches, withDetails } from '../src/shared/refList.ts'

const repo = mkdtempSync(join(tmpdir(), 'oak-ref-list-'))
after(() => rmSync(repo, { recursive: true, force: true }))
const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repo,
    encoding: 'utf8'
  }).trim()

test('the fast listing is complete and correct, and the details fill in afterwards', async () => {
  git('init', '-q', '-b', 'main')
  git('commit', '--allow-empty', '-qm', 'Initial')
  const first = git('rev-parse', 'HEAD')
  git('commit', '--allow-empty', '-qm', 'Second')
  git('branch', 'tracked', first)
  git('branch', 'orphaned', first)
  git('tag', 'light')
  git('tag', '-a', 'annotated', '-m', 'Release', first)
  // Remote-tracking refs written directly, so no server is needed.
  git('update-ref', 'refs/remotes/origin/main', first)
  git('update-ref', 'refs/remotes/origin/gone-soon', first)
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  git('config', 'remote.origin.url', 'https://example.invalid/repo.git')
  git('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*')
  git('config', 'branch.tracked.remote', 'origin')
  git('config', 'branch.tracked.merge', 'refs/heads/main')
  git('config', 'branch.orphaned.remote', 'origin')
  git('config', 'branch.orphaned.merge', 'refs/heads/deleted-upstream')

  const list = await listBranches(repo)
  const byName = Object.fromEntries(list.map((b) => [b.fullName, b]))

  assert.deepEqual(
    list.map((b) => b.fullName),
    git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes', 'refs/tags')
      .split('\n')
      .filter((r) => r !== 'refs/remotes/origin/HEAD'),
    'the same refs as git lists, in the same order'
  )
  assert.equal(byName['refs/heads/main'].current, true)
  assert.equal(byName['refs/heads/tracked'].upstream, 'origin/main')
  assert.equal(byName['refs/heads/tracked'].gone, false)
  assert.equal(byName['refs/heads/orphaned'].gone, true)
  assert.equal(byName['refs/heads/main'].upstream, null)
  assert.equal(byName['refs/tags/annotated'].hash, first, 'an annotated tag is placed on the commit it tags, not its tag object')
  assert.equal(byName['refs/tags/light'].hash, git('rev-parse', 'HEAD'))
  assert.deepEqual(
    [byName['refs/heads/tracked'].ahead, byName['refs/heads/tracked'].date, byName['refs/heads/tracked'].subject],
    [0, 0, ''],
    'details are blank until they load'
  )

  const details = await branchDetails(repo)
  const merged = withDetails(list, details)
  const tracked = merged.find((b) => b.fullName === 'refs/heads/main')!
  assert.equal(tracked.subject, 'Second')
  assert.ok(tracked.date > 0)
  const behind = withDetails(list, details).find((b) => b.fullName === 'refs/heads/tracked')!
  assert.equal(behind.behind, 0)
  assert.equal(behind.ahead, 0)
  assert.equal(withDetails(merged, details)[0], merged[0], 'unchanged details keep the same object')
})

test('the commit list waits for branches only when hiding or a comparison scope needs them', () => {
  const none = { showHidden: false, hiddenPatterns: [], hideRemoteOnly: false }
  assert.equal(logNeedsBranches(none, 'all'), false)
  assert.equal(logNeedsBranches(none, 'lineage'), false)
  assert.equal(logNeedsBranches(none, 'head'), true)
  assert.equal(logNeedsBranches(none, 'target'), true)
  assert.equal(logNeedsBranches({ ...none, hiddenPatterns: ['wip/*'] }, 'all'), true)
  assert.equal(logNeedsBranches({ ...none, hideRemoteOnly: true }, 'all'), true)
  assert.equal(logNeedsBranches({ ...none, hiddenPatterns: ['wip/*'], showHidden: true }, 'all'), false)
})

test('a ref is found by type, name and the commit it points at, first match winning', () => {
  const b = (type: 'local' | 'remote' | 'tag', name: string, hash: string, subject = '') =>
    ({
      type,
      name,
      hash,
      subject,
      fullName: `${type}/${name}`,
      upstream: null,
      ahead: 0,
      behind: 0,
      gone: false,
      current: false,
      date: 0
    }) as const
  const list = [b('tag', 'v1', 'aaa', 'first'), b('tag', 'v1', 'aaa', 'second'), b('tag', 'v1', 'bbb'), b('local', 'v1', 'aaa')]
  assert.equal(findBranch(list, 'tag', 'v1', 'aaa')?.subject, 'first')
  assert.equal(findBranch(list, 'tag', 'v1', 'bbb')?.hash, 'bbb')
  assert.equal(findBranch(list, 'local', 'v1', 'aaa')?.type, 'local')
  assert.equal(findBranch(list, 'tag', 'v1', 'ccc'), undefined, 'the same name on another commit is not a match')
  assert.equal(findBranch(list, 'remote', 'v1', 'aaa'), undefined)
})
