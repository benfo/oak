import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { git } from '../src/main/git.ts'

test('fast Git probes do not write to a closed input pipe', async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => git(tmpdir(), ['--version'])))
  assert.ok(results.every((result) => result.startsWith('git version ')))
})

test('Git may close supplied input early without losing its result or diagnostic', async () => {
  const input = 'x'.repeat(4 * 1024 * 1024)
  assert.match(await git(tmpdir(), ['--version'], { input }), /^git version /)
  await assert.rejects(git(tmpdir(), ['oak-invalid-command'], { input }), /not a git command/)
})

test('Git still receives complete input for patch and object operations', async () => {
  const input = 'export const amount = 100\n'.repeat(10000)
  const bytes = Buffer.from(input)
  const expected = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
  assert.equal((await git(tmpdir(), ['hash-object', '--stdin'], { input })).trim(), expected)
})
