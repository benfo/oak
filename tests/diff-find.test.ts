import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diffFindLine } from '../src/shared/diffFind.ts'

test('diff line jumps use source numbers, prefer After and report gaps', () => {
  const lines = [
    { oldNo: 4, newNo: 4 },
    { oldNo: 5, newNo: null },
    { oldNo: null, newNo: 5 },
    { oldNo: 60, newNo: 60 }
  ]
  assert.deepEqual(diffFindLine(lines, ':5'), { row: 2, label: '5' })
  assert.deepEqual(diffFindLine(lines, ':60'), { row: 3, label: '60' })
  assert.equal(diffFindLine(lines, ':20'), null)
  assert.equal(diffFindLine(lines, ':999'), null)
  assert.equal(diffFindLine(lines, ':bad'), null)
})

test('deleted files use Before line numbers', () => {
  assert.deepEqual(diffFindLine([{ oldNo: 7, newNo: null }], ':7'), { row: 0, label: '7 (Before)' })
  assert.equal(diffFindLine([], ':7'), null)
})
