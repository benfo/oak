import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyRepoChange } from '../src/shared/watchPaths.ts'

test('only files that can change refs trigger a refs refresh', () => {
  for (const f of [
    '.git/HEAD',
    '.git/packed-refs',
    '.git/config',
    '.git/refs/heads/main',
    '.git/refs/stash',
    '.git/refs/remotes/origin/x',
    '.git/reftable/tables.list'
  ])
    assert.equal(classifyRepoChange(f), 'refs', f)
})

test('staging and status bookkeeping only refresh file status', () => {
  for (const f of ['.git/index', '.git/MERGE_HEAD', '.git/rebase-merge/done', '.git/COMMIT_EDITMSG', 'src/app.ts', 'a/b.txt'])
    assert.equal(classifyRepoChange(f), 'files', f)
})

test('object storage, reflogs, lock files and node_modules are ignored', () => {
  for (const f of ['.git/objects/ab/cdef', '.git/logs/HEAD', '.git/index.lock', '.git/refs/heads/main.lock', 'web/node_modules/x/y.js'])
    assert.equal(classifyRepoChange(f), 'ignore', f)
})
