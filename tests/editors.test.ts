import test from 'node:test'
import assert from 'node:assert/strict'
import { customEditorCommand, findEditor } from '../src/shared/editors.ts'

test('presets open a file at a line in each editor syntax', () => {
  assert.deepEqual(findEditor('vscode')!.args('/r/a.ts', 12), ['--goto', '/r/a.ts:12'])
  assert.deepEqual(findEditor('sublime')!.args('/r/a.ts', 12), ['/r/a.ts:12'])
  assert.deepEqual(findEditor('notepad++')!.args('/r/a.ts', 12), ['-n12', '/r/a.ts'])
})

test('presets open a file without a line', () => {
  assert.deepEqual(findEditor('vscode')!.args('/r/a.ts'), ['--goto', '/r/a.ts'])
  assert.deepEqual(findEditor('notepad++')!.args('/r/a.ts'), ['/r/a.ts'])
})

test('custom commands quote the path and default the line to 1', () => {
  assert.equal(customEditorCommand('zed {file}:{line}', '/my repo/a.ts', 7), 'zed "/my repo/a.ts":7')
  assert.equal(customEditorCommand('zed {file}:{line}', '/r/a.ts'), 'zed "/r/a.ts":1')
})
