// Partial staging of new (untracked) files: `git add --intent-to-add` first, then line patches.
// Run with `npm test`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { lineKey, linesPatch, parseDiff } from '../src/renderer/src/lib/diff.ts'

const repo = mkdtempSync(join(tmpdir(), 'oak-newfile-'))
after(() => rmSync(repo, { recursive: true, force: true }))

const git = (args: string[], input?: string) =>
  execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: repo,
    input,
    encoding: 'utf8'
  })

git(['init', '-q'])
git(['commit', '-q', '--allow-empty', '-m', 'init'])

const CONTENT = 'one\ntwo\nthree\nfour\n'

/** The diff Oak shows for an untracked file (same shape as untrackedDiff in handlers.ts). */
const untrackedDiff = () =>
  `diff --git a/n.txt b/n.txt\nnew file mode 100644\n--- /dev/null\n+++ b/n.txt\n@@ -0,0 +1,4 @@\n+one\n+two\n+three\n+four\n`

function fresh() {
  git(['reset', '-q', '--hard'])
  git(['clean', '-qfd'])
  writeFileSync(join(repo, 'n.txt'), CONTENT)
}

function pick(diffText: string, wanted: string[]) {
  const diff = parseDiff(diffText)
  const selected = new Set<string>()
  diff.hunks.forEach((h, hi) => h.lines.forEach((l, li) => wanted.includes(l.text) && l.type !== 'ctx' && selected.add(lineKey(hi, li))))
  return linesPatch(diff, selected, false) && { diff, selected }
}

const apply = (patch: string, ...flags: string[]) => git(['apply', '--recount', '--whitespace=nowarn', ...flags, '-'], patch)
const indexContent = () => git(['show', ':n.txt'])
const status = () => git(['status', '--porcelain', '--', 'n.txt']).trimEnd()

/** Stages the given lines of the untracked file, as the Changes view does. */
function stageLines(lines: string[]) {
  git(['add', '--intent-to-add', '--', 'n.txt'])
  const { diff, selected } = pick(untrackedDiff(), lines)!
  apply(linesPatch(diff, selected, false)!, '--cached')
}

test('stage some lines of an untracked file', () => {
  fresh()
  stageLines(['one', 'three'])
  assert.equal(indexContent(), 'one\nthree\n')
  assert.equal(readFileSync(join(repo, 'n.txt'), 'utf8'), CONTENT)
  assert.equal(status(), 'AM n.txt')
})

test('stage the rest later from the normal unstaged diff', () => {
  fresh()
  stageLines(['one'])
  const { diff, selected } = pick(git(['diff', '--', 'n.txt']), ['two', 'three', 'four'])!
  apply(linesPatch(diff, selected, false)!, '--cached')
  assert.equal(indexContent(), CONTENT)
  assert.equal(status(), 'A  n.txt')
})

test('unstage some lines of a staged new file', () => {
  fresh()
  stageLines(['one', 'two', 'three'])
  const staged = git(['diff', '--cached', '--', 'n.txt'])
  const { diff, selected } = pick(staged, ['two'])!
  apply(linesPatch(diff, selected, true)!, '--cached', '--reverse')
  assert.equal(indexContent(), 'one\nthree\n')
})

test('unstage every line of a staged new file', () => {
  fresh()
  stageLines(['one', 'two'])
  const staged = git(['diff', '--cached', '--', 'n.txt'])
  const { diff, selected } = pick(staged, ['one', 'two'])!
  apply(linesPatch(diff, selected, true)!, '--cached', '--reverse')
  // The whole file was unstaged: it's untracked again, not an empty staged file.
  assert.equal(status(), '?? n.txt')
})

test('discard some lines of a new file from the working tree', () => {
  fresh()
  git(['add', '--intent-to-add', '--', 'n.txt'])
  const { diff, selected } = pick(git(['diff', '--', 'n.txt']), ['two'])!
  apply(linesPatch(diff, selected, true)!, '--reverse')
  assert.equal(readFileSync(join(repo, 'n.txt'), 'utf8'), 'one\nthree\nfour\n')
})
