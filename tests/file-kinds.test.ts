import test from 'node:test'
import assert from 'node:assert/strict'
import { opensBetterInDefaultApp } from '../src/shared/fileKinds.ts'

test('images, documents and archives open in the default app', () => {
  for (const path of ['logo.PNG', 'docs/spec.pdf', 'a/b/report.docx', 'build.zip', 'bin/tool.exe'])
    assert.equal(opensBetterInDefaultApp(path), true, path)
})

test('source, config and text files do not', () => {
  for (const path of ['src/app.ts', 'README.md', 'icon.svg', '.env', 'Makefile', 'notes.txt', 'data.json'])
    assert.equal(opensBetterInDefaultApp(path), false, path)
})
