import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN_LAYOUT_WIDTH, zoomThatFits } from '../src/renderer/src/lib/layoutMinimums.ts'

test('a window wide enough for the panes allows the zoom that was asked for', () => {
  assert.equal(zoomThatFits(1.5, 1600, 1), 1.5)
  assert.equal(zoomThatFits(0.8, 960, 1), 0.8)
})

test('a small window holds the zoom back so the panes keep their minimums', () => {
  const zoom = zoomThatFits(1.5, 960, 1)
  assert.ok(zoom < 1.5)
  assert.ok(960 / zoom >= MIN_LAYOUT_WIDTH - 0.001)
})

test('the limit comes from the window, not from the zoom already applied', () => {
  // A 960 px window seen at 1.5x shows 640 px, and the same window at 1x shows 960 px: same answer.
  assert.equal(zoomThatFits(1.5, 640, 1.5), zoomThatFits(1.5, 960, 1))
})
