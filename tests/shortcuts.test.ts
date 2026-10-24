import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createShortcutDispatcher, matchesShortcut, type ShortcutKey } from '../src/renderer/src/lib/shortcuts.ts'
import { shortcutBlockReason } from '../src/renderer/src/lib/shortcutPolicy.ts'

const key = (k: string, extra: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra
})

test('Mod maps to Ctrl off macOS and Meta on macOS', () => {
  assert.ok(matchesShortcut('Mod+Enter', key('Enter', { ctrlKey: true })))
  assert.ok(!matchesShortcut('Mod+Enter', key('Enter', { metaKey: true })))
  assert.ok(matchesShortcut('Mod+Enter', key('Enter', { metaKey: true }), 'mac'))
})

test('physical letter codes match across layouts and exact modifiers are required', () => {
  assert.ok(matchesShortcut('Ctrl+Shift+P', key('Π', { ctrlKey: true, shiftKey: true, code: 'KeyP' })))
  assert.ok(!matchesShortcut('Ctrl+P', key('p', { ctrlKey: true, shiftKey: true, code: 'KeyP' })))
})

test('IME composition and AltGraph input are ignored', () => {
  assert.ok(!matchesShortcut('Enter', key('Enter', { isComposing: true })))
  assert.ok(!matchesShortcut('Ctrl+Alt+Q', key('q', { ctrlKey: true, altKey: true, getModifierState: () => true })))
})

test('modal scopes block lower bindings unless allowInOverlay', () => {
  const ran: string[] = []
  const d = createShortcutDispatcher()
  d.register({
    id: 'app',
    bindings: [
      { id: 'palette', keys: 'Ctrl+K', run: () => ran.push('palette') },
      { id: 'zoom', keys: 'Ctrl+=', allowInOverlay: true, run: () => ran.push('zoom') }
    ]
  })
  d.register({ id: 'dialog', modal: true, priority: 10, bindings: [] })
  const ctx = { editing: false }
  assert.equal(d.dispatch(key('k', { ctrlKey: true }), ctx).status, 'blocked')
  assert.equal(d.dispatch(key('=', { ctrlKey: true }), ctx).status, 'handled')
  assert.deepEqual(ran, ['zoom'])
})

test('text input keeps keys unless the binding allows input; disabled bindings shadow lower ones', () => {
  const ran: string[] = []
  const d = createShortcutDispatcher()
  d.register({ id: 'low', bindings: [{ id: 'low-enter', keys: 'Enter', run: () => ran.push('low') }] })
  d.register({
    id: 'high',
    priority: 1,
    bindings: [{ id: 'high-enter', keys: 'Enter', enabled: false, allowInInput: true, run: () => ran.push('high') }]
  })
  assert.equal(d.dispatch(key('Enter'), { editing: true }).status, 'blocked')
  assert.deepEqual(ran, [])
  assert.deepEqual(d.conflicts({ editing: false }), [])
})

test('disabled reasons are explained, and take precedence over the generic disabled state', () => {
  const d = createShortcutDispatcher()
  d.register({ id: 'app', bindings: [{ id: 'push', keys: 'Ctrl+K', enabled: false, disabledReason: 'Wait', run: () => {} }] })
  const result = d.resolve(key('k', { ctrlKey: true }), { editing: false })
  assert.deepEqual(result.status === 'blocked' && [result.reason, result.explain], ['Wait', true])
})

test('expanded layouts and busy Git explain why shortcuts are unavailable', () => {
  assert.match(shortcutBlockReason({ revealsPanes: true }, { editing: false, expanded: 'code' }) ?? '', /F11/)
  assert.match(shortcutBlockReason({ repositoryAction: true }, { editing: false, expanded: 'code' }) ?? '', /F11/)
  assert.match(shortcutBlockReason({ requiresIdle: true }, { editing: false, busy: true }) ?? '', /Git operation/)
  assert.equal(
    shortcutBlockReason({ repositoryAction: true, requiresIdle: true }, { editing: false, expanded: 'standard', busy: false }),
    undefined
  )
})
