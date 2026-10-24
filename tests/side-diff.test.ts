import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff, linesPatch, lineKey } from '../src/renderer/src/diff/diff.ts'
import { alignDiffLines } from '../src/renderer/src/diff/sideDiff.ts'

const lines = (body: string) => parseDiff(`--- a/a\n+++ b/a\n@@ -1,4 +1,4 @@\n${body}\n`).hunks[0].lines

test('aligns replacements with blank cells for unequal line counts', () => {
  assert.deepEqual(alignDiffLines(lines(' context\n-old\n+new\n+extra\n end')), [
    { old: 0, new: 0 },
    { old: 1, new: 2 },
    { old: null, new: 3 },
    { old: 4, new: 4 }
  ])
  assert.deepEqual(alignDiffLines(lines('-one\n-two\n+three')), [
    { old: 0, new: 2 },
    { old: 1, new: null }
  ])
})

test('pure insertions and deletions leave the other side empty', () => {
  assert.deepEqual(alignDiffLines(lines('+one\n+two')), [
    { old: null, new: 0 },
    { old: null, new: 1 }
  ])
  assert.deepEqual(alignDiffLines(lines('-one')), [{ old: 0, new: null }])
  assert.deepEqual(alignDiffLines([]), [])
})

test('keeps end-of-file notes on the side they describe', () => {
  assert.deepEqual(alignDiffLines(lines('-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file')), [
    { old: 0, new: 2 },
    { old: 1, new: 3 }
  ])
  assert.deepEqual(alignDiffLines(lines('-old\n+new\n\\ No newline at end of file')), [
    { old: 0, new: 1 },
    { old: null, new: 2 }
  ])
})

test('aligned cells keep the original patch indices for selected-line staging', () => {
  const diff = parseDiff('--- a/a\n+++ b/a\n@@ -1,3 +1,3 @@\n-a = 1\n-b = 2\n+a = 3\n+b = 4\n end\n')
  const pair = alignDiffLines(diff.hunks[0].lines)[0]
  const selected = new Set([lineKey(0, pair.old!), lineKey(0, pair.new!)])
  const patch = linesPatch(diff, selected)
  assert.ok(patch.includes('-a = 1\n'))
  assert.ok(patch.includes('+a = 3\n'))
  assert.ok(patch.includes(' b = 2\n'))
  assert.ok(!patch.includes('+b = 4'))
})
