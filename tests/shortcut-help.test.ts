import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesShortcutHelp, prepareShortcutHelp } from '../src/shared/shortcutHelp.ts'
import { WIDGET_KEYMAP } from '../src/renderer/src/lib/keymap.ts'
import { shortcutNavigationHelp } from '../src/renderer/src/components/shortcutNavigationHelp.ts'

const row = (bindings: string[], title = 'Find in the focused list') =>
  prepareShortcutHelp({ title, category: 'Navigation', keys: bindings.join(' or '), bindings })

test('key search requires the exact modifiers on one complete binding', () => {
  assert.equal(matchesShortcutHelp(row(['Ctrl+F']), 'Ctrl+F'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+Shift+F']), 'Ctrl+F'), false)
  assert.equal(matchesShortcutHelp(row(['Ctrl+F']), 'Ctrl+Shift+F'), false)
  assert.equal(matchesShortcutHelp(row(['Ctrl+F', 'Shift+Enter']), 'Ctrl+Shift+F'), false)
  assert.equal(matchesShortcutHelp(row(['Alt+ArrowDown']), 'Alt+Down'), true)
  assert.equal(matchesShortcutHelp(row(['Shift+Alt+ArrowDown']), 'Alt+Down'), false)
  assert.equal(matchesShortcutHelp(row(['Ctrl+Shift+F']), 'Ctrl'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+Shift+F']), 'Ctrl+Shift'), true)
})

test('key search accepts modifier, arrow and punctuation aliases', () => {
  for (const query of ['Control+F', 'command f', 'Cmd+F', '⌘F']) assert.equal(matchesShortcutHelp(row(['Mod+F']), query), true, query)
  for (const query of ['Alt+Down', 'Alt+ArrowDown', '⌥↓']) assert.equal(matchesShortcutHelp(row(['Alt+ArrowDown']), query), true, query)
  assert.equal(matchesShortcutHelp(row(['Ctrl+PageDown']), 'Ctrl+PgDn'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+PageDown']), 'Ctrl+Page Down'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+/']), 'Ctrl+Slash'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+,']), 'Ctrl+Comma'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+`']), 'Ctrl+Backtick'), true)
  assert.equal(matchesShortcutHelp(row(['/']), '/'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+/']), '/'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+,']), ','), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+`']), '`'), true)
  assert.equal(matchesShortcutHelp(row(['Enter', 'Escape']), '/'), false)
})

test('ordinary description search remains case insensitive and supports multiple words', () => {
  assert.equal(matchesShortcutHelp(row(['Ctrl+F']), 'FOCUSED find'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+F']), 'navigation'), true)
  assert.equal(matchesShortcutHelp(row(['Ctrl+F']), 'stash'), false)
  assert.equal(matchesShortcutHelp(row(['Ctrl+F']), ''), true)
})

test('widget help searches actual bindings and keeps key labels free of explanatory context', () => {
  const help = WIDGET_KEYMAP.filter((entry) => entry.help).map((entry) => prepareShortcutHelp({ ...entry.help!, bindings: entry.keys }))
  const next = help.filter((entry) => matchesShortcutHelp(entry, 'Alt+Down'))
  assert.deepEqual(
    next.map((entry) => entry.category),
    ['Diff', 'Blame']
  )
  assert.ok(help.every((entry) => !entry.keys.includes('(')))
  const menu = shortcutNavigationHelp.find(([title]) => title.includes('context menu'))!
  assert.ok(menu[3].includes('ContextMenu'))
})

test('find has one help entry for the matching list and code bindings', () => {
  const list = WIDGET_KEYMAP.find((entry) => entry.action === 'search')!
  const code = WIDGET_KEYMAP.find((entry) => entry.action === 'find')!
  assert.deepEqual(list.keys, code.keys)
  assert.equal(code.help, undefined)
  assert.equal(list.help?.title, 'Find in focused pane')
  const help = prepareShortcutHelp({ ...list.help!, bindings: list.keys })
  assert.equal(matchesShortcutHelp(help, 'Ctrl+F'), true)
  assert.equal(matchesShortcutHelp(help, ':120'), true)
})
