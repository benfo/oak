import test from 'node:test'
import assert from 'node:assert/strict'
import { commitFlags, isWipSubject, NO_COMMIT_OPTIONS, WIP_OPTIONS } from '../src/shared/commitOptions.ts'

test('no options add no flags', () => {
  assert.deepEqual(commitFlags(NO_COMMIT_OPTIONS), [])
})

test('each option maps to its git flag', () => {
  assert.deepEqual(commitFlags({ noVerify: true, signoff: true, sign: 'sign', allowEmpty: true }), [
    '--no-verify',
    '--signoff',
    '--gpg-sign',
    '--allow-empty'
  ])
  assert.deepEqual(commitFlags({ ...NO_COMMIT_OPTIONS, sign: 'skip' }), ['--no-gpg-sign'])
})

test('a WIP commit skips hooks and signing', () => {
  assert.deepEqual(commitFlags(WIP_OPTIONS), ['--no-verify', '--no-gpg-sign'])
})

test('WIP subjects are recognised, other subjects are not', () => {
  for (const s of ['WIP', 'wip: half done', 'WIP on login ']) assert.equal(isWipSubject(s), true, s)
  for (const s of ['Wipe the cache', 'Add WIP badge', '']) assert.equal(isWipSubject(s), false, s)
})
