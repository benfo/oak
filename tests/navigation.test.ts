import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KeyboardEvent } from 'react'
import {
  cyclePanes,
  focusPane,
  handleNavigation,
  handleDismissNavigation,
  handleListNav,
  handleSearchNavigation,
  handleToolNavigation,
  navigationAction,
  movementDelta
} from '../src/renderer/src/lib/navigation.ts'

const plain = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false }
function event(key: string, modifiers = {}, target: unknown = null) {
  const nativeEvent = { ...plain, key, ...modifiers }
  let prevented = false,
    stopped = false
  const e = {
    ...nativeEvent,
    nativeEvent,
    target,
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
  return { e, consumed: () => prevented && stopped }
}

test('Escape dismisses one active layer, ignores repeats and leaves an empty stack to the layout fallback', () => {
  const dismissed: string[] = []
  const layers = [undefined, () => dismissed.push('find'), () => dismissed.push('selection')]
  const escape = event('Escape')
  assert.equal(handleDismissNavigation(escape.e, layers), true)
  assert.equal(escape.consumed(), true)
  assert.deepEqual(dismissed, ['find'])
  assert.equal(handleDismissNavigation(event('Escape', { repeat: true }).e, layers), true)
  assert.deepEqual(dismissed, ['find'])
  assert.equal(handleDismissNavigation(event('Escape').e, [undefined]), false)
  for (const modifier of Object.keys(plain)) {
    assert.equal(handleDismissNavigation(event('Escape', { [modifier]: true }).e, layers), false)
  }
  const input = { closest: () => ({}) }
  assert.equal(handleDismissNavigation(event('Escape', {}, input).e, layers), false)
  assert.equal(handleDismissNavigation(event('Escape', {}, input).e, layers, { allowTextInput: true }), true)
})

test('shared actions preserve native and modified shortcuts, including IME confirmation', () => {
  const actions = { Enter: 'activate', ArrowRight: 'deeper', ArrowLeft: 'back', Escape: 'dismiss', Delete: 'discard' }
  for (const [key, action] of Object.entries(actions)) {
    assert.equal(navigationAction({ ...plain, key }), action)
    for (const modifier of Object.keys(plain)) assert.equal(navigationAction({ ...plain, key, [modifier]: true }), undefined)
  }
  assert.equal(navigationAction({ ...plain, key: 'F10', shiftKey: true }), 'menu')
  assert.equal(navigationAction({ ...plain, key: 'ContextMenu' }), 'menu')
  assert.equal(navigationAction({ ...plain, key: 'F10', shiftKey: true, ctrlKey: true }), undefined)
})

test('unsupported and previously handled actions cannot consume or run a second time', () => {
  let activated = 0
  const supported = event('Enter'),
    unsupported = event('ArrowLeft')
  assert.equal(handleNavigation(unsupported.e, { activate: () => activated++ }), false)
  assert.equal(unsupported.consumed(), false)
  assert.equal(handleNavigation(supported.e, { activate: () => activated++ }), true)
  assert.equal(supported.consumed(), true)
  assert.equal(handleNavigation(supported.e, { activate: () => activated++ }), false)
  assert.equal(activated, 1)
})

test('nested controls keep their keys; picker acceptance explicitly opts into text input', () => {
  const control = { closest: () => ({}) }
  const unexpected = () => {
    assert.fail('Native control key was hijacked')
  }
  for (const key of ['Enter', 'Delete', 'Escape', 'ArrowRight']) {
    const { e } = event(key, {}, control)
    assert.equal(handleNavigation(e, { activate: unexpected, discard: unexpected, dismiss: unexpected, deeper: unexpected }), false)
  }
  assert.equal(handleListNav(event('ArrowDown', {}, control).e, 3, 0, unexpected), false)
  let accepted = 0
  assert.equal(handleNavigation(event('Enter', {}, control).e, { activate: () => accepted++ }, { allowTextInput: true }), true)
  assert.equal(
    handleNavigation(event('Enter', { isComposing: true }, control).e, { activate: unexpected }, { allowTextInput: true }),
    false
  )
  assert.equal(accepted, 1)
})

test('custom collection movement clamps at boundaries and keeps Ctrl/Meta selection shortcuts', () => {
  const positions: number[] = []
  const select = (i: number) => {
    positions.push(i)
  }
  handleListNav(event('ArrowDown').e, 3, -1, select)
  handleListNav(event('ArrowUp').e, 3, -1, select)
  handleListNav(event('PageDown').e, 3, 1, select)
  handleListNav(event('ArrowDown', { shiftKey: true }).e, 3, 0, select)
  handleListNav(event('ArrowDown', { ctrlKey: true }).e, 3, 0, select)
  handleListNav(event('ArrowDown', { metaKey: true }).e, 3, 0, select)
  assert.deepEqual(positions, [0, 2, 2, 1])
  assert.equal(movementDelta('PageDown', 24), 24)
  assert.equal(movementDelta('End'), Infinity)
})

test('Tab enters the search owner exactly once without finding or activating a result', () => {
  let exits = 0
  const { e, consumed } = event('Tab')
  const unexpected = () => {
    assert.fail('Tab ran a search')
  }
  handleSearchNavigation(e, unexpected, () => exits++)
  handleSearchNavigation(e, unexpected, () => exits++)
  assert.equal(exits, 1)
  assert.equal(consumed(), true)
})

test('pane focus skips hidden and inert matches before choosing a visible pane', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  t.after(() => (descriptor ? Object.defineProperty(globalThis, 'document', descriptor) : Reflect.deleteProperty(globalThis, 'document')))
  const focused: string[] = []
  const pane = (id: string, hidden = false, inert = false) => ({
    offsetParent: hidden ? null : {},
    closest: () => (inert ? {} : null),
    focus: () => focused.push(id)
  })
  const hidden = pane('hidden', true)
  const inert = pane('inert', false, true)
  const visible = pane('visible')
  let matches = [hidden, inert, visible]
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelectorAll: () => matches } })
  assert.equal(focusPane('[data-pane="diff"]'), true)
  assert.deepEqual(focused, ['visible'])
  matches = [hidden, inert]
  assert.equal(focusPane('[data-pane="diff"]'), false)
  assert.deepEqual(focused, ['visible'])
})

test('pane cycling is relative to tools and form controls and skips unavailable panes', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  t.after(() => (descriptor ? Object.defineProperty(globalThis, 'document', descriptor) : Reflect.deleteProperty(globalThis, 'document')))
  let active: unknown
  let focused = ''
  const pane = (name: string, unavailable?: 'hidden' | 'inert') => ({
    dataset: { pane: name },
    offsetParent: unavailable === 'hidden' ? null : {},
    closest: () => (unavailable === 'inert' ? {} : null),
    contains: (element: unknown) => element === nodeByName.get(name),
    matches: () => false,
    focus: () => {
      focused = name
      active = nodeByName.get(name)
    }
  })
  const names = ['toolbar', 'sidebar', 'files-unstaged', 'files-staged', 'message', 'hidden-history', 'inert-pane', 'diff']
  const nodeByName = new Map(
    names.map((name) => [name, pane(name, name === 'hidden-history' ? 'hidden' : name === 'inert-pane' ? 'inert' : undefined)])
  )
  const panes = [...nodeByName.values()]
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get activeElement() {
        return active
      },
      querySelector: () => null,
      querySelectorAll: () => panes
    }
  })
  const ownedControl = (owner: string, search = false) => ({
    closest: (selector: string) =>
      selector.includes('data-pane-owner') ? { dataset: search ? { searchPane: owner } : { paneOwner: owner } } : null
  })
  for (const [owner, backwards, expected] of [
    ['message', false, 'diff'],
    ['message', true, 'files-staged'],
    ['diff', true, 'message'],
    ['diff', false, 'toolbar'],
    ['files-unstaged', true, 'sidebar'],
    ['files-staged', false, 'message']
  ] as const) {
    active = ownedControl(owner)
    cyclePanes(backwards)
    assert.equal(focused, expected)
  }
  active = ownedControl('sidebar', true)
  cyclePanes(false)
  assert.equal(focused, 'files-unstaged')

  // A menu/dialog owns focus even when the opener belongs to a background pane.
  const dialogField = pane('dialog-field')
  active = {
    closest: (selector: string) =>
      selector.includes('role="dialog"') ? { querySelectorAll: () => [dialogField] } : { dataset: { paneOwner: 'message' } }
  }
  cyclePanes(false)
  assert.equal(focused, 'dialog-field')
})

test('Escape on a pane tool returns to its owning pane; keys inside the pane or with modifiers are left alone', () => {
  const owner = (id: string | null) => ({ dataset: { paneOwner: id ?? undefined }, contains: () => true })
  const target = (insidePane: boolean) => ({ closest: () => (insidePane ? {} : null) })
  const run = (key: string, modifiers: object, insidePane: boolean, id: string | null = 'files-unstaged') => {
    const { e, consumed } = event(key, modifiers, target(insidePane))
    ;(e as unknown as { currentTarget: unknown }).currentTarget = owner(id)
    const focused: string[] = []
    handleToolNavigation(e, (paneId) => (focused.push(paneId), true))
    return { focused, consumed: consumed() }
  }
  assert.deepEqual(run('Escape', {}, false), { focused: ['files-unstaged'], consumed: true })
  assert.deepEqual(run('Escape', {}, true), { focused: [], consumed: false })
  assert.deepEqual(run('Enter', {}, false), { focused: [], consumed: false })
  assert.deepEqual(run('Escape', { shiftKey: true }, false), { focused: [], consumed: false })
  assert.deepEqual(run('Escape', { isComposing: true }, false), { focused: [], consumed: false })
  assert.deepEqual(run('Escape', {}, false, null), { focused: [], consumed: false })
})
