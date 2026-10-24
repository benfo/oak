import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff } from '../src/renderer/src/diff/diff.ts'
import { copiedLabel, copiedPatch, copiedText } from '../src/renderer/src/diff/diffCopy.ts'

const diff = parseDiff(
  '--- a/f.ts\n+++ b/f.ts\n@@ -1,3 +1,3 @@\n keep\n-old\n+new\n@@ -10,2 +10,2 @@\n-gone\n+\n\\ No newline at end of file\n'
)
const at = (hunk: number, line: number) => ({ hunk, line })

test('plain copy has code only: no +/- signs, line numbers or headers', () => {
  assert.deepEqual(copiedText(diff, [at(0, 1), at(0, 2)]), { text: 'old\nnew', lines: 2 })
  assert.deepEqual(copiedText(diff, [at(0, 0)]), { text: 'keep', lines: 1 })
})

test('plain copy keeps blank lines and ignores no-newline notes', () => {
  assert.deepEqual(copiedText(diff, [at(1, 0), at(1, 1), at(1, 2)]), { text: 'gone\n', lines: 2 })
  assert.equal(copiedText(diff, [at(1, 2)]), null)
  assert.equal(copiedText(diff, []), null)
})

test('patch copy keeps prefixes and puts each run under its hunk header', () => {
  assert.deepEqual(copiedPatch(diff, [at(0, 1), at(0, 2), at(1, 0)]), {
    text: '@@ -1,3 +1,3 @@\n-old\n+new\n@@ -10,2 +10,2 @@\n-gone',
    lines: 3
  })
  assert.equal(copiedPatch(diff, [at(1, 2)]), null)
})

test('copy confirmation names what was copied', () => {
  assert.equal(copiedLabel(1, false), 'Copied 1 line')
  assert.equal(copiedLabel(3, true), 'Copied 3 lines as patch')
})
