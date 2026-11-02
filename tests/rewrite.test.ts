import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readMessages, runRewrite, restoreBeforeRewrite } from '../src/main/rewrite.ts'
import { combinedMessage, isReadyToRewrite, planRewrite, type RewriteMode } from '../src/shared/rewrite.ts'
import type { Commit } from '../src/shared/types.ts'
import { manyCommits } from '../tests-ui/repos.ts'

const run = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim()

/** The rewrite commits through the real git, so a repo needs an identity even where none is configured (CI runners). */
const identify = (dir: string) => {
  run(dir, 'config', 'user.name', 't')
  run(dir, 'config', 'user.email', 't@t')
}

/** A repo whose commits c1..cN each add one file, so every commit has distinct content. */
function repo(count: number) {
  const dir = mkdtempSync(join(tmpdir(), 'oak-rewrite-'))
  run(dir, 'init', '-q', '-b', 'main')
  identify(dir)
  const hashes: string[] = []
  for (let i = 1; i <= count; i++) {
    writeFileSync(join(dir, `f${i}.txt`), `${i}`)
    run(dir, 'add', '.')
    run(dir, 'commit', '-q', '-m', `c${i}`)
    hashes.push(run(dir, 'rev-parse', 'HEAD'))
  }
  return { dir, hashes }
}

function history(dir: string): Commit[] {
  return run(dir, 'log', '--format=%H %P')
    .split('\n')
    .map((line) => {
      const [hash, ...parents] = line.split(' ')
      return { hash, parents, author: '', email: '', date: 0, subject: '', refs: [] }
    })
}

const subjects = (dir: string) => run(dir, 'log', '--format=%s').split('\n')

function plan(dir: string, selection: string[], mode: RewriteMode = 'fixup', clean = true) {
  return planRewrite({ commits: history(dir), selection, mode, head: run(dir, 'rev-parse', 'HEAD'), clean })
}

test('one commit is combined with the one before it, and later commits are replayed', () => {
  const { dir, hashes } = repo(4)
  const check = plan(dir, [hashes[2]])
  assert.ok(check.ok)
  assert.equal(check.plan.base, hashes[0])
  assert.deepEqual(check.plan.combined, [hashes[1], hashes[2]])
  assert.deepEqual(check.plan.todo, [`pick ${hashes[1]}`, `fixup ${hashes[2]}`, `pick ${hashes[3]}`])
})

test('a range is combined into its oldest commit whatever order it was selected in', () => {
  const { dir, hashes } = repo(5)
  const check = plan(dir, [hashes[3], hashes[1], hashes[2]], 'squash')
  assert.ok(check.ok)
  assert.deepEqual(check.plan.combined, [hashes[1], hashes[2], hashes[3]])
  assert.deepEqual(check.plan.todo.slice(0, 3), [`pick ${hashes[1]}`, `fixup ${hashes[2]}`, `fixup ${hashes[3]}`])
  assert.match(check.plan.todo[3], /^exec git commit --amend/)
  assert.equal(check.plan.todo[4], `pick ${hashes[4]}`)
})

test('a range that starts at the root commit rebases with no base', () => {
  const { dir, hashes } = repo(3)
  const check = plan(dir, [hashes[0], hashes[1]])
  assert.ok(check.ok)
  assert.equal(check.plan.base, null)
})

test('refuses what it cannot rewrite safely, saying why', () => {
  const { dir, hashes } = repo(4)
  const reason = (selection: string[], clean = true) => {
    const check = plan(dir, selection, 'fixup', clean)
    return check.ok ? null : check.reason
  }
  assert.equal(reason([]), 'no commit selected')
  assert.equal(reason([hashes[2]], false), 'commit or stash your changes first')
  assert.equal(reason([hashes[0]]), 'there is no previous commit')
  assert.equal(reason([hashes[1], hashes[3]]), 'select a continuous run of commits')
  assert.equal(reason(['f'.repeat(40)]), 'select commits on the checked-out branch')
})

test('refuses when a merge commit is between the selection and HEAD', () => {
  const { dir, hashes } = repo(3)
  run(dir, 'checkout', '-q', '-b', 'side', hashes[0])
  writeFileSync(join(dir, 'side.txt'), 's')
  run(dir, 'add', '.')
  run(dir, 'commit', '-q', '-m', 'side')
  run(dir, 'checkout', '-q', 'main')
  run(dir, 'merge', '-q', '--no-ff', '-m', 'merge', 'side')
  writeFileSync(join(dir, 'after.txt'), 'a')
  run(dir, 'add', '.')
  run(dir, 'commit', '-q', '-m', 'after')
  const check = plan(dir, [hashes[2]])
  assert.deepEqual(check, { ok: false, reason: 'history contains a merge commit' })
  const above = plan(dir, [run(dir, 'rev-parse', 'HEAD')])
  assert.ok(!above.ok)
})

test('fixup folds a middle commit into its parent and keeps the files and later commits', async () => {
  const { dir, hashes } = repo(4)
  const check = plan(dir, [hashes[2]])
  assert.ok(check.ok)
  const result = await runRewrite(dir, check.plan, '')
  assert.equal(result.oldHead, hashes[3])
  assert.deepEqual(subjects(dir), ['c4', 'c2', 'c1'])
  for (const i of [1, 2, 3, 4]) assert.equal(readFileSync(join(dir, `f${i}.txt`), 'utf8'), `${i}`)
  assert.equal(run(dir, 'status', '--porcelain'), '')
})

test('squash uses the message the user wrote, quotes and shell characters included', async () => {
  const { dir, hashes } = repo(4)
  const check = plan(dir, [hashes[1], hashes[2]], 'squash')
  assert.ok(check.ok)
  await runRewrite(dir, check.plan, 'Combined\n\n- two\n- three "quoted" $HOME `x`')
  assert.deepEqual(subjects(dir), ['c4', 'Combined', 'c1'])
  assert.equal(run(dir, 'log', '-1', '--format=%B', 'HEAD~1'), 'Combined\n\n- two\n- three "quoted" $HOME `x`')
  for (const i of [1, 2, 3, 4]) assert.equal(readFileSync(join(dir, `f${i}.txt`), 'utf8'), `${i}`)
})

test('squashing from the root commit works', async () => {
  const { dir, hashes } = repo(3)
  const check = plan(dir, [hashes[0], hashes[1]], 'squash')
  assert.ok(check.ok)
  await runRewrite(dir, check.plan, 'First two')
  assert.deepEqual(subjects(dir), ['c3', 'First two'])
})

test('refuses to run when the branch moved or tracked files changed since the plan', async () => {
  const { dir, hashes } = repo(3)
  const check = plan(dir, [hashes[1]])
  assert.ok(check.ok)
  writeFileSync(join(dir, 'f1.txt'), 'changed')
  await assert.rejects(runRewrite(dir, check.plan, ''), /Commit or stash/)
  run(dir, 'checkout', '-q', '--', 'f1.txt')
  run(dir, 'commit', '-q', '--allow-empty', '-m', 'moved')
  await assert.rejects(runRewrite(dir, check.plan, ''), /branch changed/)
})

test('undo restores the branch tip, but only while it is still the rewrite result', async () => {
  const { dir, hashes } = repo(3)
  const check = plan(dir, [hashes[2]])
  assert.ok(check.ok)
  const result = await runRewrite(dir, check.plan, '')
  assert.notEqual(run(dir, 'rev-parse', 'HEAD'), hashes[2])
  await restoreBeforeRewrite(dir, result)
  assert.equal(run(dir, 'rev-parse', 'HEAD'), hashes[2])
  assert.deepEqual(subjects(dir), ['c3', 'c2', 'c1'])

  const second = plan(dir, [hashes[2]])
  assert.ok(second.ok)
  const again = await runRewrite(dir, second.plan, '')
  run(dir, 'commit', '-q', '--allow-empty', '-m', 'later')
  await assert.rejects(restoreBeforeRewrite(dir, again), /no longer be undone/)
})

test('refuses a plan whose commits are not what git has, such as one made from a filtered list', async () => {
  const { dir, hashes } = repo(4)
  const check = plan(dir, [hashes[2]])
  assert.ok(check.ok)
  await assert.rejects(runRewrite(dir, { ...check.plan, affected: [hashes[1], hashes[3]] }, ''), /branch changed/)
  assert.equal(run(dir, 'rev-parse', 'HEAD'), hashes[3])
})

test('ready to rewrite means no staged, conflicted or modified tracked files and no operation underway', () => {
  const base = { state: 'clean' as const, staged: [], unstaged: [], conflicted: [] }
  assert.equal(isReadyToRewrite(base), true)
  assert.equal(isReadyToRewrite({ ...base, unstaged: [{ path: 'new.txt', status: '?' }] }), true)
  assert.equal(isReadyToRewrite({ ...base, unstaged: [{ path: 'a', status: 'M' }] }), false)
  assert.equal(isReadyToRewrite({ ...base, staged: [{ path: 'a', status: 'A' }] }), false)
  assert.equal(isReadyToRewrite({ ...base, state: 'rebasing' }), false)
  assert.equal(isReadyToRewrite(null), false)
})

test('the combined message joins the commit messages oldest first', () => {
  assert.equal(combinedMessage(['one\n', ' two ', '', 'three']), 'one\n\ntwo\n\nthree')
})

test('a long history rewrites fine, though its todo is larger than an environment variable may be', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oak-rewrite-long-'))
  manyCommits(dir, 800)
  identify(dir)
  const all = history(dir)
  const oldest = all[all.length - 1].hash
  const check = planRewrite({ commits: all, selection: [all[all.length - 2].hash], mode: 'squash', head: all[0].hash, clean: true })
  assert.ok(check.ok)
  assert.ok(check.plan.todo.join('\n').length > 32767)
  const long = 'x'.repeat(40000)
  await runRewrite(dir, check.plan, `Combined\n\n${long}`)
  assert.equal(run(dir, 'rev-list', '--count', 'HEAD'), '799')
  assert.equal(run(dir, 'log', '-1', '--format=%s', `HEAD~798`), 'Combined')
  assert.equal(oldest.length, 40)
})

test('reads the full messages of thousands of commits, in the order asked, without a long command line', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oak-messages-'))
  manyCommits(dir, 3000)
  const all = history(dir).map((c) => c.hash)
  const messages = await readMessages(dir, all)
  assert.equal(messages.length, 3000)
  assert.equal(messages[0], 'Commit number 3000')
  assert.equal(messages[2999], 'Commit number 1')
  assert.deepEqual(await readMessages(dir, [all[5], all[1]]), ['Commit number 2995', 'Commit number 2999'])
})

test('refuses in a file history, where the listed commits are not a chain', () => {
  const { dir, hashes } = repo(3)
  const check = planRewrite({ commits: history(dir), selection: [hashes[2]], mode: 'fixup', head: hashes[2], clean: true, filtered: true })
  assert.deepEqual(check, { ok: false, reason: 'not available in a file’s history' })
})
