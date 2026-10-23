import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KeyboardEvent } from 'react'
import { handleSearchNavigation } from '../src/renderer/src/lib/navigation.ts'

function event(key: string, modifiers = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
    nativeEvent: { isComposing: false }, preventDefault() {}, stopPropagation() {}, ...modifiers } as unknown as KeyboardEvent
}

test('repeated Enter and Shift+Enter find matches without leaving search; Escape leaves', () => {
  const directions: boolean[] = []
  let exits = 0
  const find = (backwards: boolean) => { directions.push(backwards) }
  const leave = () => { exits++ }
  handleSearchNavigation(event('Enter'), find, leave)
  handleSearchNavigation(event('Enter'), find, leave)
  handleSearchNavigation(event('Enter', { shiftKey: true }), find, leave)
  assert.deepEqual(directions, [false, false, true])
  assert.equal(exits, 0)
  handleSearchNavigation(event('Escape'), find, leave)
  assert.equal(exits, 1)
})

test('text input, modified shortcuts and composition cannot accept or exit search', () => {
  const unexpected = () => { assert.fail('Search should not handle this key') }
  for (const key of ['h', 'j', 'k', 'l', 'ArrowDown']) handleSearchNavigation(event(key), unexpected, unexpected)
  for (const modifiers of [{ctrlKey:true}, {metaKey:true}, {altKey:true}, {nativeEvent:{isComposing:true}}]) {
    for (const key of ['Enter', 'Escape', 'Tab']) handleSearchNavigation(event(key, modifiers), unexpected, unexpected)
  }
})
