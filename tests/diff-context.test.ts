import test from 'node:test'
import assert from 'node:assert/strict'
import { FULL_CONTEXT, lessContext, moreContext } from '../src/renderer/src/lib/diffContext.ts'

test('more context steps up and ends at the whole file', () => {
  assert.equal(moreContext(3), 6)
  assert.equal(moreContext(5), 6)
  assert.equal(moreContext(100), FULL_CONTEXT)
  assert.equal(moreContext(FULL_CONTEXT), FULL_CONTEXT)
})

test('less context steps down, from the whole file to the largest step', () => {
  assert.equal(lessContext(FULL_CONTEXT), 100)
  assert.equal(lessContext(12), 6)
  assert.equal(lessContext(7), 6)
  assert.equal(lessContext(3), 3)
  assert.equal(lessContext(1), 1)
})
