import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff } from '../src/renderer/src/lib/diff.ts'
import { wordChanges, wordSpans } from '../src/renderer/src/lib/wordDiff.ts'

const replacement = (before: string[], after: string[]) => parseDiff(
  `--- a/example.ts\n+++ b/example.ts\n@@ -1,${before.length} +1,${after.length} @@\n` +
  [...before.map((s) => '-' + s), ...after.map((s) => '+' + s)].join('\n') + '\n'
)
const marked = (diff: ReturnType<typeof parseDiff>) => wordChanges(diff)[0].map(
  (ranges, i) => ranges.map((r) => diff.hunks[0].lines[i].text.slice(r.start, r.end)).join('')
)

test('marks changed words, numbers and punctuation without marking shared code', () => {
  assert.deepEqual(marked(replacement(['const timeout = 1000;'], ['const timeout = 5000;'])), ['1000', '5000'])
  assert.deepEqual(marked(replacement(['hello(old);'], ['hello(new)!'])), ['old;', 'new!'])
})

test('preserves whitespace edits and Unicode offsets', () => {
  assert.deepEqual(marked(replacement(['\tconst café = "😀 old";'], ['  const café = "😀 new";'])), ['\told', '  new'])
})

test('compares replacement blocks across unequal line counts', () => {
  const diff = replacement(['const a = 1;', 'const b = 2;'], ['// inserted', 'const a = 1;', 'const b = 3;'])
  assert.deepEqual(marked(diff), ['', '2', '// inserted', '', '3'])
})

test('leaves pure additions and deletions with their existing line colour', () => {
  assert.deepEqual(marked(replacement([], ['new file'])), [''])
  assert.deepEqual(marked(replacement(['deleted file'], [])), [''])
})

test('context, hunk boundaries and end-of-file notes do not become changed words', () => {
  const diff = parseDiff('--- a/a\n+++ b/a\n@@ -1,2 +1,2 @@\n-x = 1\n\\ No newline at end of file\n+x = 2\n\\ No newline at end of file\n context\n@@ -10 +10 @@\n-y = 3\n+y = 4\n')
  assert.deepEqual(marked(diff), ['1', '', '2', '', ''])
  assert.equal(wordChanges(diff, 1).length, 1)
  assert.deepEqual(wordChanges(diff)[1], [[{ start: 4, end: 5 }], [{ start: 4, end: 5 }]])
})

test('splits syntax colours at change boundaries without altering text or colours', () => {
  const spans = wordSpans('abc def ghi', [{ t: 'abc de', c: 'red' }, { t: 'f ghi', c: 'blue' }], [{ start: 4, end: 7 }])
  assert.deepEqual(spans, [
    { t: 'abc ', c: 'red', changed: false },
    { t: 'de', c: 'red', changed: true },
    { t: 'f', c: 'blue', changed: true },
    { t: ' ghi', c: 'blue', changed: false }
  ])
  assert.equal(spans.map((s) => s.t).join(''), 'abc def ghi')
  assert.deepEqual(wordSpans('plain', null, [{ start: 0, end: 5 }]), [{ t: 'plain', c: undefined, changed: true }])
})

test('large replacements fall back to line colours', () => {
  const before = 'old '.repeat(6000)
  const after = 'new '.repeat(6000)
  assert.deepEqual(marked(replacement([before], [after])), ['', ''])
  const manyWords = replacement([Array.from({ length: 400 }, (_, i) => `a${i}`).join(' ')], [Array.from({ length: 400 }, (_, i) => `b${i}`).join(' ')])
  assert.deepEqual(marked(manyWords), ['', ''])
})
