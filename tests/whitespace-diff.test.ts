import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ignoreWhitespaceChanges } from '../src/shared/whitespaceDiff.ts'
import { hunkPatch, lineKey, linesPatch, parseDiff } from '../src/renderer/src/diff/diff.ts'

function fixture(t: { after: (fn: () => void) => void }, before: string, after: string) {
  const repo = mkdtempSync(join(tmpdir(), 'oak-whitespace-'))
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const git = (args: string[], input?: string) =>
    execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: repo,
      input,
      encoding: 'utf8'
    })
  git(['init', '-q'])
  writeFileSync(join(repo, 'file.txt'), before)
  git(['add', '.'])
  git(['commit', '-qm', 'Before'])
  writeFileSync(join(repo, 'file.txt'), after)
  return { git, read: () => readFileSync(join(repo, 'file.txt'), 'utf8') }
}

const visibleChanges = (diff: ReturnType<typeof parseDiff>) =>
  diff.hunks.flatMap((h) => h.lines.filter((l) => l.type === 'add' || l.type === 'del').map((l) => `${l.type}:${l.text}`))

test('filters spaces, tabs and CRLF while retaining code edits with original line numbers', (t) => {
  const { git } = fixture(t, 'start\n  name = 1\n  return 1\nend\n', 'start\r\n\tname=1 \r\n    return 2\r\nend\r\n')
  const diff = ignoreWhitespaceChanges(parseDiff(git(['diff', '-U3'])), 3)
  assert.deepEqual(visibleChanges(diff), ['del:  return 1', 'add:    return 2'])
  assert.equal(diff.hunks[0].lines.find((l) => l.type === 'add')?.newNo, 3)
  assert.equal(diff.hunks[0].lines.find((l) => l.text === '\tname=1 ')?.beforeText, '  name = 1')
})

for (const operation of ['stage', 'unstage', 'discard'] as const) {
  for (const selection of ['hunk', 'lines', 'addition', 'deletion'] as const) {
    test(`${operation} ${selection} preserves hidden whitespace and uses exact selected text`, (t) => {
      const before = 'start\n  name = 1\n  return 1\n  extra = 1\nend\n'
      const after = 'start\n\tname=1 \n    return 2\n\textra=1\nend\n'
      const { git, read } = fixture(t, before, after)
      if (operation === 'unstage') git(['add', '.'])
      const diff = ignoreWhitespaceChanges(parseDiff(git(['diff', ...(operation === 'unstage' ? ['--cached'] : []), '-U3'])), 3)
      const selected = new Set<string>()
      diff.hunks.forEach((h, hi) =>
        h.lines.forEach((l, li) => {
          if ((l.type === 'add' && selection !== 'deletion') || (l.type === 'del' && selection !== 'addition'))
            selected.add(lineKey(hi, li))
        })
      )
      const reverse = operation !== 'stage'
      const patch = selection === 'hunk' ? hunkPatch(diff, diff.hunks[0], reverse) : linesPatch(diff, selected, reverse)!
      git(
        [
          'apply',
          '--recount',
          '--whitespace=nowarn',
          ...(operation !== 'discard' ? ['--cached'] : []),
          ...(reverse ? ['--reverse'] : []),
          '-'
        ],
        patch
      )
      const change =
        selection === 'addition'
          ? reverse
            ? ''
            : '  return 1\n    return 2\n'
          : selection === 'deletion'
            ? reverse
              ? '  return 1\n    return 2\n'
              : ''
            : reverse
              ? '  return 1\n'
              : '    return 2\n'
      const expected = reverse ? `start\n\tname=1 \n${change}\textra=1\nend\n` : `start\n  name = 1\n${change}  extra = 1\nend\n`
      assert.equal(operation === 'discard' ? read() : git(['show', ':file.txt']), expected)
      if (operation !== 'discard') assert.equal(read(), after)
    })
  }
}

for (const ending of ['\n', '\r\n', ''] as const) {
  test(`exact contexts and end-of-file notes apply with ${JSON.stringify(ending)} endings`, (t) => {
    const before = ' first\n  return 1' + (ending ? '\n' : '')
    const after = '\tfirst' + (ending || '\n') + '\treturn 2' + ending
    const { git } = fixture(t, before, after)
    const diff = ignoreWhitespaceChanges(parseDiff(git(['diff', '-U3'])), 3)
    git(['apply', '--recount', '--cached', '-'], hunkPatch(diff, diff.hunks[0]))
    assert.equal(git(['show', ':file.txt']), ' first\n\treturn 2' + ending)
  })
}

test('whitespace-only edits have no visible hunks', (t) => {
  const { git } = fixture(t, '  first\nsecond\n', '\tfirst\r\n second \r\n')
  assert.equal(ignoreWhitespaceChanges(parseDiff(git(['diff'])), 3).hunks.length, 0)
})

for (const [before, after, expected] of [
  ['first\nlast\n', ' first\n\nlast\n', ['add:']],
  ['first\n\nlast\n', ' first\nlast\n', ['del:']],
  ['first\nlast\n', ' first\n \nlast\n', ['add: ']]
] as const) {
  test(`blank-line change remains visible: ${JSON.stringify(expected)}`, (t) => {
    const { git } = fixture(t, before, after)
    const diff = ignoreWhitespaceChanges(parseDiff(git(['diff'])), 3)
    assert.deepEqual(visibleChanges(diff), expected)
    git(['apply', '--recount', '--cached', '-'], hunkPatch(diff, diff.hunks[0]))
    assert.equal(git(['show', ':file.txt']), after.replace(/^ first/, 'first'))
  })
}

test('filter re-trims a reformatted file into separate hunks and stages them independently', (t) => {
  const lines = Array.from({ length: 70 }, (_, i) => `value${i} = ${i}`)
  const edited = lines.map((l, i) => `  ${i === 8 || i === 55 ? `changed${i} = true` : l}`)
  const { git } = fixture(t, lines.join('\n') + '\n', edited.join('\n') + '\n')
  const diff = ignoreWhitespaceChanges(parseDiff(git(['diff', '-U3'])), 3)
  assert.equal(diff.hunks.length, 2)
  git(['apply', '--recount', '--cached', '-'], hunkPatch(diff, diff.hunks[1]))
  assert.equal(git(['show', ':file.txt']), lines.map((l, i) => (i === 55 ? edited[i] : l)).join('\n') + '\n')
})

test('new and deleted files retain every added or deleted line', () => {
  for (const [header, body] of [
    ['@@ -0,0 +1,2 @@', '+ \n+value\n'],
    ['@@ -1,2 +0,0 @@', '- \n-value\n']
  ]) {
    const source = parseDiff(`diff --git a/f b/f\n--- a/f\n+++ b/f\n${header}\n${body}`)
    const diff = ignoreWhitespaceChanges(source, 3)
    assert.deepEqual(visibleChanges(diff), visibleChanges(source))
    assert.equal(diff.hunks[0].header, header)
  }
})
