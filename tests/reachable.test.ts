import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isReachable } from '../src/main/reachable.ts'

const run = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim()

function repoWithWip() {
  const dir = mkdtempSync(join(tmpdir(), 'oak-reach-'))
  run(dir, 'init', '-q')
  run(dir, 'commit', '-q', '--allow-empty', '-m', 'base')
  writeFileSync(join(dir, 'f.txt'), 'x')
  run(dir, 'add', 'f.txt')
  run(dir, 'commit', '-q', '-m', 'WIP')
  return { dir, wip: run(dir, 'rev-parse', 'HEAD') }
}

test('a commit on the checked-out branch is reachable', async () => {
  const { dir, wip } = repoWithWip()
  assert.equal(await isReachable(dir, wip), true)
})

test('a commit left behind by a reset is not', async () => {
  const { dir, wip } = repoWithWip()
  run(dir, 'reset', '-q', 'HEAD~1')
  assert.equal(await isReachable(dir, wip), false)
})

test('a commit kept alive by another branch is still reachable', async () => {
  const { dir, wip } = repoWithWip()
  run(dir, 'branch', 'keep')
  run(dir, 'reset', '-q', '--hard', 'HEAD~1')
  assert.equal(await isReachable(dir, wip), true)
})

test('an unknown hash is not reachable', async () => {
  const { dir } = repoWithWip()
  assert.equal(await isReachable(dir, '0'.repeat(40)), false)
})
