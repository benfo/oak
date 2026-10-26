import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findScrollDelta } from '../src/shared/findScroll.ts'

test('match reveal moves only far enough to expose text beside a sticky gutter', () => {
  assert.equal(findScrollDelta(100, 500, 200, 260), 0)
  assert.equal(findScrollDelta(100, 500, 1000, 1060), 560)
  assert.equal(findScrollDelta(100, 500, 20, 80), -80)
  assert.equal(findScrollDelta(100, 500, 80, 700), -20)
  assert.equal(findScrollDelta(100, 500, 450, 500.2), 1)
  assert.equal(findScrollDelta(100, 500, 99.8, 130), -1)
  assert.equal(findScrollDelta(100, 100, 200, 260), 0)
})

test('match reveal keeps breathing room at both edges without hiding wide matches', () => {
  assert.equal(findScrollDelta(100, 500, 200, 260, 16), 0)
  assert.equal(findScrollDelta(100, 500, 1000, 1060, 16), 576)
  assert.equal(findScrollDelta(100, 500, 20, 80, 16), -96)
  assert.equal(findScrollDelta(100, 500, 110, 130, 16), -6)
  assert.equal(findScrollDelta(100, 500, 450, 490, 16), 6)
  assert.equal(findScrollDelta(100, 500, 100, 490, 16), -5)
  assert.equal(findScrollDelta(100, 500, 80, 700, 16), -20)
})
