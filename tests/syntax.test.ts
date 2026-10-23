// Syntax highlighting: language detection, splitting a diff into old/new blocks, and the real
// Shiki tokenizer (the same code the worker runs). Run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff } from '../src/renderer/src/lib/diff.ts'
import { assignTokens, diffBlocks, diffPath, languageFor } from '../src/renderer/src/lib/syntax.ts'
import { highlightBlocks, knownLanguage } from '../src/renderer/src/lib/highlighter.ts'

const languageForPath = (path: string) => languageFor(path, knownLanguage)

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 // greeting
-const name = 'old'
+const name = "new"
 export function hi() {}
`

test('detects languages from paths', () => {
  assert.equal(languageForPath('src/a.ts'), 'ts')
  assert.equal(languageForPath('lib/Foo.CS'), 'cs')
  assert.equal(languageForPath('include/x.h'), 'c')
  assert.equal(languageForPath('build/Dockerfile'), 'docker')
  assert.equal(languageForPath('App.csproj'), 'xml')
  assert.equal(languageForPath('notes.unknownext'), null)
  assert.equal(languageForPath('LICENSE'), null)
})

test('finds the path of a diff', () => {
  assert.equal(diffPath(parseDiff(DIFF)), 'src/a.ts')
  const deleted = parseDiff('diff --git a/x.py b/x.py\ndeleted file mode 100644\n--- a/x.py\n+++ /dev/null\n@@ -1 +0,0 @@\n-x = 1\n')
  assert.equal(diffPath(deleted), 'x.py')
})

test('splits hunks into old and new sides and maps tokens back', () => {
  const diff = parseDiff(DIFF)
  const blocks = diffBlocks(diff)
  assert.deepEqual(blocks, ["// greeting\nconst name = 'old'\nexport function hi() {}", '// greeting\nconst name = "new"\nexport function hi() {}'])
  const fake = blocks.map((b) => b.split('\n').map((t) => [{ t }]))
  const tokens = assignTokens(diff, fake)
  assert.deepEqual(
    tokens[0].map((l) => l?.map((s) => s.t).join('')),
    diff.hunks[0].lines.map((l) => l.text)
  )
})

test('highlights with theme variables', async () => {
  const diff = parseDiff(DIFF)
  const blocks = await highlightBlocks('ts', diffBlocks(diff))
  assert.ok(blocks)
  const tokens = assignTokens(diff, blocks)
  const colourOf = (line: number, text: string) => tokens[0][line]?.find((s) => s.t.includes(text))?.c
  assert.equal(colourOf(0, 'greeting'), 'var(--syntax-comment)')
  assert.equal(colourOf(1, 'const'), 'var(--syntax-keyword)')
  assert.equal(colourOf(2, '"new"'), 'var(--syntax-string)')
  assert.equal(colourOf(3, 'hi'), 'var(--syntax-function)')
  // Text survives tokenizing unchanged.
  assert.deepEqual(
    tokens[0].map((l) => l?.map((s) => s.t).join('')),
    diff.hunks[0].lines.map((l) => l.text)
  )
})
