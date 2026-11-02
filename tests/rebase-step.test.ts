import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRebaseStep } from '../src/shared/rebaseStep.ts'

test('a rebase step reads git progress files, ignoring trailing newlines', () => {
  assert.deepEqual(parseRebaseStep('2\n', '5\n'), { current: 2, total: 5 })
  assert.deepEqual(parseRebaseStep('1', '1'), { current: 1, total: 1 })
})

test('missing, empty or impossible progress is not a step', () => {
  assert.equal(parseRebaseStep(null, '5'), null)
  assert.equal(parseRebaseStep('2', null), null)
  assert.equal(parseRebaseStep('', '5'), null)
  assert.equal(parseRebaseStep('x', '5'), null)
  assert.equal(parseRebaseStep('0', '5'), null)
  assert.equal(parseRebaseStep('6', '5'), null)
})
