import test from 'node:test'
import assert from 'node:assert/strict'
import { DIFF_TOOL_PRESETS, EDITOR_PRESETS, findPreset, isTerminalEditor, setsLineEndings } from '../src/shared/gitTools.ts'

test('finds presets by stored value', () => {
  assert.equal(findPreset(EDITOR_PRESETS, 'code --wait')?.label, 'VS Code')
  assert.equal(findPreset(EDITOR_PRESETS, 'my-editor'), undefined)
  assert.equal(findPreset(EDITOR_PRESETS, null), undefined)
})

test('VS Code is the only tool Oak must define a command for', () => {
  const withCommands = DIFF_TOOL_PRESETS.filter((p) => p.extra).map((p) => p.value)
  assert.deepEqual(withCommands, ['vscode'])
})

test('recognises editors that need a terminal', () => {
  assert.equal(isTerminalEditor('vim'), true)
  assert.equal(isTerminalEditor('"C:\\Program Files\\Git\\usr\\bin\\vim.exe" -f'), true)
  assert.equal(isTerminalEditor('code --wait'), false)
})

test('detects line-ending rules in .gitattributes', () => {
  assert.equal(setsLineEndings('* text=auto\n'), true)
  assert.equal(setsLineEndings('*.sh eol=lf\r\n'), true)
  assert.equal(setsLineEndings('*.bin -text\n'), true)
  assert.equal(setsLineEndings('# text=auto\n*.png binary\n'), false)
  assert.equal(setsLineEndings(''), false)
})
