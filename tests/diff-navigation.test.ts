import { test } from 'node:test'
import assert from 'node:assert/strict'
import { horizontalScrollDirection } from '../src/renderer/src/lib/navigation.ts'

const plain = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false }

test('horizontal scrolling leaves navigation and vertical line selection intact', () => {
  for (const vim of [false, true]) {
    for (const key of ['ArrowLeft', 'ArrowRight', 'h', 'l']) assert.equal(horizontalScrollDirection({ ...plain, key }, vim), 0)
    for (const key of ['ArrowUp', 'ArrowDown']) assert.equal(horizontalScrollDirection({ ...plain, key, shiftKey: true }, vim), 0)
    assert.equal(horizontalScrollDirection({ ...plain, key: 'ArrowLeft', shiftKey: true }, vim), -1)
    assert.equal(horizontalScrollDirection({ ...plain, key: 'ArrowRight', shiftKey: true }, vim), 1)
  }
})

test('Shift H/L require Vim and leave modified shortcuts and composition untouched', () => {
  for (const [key, direction] of [['H', -1], ['L', 1]] as const) {
    assert.equal(horizontalScrollDirection({ ...plain, key, shiftKey: true }, false), 0)
    assert.equal(horizontalScrollDirection({ ...plain, key, shiftKey: true }, true), direction)
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
    for (const key of ['H', 'L', 'ArrowLeft', 'ArrowRight']) {
      assert.equal(horizontalScrollDirection({ ...plain, key, shiftKey: true, [modifier]: true }, true), 0)
    }
  }
})
