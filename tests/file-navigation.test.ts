import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileNavigationDirection } from '../src/renderer/src/lib/navigation.ts'

test('file browsing accepts Alt+PageUp/PageDown/Home/End and leaves other navigation alone', () => {
  const input = { key: 'PageDown', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false }
  assert.equal(fileNavigationDirection(input), 1)
  assert.equal(fileNavigationDirection({ ...input, key: 'PageUp' }), -1)
  assert.equal(fileNavigationDirection({ ...input, key: 'Home' }), 'first')
  assert.equal(fileNavigationDirection({ ...input, key: 'End' }), 'last')
  for (const override of [
    { altKey: false },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { isComposing: true },
    { key: 'ArrowUp' },
    { key: 'ArrowDown' },
    { key: 'n' },
    { key: 'p' }
  ]) {
    for (const key of ['PageUp', 'PageDown', 'Home', 'End'])
      assert.equal(fileNavigationDirection({ ...input, key, ...override }), undefined)
  }
})
