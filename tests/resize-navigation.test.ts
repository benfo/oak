import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KeyboardEvent } from 'react'
import { handleResizeNavigation } from '../src/renderer/src/lib/navigation.ts'

function event(key: string, modifiers = {}) {
  let prevented = false,
    stopped = false
  const e = {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    nativeEvent: { isComposing: false },
    ...modifiers,
    get defaultPrevented() {
      return prevented
    },
    preventDefault() {
      prevented = true
    },
    stopPropagation() {
      stopped = true
    }
  } as unknown as KeyboardEvent
  return { e, state: () => ({ prevented, stopped }) }
}

test('divider leaves ordinary resizing to the library and Escape returns exactly once', () => {
  let exits = 0
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Tab']) {
    const input = event(key)
    handleResizeNavigation(input.e, () => exits++)
    assert.deepEqual(input.state(), { prevented: false, stopped: false })
  }
  const escape = event('Escape')
  handleResizeNavigation(escape.e, () => exits++)
  handleResizeNavigation(escape.e, () => exits++)
  assert.equal(exits, 1)
  assert.deepEqual(escape.state(), { prevented: true, stopped: true })
})

test('modified and IME keys cannot resize; unrelated app shortcuts still propagate', () => {
  const unexpected = () => assert.fail('Modified input left resizing')
  for (const modifier of [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
    { nativeEvent: { isComposing: true } }
  ]) {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']) {
      const input = event(key, modifier)
      handleResizeNavigation(input.e, unexpected)
      assert.deepEqual(input.state(), { prevented: false, stopped: true })
    }
  }
  for (const key of ['p', '/', 'd']) {
    const shortcut = event(key, { ctrlKey: true, shiftKey: true })
    handleResizeNavigation(shortcut.e, unexpected)
    assert.deepEqual(shortcut.state(), { prevented: false, stopped: false })
  }
})

test('F6 uses Oak pane ownership rather than the library separator loop', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  t.after(() => (descriptor ? Object.defineProperty(globalThis, 'document', descriptor) : Reflect.deleteProperty(globalThis, 'document')))
  let focused = ''
  const active = { closest: (selector: string) => (selector.includes('data-pane-owner') ? { dataset: { paneOwner: 'files' } } : null) }
  const panes = ['sidebar', 'files', 'diff'].map((id) => ({
    dataset: { pane: id },
    offsetParent: {},
    closest: () => null,
    contains: () => false,
    matches: () => false,
    focus: () => {
      focused = id
    }
  }))
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      activeElement: active,
      querySelector: () => null,
      querySelectorAll: () => panes
    }
  })
  for (const [shiftKey, expected] of [
    [false, 'diff'],
    [true, 'sidebar']
  ] as const) {
    const input = event('F6', { shiftKey })
    handleResizeNavigation(input.e, () => assert.fail('F6 left via Escape'))
    assert.equal(focused, expected)
    assert.deepEqual(input.state(), { prevented: true, stopped: true })
  }
})
