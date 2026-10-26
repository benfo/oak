import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WIDGET_KEYMAP, widgetAction, widgetCollisions } from '../src/renderer/src/lib/keymap.ts'
import { NAVIGATION_COMMANDS, commandBinding } from '../src/renderer/src/commands.ts'
import { shortcutSignature, type ShortcutKey } from '../src/renderer/src/lib/shortcuts.ts'

const key = (k: string, extra: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra
})

test('a role never maps one key to two actions', () => {
  for (const role of ['list', 'graph', 'diff', 'blame'] as const) {
    const seen = new Map<string, string>()
    for (const entry of WIDGET_KEYMAP.filter((e) => e.roles.includes(role))) {
      for (const keys of entry.keys) {
        const signature = shortcutSignature(keys)
        assert.equal(seen.get(signature) ?? entry.action, entry.action, `${role}: ${keys}`)
        seen.set(signature, entry.action)
      }
    }
  }
})

test('diff widget keys use exact modifiers, so app commands keep their combos', () => {
  assert.equal(widgetAction(key('a', { ctrlKey: true, code: 'KeyA' }), 'diff'), 'selectAll')
  assert.equal(widgetAction(key('A', { ctrlKey: true, shiftKey: true, code: 'KeyA' }), 'diff'), undefined)
  assert.equal(widgetAction(key('ArrowDown', { altKey: true }), 'diff'), 'nextHunk')
  assert.equal(widgetAction(key('n'), 'diff'), 'nextHunk')
  assert.equal(widgetAction(key('n', { ctrlKey: true, code: 'KeyN' }), 'diff'), undefined)
})

test('typed letters follow the layout; chords use the physical key', () => {
  assert.equal(widgetAction(key('n', { code: 'KeyL' }), 'diff'), 'nextHunk')
  assert.equal(widgetAction(key('Ctrl', { ctrlKey: true, code: 'KeyA' }), 'diff'), 'selectAll')
})

test('blame jumps between blocks with N and P, and not in the diff', () => {
  assert.equal(widgetAction(key('n'), 'blame'), 'nextBlock')
  assert.equal(widgetAction(key('p', { shiftKey: true }), 'blame'), 'prevBlock')
  assert.equal(widgetAction(key('ArrowDown', { altKey: true }), 'blame'), 'nextBlock')
  assert.equal(widgetAction(key('n', { ctrlKey: true, code: 'KeyN' }), 'blame'), undefined)
  assert.equal(widgetAction(key('Enter'), 'blame'), 'activate')
  assert.equal(widgetAction(key(' ', { code: 'Space' }), 'blame'), 'commitMessage')
  assert.equal(widgetAction(key(' ', { code: 'Space' }), 'diff'), 'toggleSelect')
  assert.equal(widgetAction(key('b'), 'blame'), 'blameBefore')
  assert.equal(widgetAction(key('Backspace'), 'blame'), 'blameNewer')
  assert.equal(widgetAction(key('b', { ctrlKey: true, code: 'KeyB' }), 'blame'), undefined)
  assert.equal(widgetAction(key('b'), 'diff'), undefined)
  assert.equal(widgetAction(key('/'), 'blame'), 'find')
  assert.equal(widgetAction(key('f', { ctrlKey: true, code: 'KeyF' }), 'blame'), 'find')
  assert.equal(widgetAction(key('/'), 'diff'), 'find')
  assert.equal(widgetAction(key('f', { ctrlKey: true, code: 'KeyF' }), 'diff'), 'find')
  assert.equal(widgetAction(key('/', { isComposing: true }), 'diff'), undefined)
  assert.equal(widgetAction(key('n'), 'diff'), 'nextHunk')
})

test('graph separates select, toggle and cursor movement by modifier', () => {
  assert.equal(widgetAction(key(' '), 'graph'), 'select')
  assert.equal(widgetAction(key(' ', { ctrlKey: true }), 'graph'), 'toggleSelect')
  assert.equal(widgetAction(key(' ', { ctrlKey: true }), 'graph', 'mac'), undefined)
  assert.equal(widgetAction(key('PageDown', { ctrlKey: true }), 'graph'), 'moveFocus')
  assert.equal(widgetAction(key('ArrowDown'), 'graph'), undefined)
})

test('list search keeps typed "/" even where it needs Shift', () => {
  assert.equal(widgetAction(key('/', { shiftKey: true, code: 'Digit7' }), 'list'), 'search')
  assert.equal(widgetAction(key('f', { ctrlKey: true, code: 'KeyF' }), 'list'), 'search')
})

test('T switches the history file list only in lists, never with modifiers', () => {
  assert.equal(widgetAction(key('t'), 'list'), 'switchList')
  assert.equal(widgetAction(key('t', { ctrlKey: true, code: 'KeyT' }), 'list'), undefined)
  assert.equal(widgetAction(key('t'), 'diff'), undefined)
})

test('V switches changed files between list and tree in lists and the diff, never with modifiers', () => {
  assert.equal(widgetAction(key('v'), 'list'), 'switchView')
  assert.equal(widgetAction(key('v'), 'diff'), 'switchView')
  assert.equal(widgetAction(key('v'), 'graph'), undefined)
  assert.equal(widgetAction(key('v', { ctrlKey: true, code: 'KeyV' }), 'diff'), undefined)
})

test('commands may only overlap widget keys by declaring a fallback', () => {
  assert.deepEqual(widgetCollisions(NAVIGATION_COMMANDS.map(commandBinding)), [])
  const find = { id: 'find', keys: 'Mod+F' }
  assert.equal(widgetCollisions([find]).length, 1)
  assert.deepEqual(widgetCollisions([{ ...find, widgetFallback: true }]), [])
  assert.equal(widgetCollisions([{ id: 'stage-all', keys: 'Mod+Shift+A' }]).length, 0)
})
