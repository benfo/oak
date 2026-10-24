import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BRANCH_OPTIONS, readBranchOptions, sidebarBranches } from '../src/renderer/src/sidebar/sidebarBranches.ts'
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
    sidebarBranches(branches, null, { sort: 'latest', hideGone: false }).map((b) => b.name),
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
  const visible = sidebarBranches(branches, 'active', { sort: 'name', hideGone: true })
  assert.deepEqual(
    visible.map((b) => b.name),
    ['active', 'local-only', 'origin/topic']
  )
  assert.equal(sidebarBranches(branches, 'active', DEFAULT_BRANCH_OPTIONS).length, 4)
  assert.equal(sidebarBranches(branches, null, { sort: 'name', hideGone: true }).length, 2)
})

test('saved sidebar options recover safely from missing, invalid or obsolete values', () => {
  for (const saved of [null, 'null', 'broken', '{}', '{"sort":"unknown","hideGone":"true"}']) {
    assert.deepEqual(readBranchOptions(saved), DEFAULT_BRANCH_OPTIONS)
  }
  assert.deepEqual(readBranchOptions('{"sort":"latest","hideGone":true}'), { sort: 'latest', hideGone: true })
})
