import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_BRANCH_OPTIONS,
  hiddenBranchCount,
  hiddenBranchRefs,
  hiddenRefGlobs,
  readBranchOptions,
  sidebarBranches,
  suggestHidePatterns,
  visibleRemoteRefs
} from '../src/renderer/src/sidebar/sidebarBranches.ts'
import type { Branch } from '../src/shared/types.ts'

const branch = (name: string, date: number, gone = false, type: Branch['type'] = 'local'): Branch => ({
  name,
  date,
  gone,
  type,
  fullName: `refs/${type}/${name}`,
  hash: name,
  upstream: gone ? 'origin/deleted' : null,
  ahead: 0,
  behind: 0,
  current: false,
  subject: ''
})

test('sidebar sorting uses latest commit date with stable name ties without mutating shared refs', () => {
  const branches = [branch('z', 30), branch('b', 10), branch('a', 10)]
  assert.deepEqual(
    sidebarBranches(branches, null, DEFAULT_BRANCH_OPTIONS).map((b) => b.name),
    ['a', 'b', 'z']
  )
  assert.deepEqual(
    sidebarBranches(branches, null, { ...DEFAULT_BRANCH_OPTIONS, sort: 'latest' }).map((b) => b.name),
    ['z', 'a', 'b']
  )
  assert.deepEqual(
    branches.map((b) => b.name),
    ['z', 'b', 'a']
  )
})

test('hiding gone upstreams preserves current, untracked local and remote branches and is reversible', () => {
  const branches = [
    branch('active', 1, true),
    branch('deleted', 2, true),
    branch('local-only', 3),
    branch('origin/topic', 4, false, 'remote')
  ]
  const visible = sidebarBranches(branches, 'active', { ...DEFAULT_BRANCH_OPTIONS, hideGone: true })
  assert.deepEqual(
    visible.map((b) => b.name),
    ['active', 'local-only', 'origin/topic']
  )
  assert.equal(sidebarBranches(branches, 'active', DEFAULT_BRANCH_OPTIONS).length, 4)
  assert.equal(sidebarBranches(branches, null, { ...DEFAULT_BRANCH_OPTIONS, hideGone: true }).length, 2)
})

test('hidden patterns hide matching local and remote branches, keep the current branch and can be revealed', () => {
  const branches = [
    branch('main', 1),
    branch('gh-pages', 2),
    branch('dependabot/npm/x', 3),
    branch('origin/dependabot/npm/x', 4, false, 'remote'),
    branch('origin/dependabot-notes', 5, false, 'remote'),
    branch('origin/gh-pages', 6, false, 'remote')
  ]
  const options = { ...DEFAULT_BRANCH_OPTIONS, hiddenPatterns: ['dependabot/*', 'gh-pages'] }
  assert.deepEqual(
    sidebarBranches(branches, 'main', options).map((b) => b.name),
    ['main', 'origin/dependabot-notes']
  )
  assert.equal(
    sidebarBranches(branches, 'gh-pages', options).some((b) => b.name === 'gh-pages'),
    true
  )
  assert.equal(sidebarBranches(branches, 'main', { ...options, showHidden: true }).length, 6)
  assert.deepEqual(suggestHidePatterns(branches[3]), { exact: 'dependabot/npm/x', folder: 'dependabot/*' })
  assert.deepEqual(suggestHidePatterns(branches[1]), { exact: 'gh-pages', folder: null })
  assert.equal(hiddenBranchCount(branches, 'main', options.hiddenPatterns), 4)
  assert.deepEqual(hiddenRefGlobs(branches, options), [
    'refs/heads/dependabot/*',
    'refs/remotes/origin/dependabot/*',
    'refs/heads/gh-pages',
    'refs/remotes/origin/gh-pages'
  ])
  assert.deepEqual(hiddenRefGlobs(branches, { ...options, showHidden: true }), [])
})

test('a pattern that matches the checked-out branch becomes the individual refs it hides', () => {
  const branches = [
    { ...branch('wip/mine', 1), current: true },
    branch('wip/other', 2),
    branch('origin/wip/other', 3, false, 'remote'),
    branch('main', 4)
  ]
  const options = { ...DEFAULT_BRANCH_OPTIONS, hiddenPatterns: ['wip/*', 'main'] }
  assert.deepEqual(hiddenRefGlobs(branches, options), [
    'refs/local/wip/other',
    'refs/remote/origin/wip/other',
    'refs/heads/main',
    'refs/remotes/origin/main'
  ])
})

test('saved sidebar options recover safely from missing, invalid or obsolete values', () => {
  for (const saved of [null, 'null', 'broken', '{}', '{"sort":"unknown","hideGone":"true","hiddenPatterns":"x"}']) {
    assert.deepEqual(readBranchOptions(saved), DEFAULT_BRANCH_OPTIONS)
  }
  // The reveal toggle is session-only, so a saved value never turns it on.
  assert.deepEqual(readBranchOptions('{"sort":"latest","hideGone":true,"hiddenPatterns":["a/*",3,""],"showHidden":true}'), {
    sort: 'latest',
    hideGone: true,
    hiddenPatterns: ['a/*'],
    hideRemoteOnly: false,
    showHidden: false
  })
})

test('hiding remote-only branches keeps tracked, same-named and default remote branches, and the reveal shows all', () => {
  const mine = { ...branch('feature-x', 1), upstream: 'origin/tracked' }
  const branches = [
    { ...branch('main', 1), current: true },
    mine,
    branch('origin/main', 1, false, 'remote'),
    branch('origin/tracked', 1, false, 'remote'),
    branch('origin/main-copy', 1, false, 'remote'),
    branch('origin/feature-x', 1, false, 'remote'),
    branch('origin/teammate/wip', 1, false, 'remote'),
    branch('origin/dependabot/x', 1, false, 'remote')
  ]
  const options = { ...DEFAULT_BRANCH_OPTIONS, hideRemoteOnly: true, hiddenPatterns: ['dependabot/*'] }
  const hidden = hiddenBranchRefs(branches, 'main', options, 'origin/main-copy')
  assert.deepEqual([...hidden].sort(), ['refs/remote/origin/dependabot/x', 'refs/remote/origin/teammate/wip'])
  assert.deepEqual(visibleRemoteRefs(branches, options, 'origin/main-copy'), [
    'refs/remote/origin/main',
    'refs/remote/origin/tracked',
    'refs/remote/origin/main-copy',
    'refs/remote/origin/feature-x'
  ])
  assert.equal(visibleRemoteRefs(branches, { ...options, showHidden: true }, null), null)
  assert.equal(visibleRemoteRefs(branches, { ...options, hideRemoteOnly: false }, null), null)
  assert.equal(sidebarBranches(branches, 'main', { ...options, showHidden: true }, null).length, branches.length)
  assert.equal(sidebarBranches(branches, 'main', options, 'origin/main-copy').length, branches.length - 2)
  assert.equal(readBranchOptions('{"hideRemoteOnly":true}').hideRemoteOnly, true)
})
