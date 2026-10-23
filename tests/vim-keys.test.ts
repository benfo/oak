import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vimArrow } from '../src/renderer/src/lib/navigation.ts'
import { isListSearchKey } from '../src/renderer/src/lib/navigation.ts'
import { createVimMotions, handleListNav, markHalfPage, movementDelta } from '../src/renderer/src/lib/navigation.ts'
import type { KeyboardEvent } from 'react'

const plain = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false }

test('explicit search preserves command-palette and modified shortcuts', () => {
  assert.equal(isListSearchKey({ ...plain, key: '/' }), true)
  assert.equal(isListSearchKey({ ...plain, key: '/', shiftKey: true }), true)
  assert.equal(isListSearchKey({ ...plain, key: 'f', ctrlKey: true }), true)
  assert.equal(isListSearchKey({ ...plain, key: 'f', metaKey: true }), true)
  for (const event of [
    { key: '/', ctrlKey: true }, { key: 'p', ctrlKey: true, shiftKey: true },
    { key: 'f', ctrlKey: true, shiftKey: true }, { key: 'f', ctrlKey: true, altKey: true },
    { key: '/', isComposing: true }, { key: 'f' }
  ]) assert.equal(isListSearchKey({ ...plain, ...event }), false)
})

test('Vim navigation leaves modified shortcuts and IME composition untouched', () => {
  for (const modifier of Object.keys(plain)) {
    for (const key of ['h', 'j', 'k', 'l']) {
      assert.equal(vimArrow({ ...plain, [modifier]: true, key }), undefined)
    }
  }
  for (const key of ['J', '/', ' ', 'Enter', 'n', 'p', 'ArrowDown']) {
    assert.equal(vimArrow({ ...plain, key }), undefined)
  }
})

test('gg requires two deliberate presses in the same focus target within one second', () => {
  const motions = createVimMotions(), first = {}, second = {}
  const g = { ...plain, key: 'g' }
  assert.equal(motions.read(g, first, 0), 'prefix')
  assert.equal(motions.read({ ...g, repeat: true }, first, 500), 'prefix')
  assert.equal(motions.read(g, first, 800), 'Home')
  assert.equal(motions.read(g, first, 900), 'prefix')
  assert.equal(motions.read(g, second, 1000), 'prefix')
  assert.equal(motions.read(g, second, 2001), 'prefix')
  assert.equal(motions.read(g, second, 2100), 'Home')
  motions.read(g, first, 3000)
  motions.reset() // Blur, pointer interaction or disabling Vim cancels the prefix.
  assert.equal(motions.read(g, first, 3100), 'prefix')
})

test('Vim motions leave search, app shortcuts, selection modifiers and IME input alone', () => {
  const motions = createVimMotions(), target = {}
  for (const input of [
    { key: 'f', ctrlKey: true }, { key: 'd', ctrlKey: true, shiftKey: true },
    { key: 'u', ctrlKey: true, shiftKey: true }, { key: 'd', altKey: true },
    { key: 'd', metaKey: true }, { key: 'g', ctrlKey: true }, { key: 'G', altKey: true },
    { key: 'g', isComposing: true }, { key: 'k', ctrlKey: true }, { key: 'n' }
  ]) {
    motions.read({ ...plain, key: 'g' }, target, 0)
    assert.equal(motions.read({ ...plain, ...input }, target, 10), undefined)
    assert.equal(motions.read({ ...plain, key: 'g' }, target, 20), 'prefix')
    motions.reset()
  }
  assert.equal(motions.read({ ...plain, key: 'G', shiftKey: true }, target), 'End')
  assert.equal(motions.read({ ...plain, key: 'd', ctrlKey: true }, target), 'PageDown')
  assert.equal(motions.read({ ...plain, key: 'u', ctrlKey: true, repeat: true }, target), 'PageUp')
})

test('half-page movement is scoped to its alias event and clamps custom lists at both ends', () => {
  const nativeEvent = { ...plain, key: 'PageDown' }
  markHalfPage(nativeEvent)
  assert.equal(movementDelta('PageDown', 12, nativeEvent), 6)
  assert.equal(movementDelta('PageUp', 13, nativeEvent), -6)
  assert.equal(movementDelta('PageDown', 1, nativeEvent), 1)
  assert.equal(movementDelta('PageDown', 12, {}), 12)
  assert.equal(movementDelta('Home', 12, nativeEvent), -Infinity)
  const positions: number[] = []
  const e = { ...nativeEvent, nativeEvent, target: null, defaultPrevented: false, preventDefault() {} } as unknown as KeyboardEvent
  handleListNav(e, 30, 3, (i) => positions.push(i), 12)
  handleListNav(e, 30, 28, (i) => positions.push(i), 12)
  e.key = 'PageUp'
  handleListNav(e, 30, 2, (i) => positions.push(i), 12)
  assert.deepEqual(positions, [9, 29, 0])
})
