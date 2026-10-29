import { test } from 'node:test'
import assert from 'node:assert/strict'
import { followedPosition, samePosition } from '../src/renderer/src/diff/followScroll.ts'

const scroller = (scrollWidth: number, clientWidth: number, scrollHeight = 1000, clientHeight = 500) => ({
  scrollLeft: 0,
  scrollTop: 0,
  scrollWidth,
  clientWidth,
  scrollHeight,
  clientHeight
})

test('the other side takes the same offsets', () => {
  assert.deepEqual(followedPosition({ scrollLeft: 120, scrollTop: 40 }, scroller(900, 300)), { left: 120, top: 40 })
})

test('a narrower side stops at its own end instead of going past it', () => {
  assert.deepEqual(followedPosition({ scrollLeft: 400, scrollTop: 0 }, scroller(500, 300)), { left: 200, top: 0 })
})

test('a side with nothing to scroll stays put', () => {
  assert.deepEqual(followedPosition({ scrollLeft: 400, scrollTop: 90 }, scroller(300, 300, 400, 500)), { left: 0, top: 0 })
})

test('offsets within a pixel count as the same position', () => {
  assert.equal(samePosition(12.4999, 12.5), true)
  assert.equal(samePosition(12, 14), false)
})
