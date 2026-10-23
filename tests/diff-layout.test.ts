import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_SPLIT_WIDTH, resolveDiffLayout, toggleDiffLayout } from '../src/renderer/src/lib/diffLayout.ts'

test('automatic responds to the available diff pane width', () => {
  assert.equal(resolveDiffLayout('auto', 0), 'unified')
  assert.equal(resolveDiffLayout('auto', AUTO_SPLIT_WIDTH - 1), 'unified')
  assert.equal(resolveDiffLayout('auto', AUTO_SPLIT_WIDTH), 'split')
  assert.equal(resolveDiffLayout('auto', AUTO_SPLIT_WIDTH + 1), 'split')
})

test('explicit layouts remain fixed when the pane changes size', () => {
  for (const width of [0, 320, 899, 900, 1600]) {
    assert.equal(resolveDiffLayout('unified', width), 'unified')
    assert.equal(resolveDiffLayout('split', width), 'split')
  }
})

test('toggle exits Automatic to the opposite visible layout and then alternates fixed layouts', () => {
  for (const width of [320, AUTO_SPLIT_WIDTH - 1, AUTO_SPLIT_WIDTH, 1600]) {
    const opposite = resolveDiffLayout('auto', width) === 'split' ? 'unified' : 'split'
    assert.equal(toggleDiffLayout('auto', width), opposite)
    assert.equal(toggleDiffLayout('split', width), 'unified')
    assert.equal(toggleDiffLayout('unified', width), 'split')
  }
})
