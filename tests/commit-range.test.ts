import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commitsBetween } from '../src/renderer/src/history/commitRange.ts'

const list = ['a', 'b', 'c', 'd', 'e']

test('a range runs between its ends in list order, whichever end was chosen first', () => {
  assert.deepEqual(commitsBetween(list, 'b', 'd'), ['b', 'c', 'd'])
  assert.deepEqual(commitsBetween(list, 'd', 'b'), ['b', 'c', 'd'])
})

test('one commit, or a commit the list does not hold, is not a range', () => {
  assert.equal(commitsBetween(list, 'c', 'c'), null)
  assert.equal(commitsBetween(list, 'c', 'z'), null)
  assert.equal(commitsBetween(list, 'z', 'c'), null)
})
