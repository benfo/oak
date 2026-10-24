import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextMatchIndex } from '../src/renderer/src/lib/searchMatches.ts'

test('search stops at either boundary instead of selecting an earlier/later wrapped match', () => {
  const matches = [2, 8, 11]
  assert.equal(nextMatchIndex(matches, 11, false), null)
  assert.equal(nextMatchIndex(matches, 2, true), null)
  assert.equal(nextMatchIndex(matches, 4, false), 8)
  assert.equal(nextMatchIndex(matches, 4, true), 2)
  assert.equal(nextMatchIndex(matches, 20, false), null)
  assert.equal(nextMatchIndex(matches, 0, true), null)
})

test('empty, single and fresh reverse searches keep their distinct meanings', () => {
  assert.equal(nextMatchIndex([], -1, false), null)
  assert.equal(nextMatchIndex([], -1, true), null)
  assert.equal(nextMatchIndex([3], 3, false), null)
  assert.equal(nextMatchIndex([3], 3, true), null)
  assert.equal(nextMatchIndex([2, 8, 11], -1, false), 2)
  assert.equal(nextMatchIndex([2, 8, 11], -1, true), 11)
})
