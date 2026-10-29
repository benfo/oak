import test from 'node:test'
import assert from 'node:assert/strict'
import { decideRemotePage, isBranchNotOnRemote, isNewFileNotOnRemote, type RemoteFacts } from '../src/shared/remote/index.ts'

/** A repository whose remote has `pushed` commits (and the objects listed), answering the rules' questions without git. */
function repository(
  options: {
    pushed?: string[]
    base?: string | null
    objects?: Record<string, string>
    localEdits?: boolean
    remoteBranches?: string[]
  } = {}
): RemoteFacts {
  const { pushed = [], base = null, objects = {}, localEdits = false, remoteBranches = [] } = options
  return {
    isOnRemote: async (hash) => pushed.includes(hash),
    newestPushedAncestor: async () => base,
    objectAt: async (hash, path) => objects[`${hash}:${path}`] ?? null,
    hasLocalEdits: async () => localEdits,
    hasRemoteBranch: async (name) => remoteBranches.includes(name)
  }
}

const decide = (target: Parameters<typeof decideRemotePage>[0], facts: RemoteFacts, workingCopy = false) =>
  decideRemotePage(target, 'origin', workingCopy, facts)

test('the repository page always opens', async () => {
  assert.deepEqual(await decide({ kind: 'repo' }, repository()), { ok: true, target: { kind: 'repo' } })
})

test('a branch opens only when the remote has it', async () => {
  const target = { kind: 'branch' as const, name: 'feature' }
  assert.deepEqual(await decide(target, repository({ remoteBranches: ['feature'] })), { ok: true, target })
  assert.deepEqual(await decide(target, repository()), { ok: false, error: "feature isn't on origin yet." })
})

test('a commit opens only when a remote branch contains it', async () => {
  const target = { kind: 'commit' as const, hash: 'abc' }
  assert.deepEqual(await decide(target, repository({ pushed: ['abc'] })), { ok: true, target })
  const refused = await decide(target, repository({ base: 'old', objects: { 'old:a.ts': 'x' } }))
  assert.deepEqual(refused, { ok: false, error: "This commit isn't on origin yet, so it has no page." })
})

test('a file in a pushed commit opens as it is, line included', async () => {
  const target = { kind: 'file' as const, hash: 'abc', path: 'a.ts', line: 7 }
  assert.deepEqual(await decide(target, repository({ pushed: ['abc'] })), { ok: true, target })
})

test('a file edited since the last push links at the pushed commit, without a line', async () => {
  const facts = repository({ base: 'old', objects: { 'old:a.ts': 'v1', 'new:a.ts': 'v2' } })
  assert.deepEqual(await decide({ kind: 'file', hash: 'new', path: 'a.ts' }, facts), {
    ok: true,
    target: { kind: 'file', hash: 'old', path: 'a.ts' }
  })
})

test('a line link needs the pushed version to equal the one shown', async () => {
  const unchanged = repository({ base: 'old', objects: { 'old:a.ts': 'v1', 'new:a.ts': 'v1' } })
  const target = { kind: 'file' as const, hash: 'new', path: 'a.ts', line: 7 }
  assert.deepEqual(await decide(target, unchanged), { ok: true, target: { ...target, hash: 'old' } })

  const edited = repository({ base: 'old', objects: { 'old:a.ts': 'v1', 'new:a.ts': 'v2' } })
  const refused = await decide(target, edited)
  assert.equal(refused.ok, false)
  assert.match(refused.ok ? '' : refused.error, /a line link could point at different code/)
})

test('a working copy with local edits never gets a line link, even if its commit matches the pushed one', async () => {
  const facts = repository({ base: 'old', localEdits: true, objects: { 'old:a.ts': 'v1', 'new:a.ts': 'v1' } })
  const target = { kind: 'file' as const, hash: 'new', path: 'a.ts', line: 7 }
  assert.equal((await decide(target, facts, true)).ok, false)
  assert.equal((await decide(target, facts, false)).ok, true)
})

test('a file the remote has never seen has no page', async () => {
  const added = { kind: 'file' as const, hash: 'new', path: 'b.ts' }
  const expected = { ok: false, error: "b.ts isn't on origin yet, so it has no page." }
  assert.deepEqual(await decide(added, repository({ base: 'old', objects: { 'new:b.ts': 'v1' } })), expected)
  assert.deepEqual(await decide(added, repository({ base: null, objects: { 'new:b.ts': 'v1' } })), expected)
})

test('new files have no page until their commit is pushed, and working files never do', () => {
  assert.equal(isNewFileNotOnRemote('A', { working: false, commitUnpushed: true }), true)
  assert.equal(isNewFileNotOnRemote('A', { working: false, commitUnpushed: false }), false)
  assert.equal(isNewFileNotOnRemote('?', { working: true, commitUnpushed: false }), true)
  assert.equal(isNewFileNotOnRemote('M', { working: true, commitUnpushed: true }), false)
})

test('a local branch needs a live upstream; remote branches and tags are never "not on the remote"', () => {
  assert.equal(isBranchNotOnRemote({ type: 'local', upstream: null, gone: false }), true)
  assert.equal(isBranchNotOnRemote({ type: 'local', upstream: 'origin/x', gone: true }), true)
  assert.equal(isBranchNotOnRemote({ type: 'local', upstream: 'origin/x', gone: false }), false)
  assert.equal(isBranchNotOnRemote({ type: 'remote', upstream: null, gone: false }), false)
})
