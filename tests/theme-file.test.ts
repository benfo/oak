import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseThemeFile } from '../src/shared/themeFile.ts'

test('a theme file keeps its glow only when it is exactly true', () => {
  const base = { name: 'Neon', base: 'dark', colors: { primary: '#ff7edb' } }
  assert.equal(parseThemeFile({ ...base, glow: true }, 'neon').glow, true)
  for (const glow of [false, 'true', 1, null, undefined]) {
    assert.ok(!('glow' in parseThemeFile({ ...base, glow }, 'neon')), `glow: ${String(glow)}`)
  }
})

test('a theme file drops malformed fields and falls back to sensible defaults', () => {
  assert.deepEqual(parseThemeFile({ base: 'sepia', colors: { primary: '#fff', border: 3 } }, 'mine'), {
    id: 'custom:mine',
    name: 'mine',
    base: 'dark',
    colors: { primary: '#fff' }
  })
  assert.deepEqual(parseThemeFile(null, 'empty'), { id: 'custom:empty', name: 'empty', base: 'dark', colors: {} })
})
