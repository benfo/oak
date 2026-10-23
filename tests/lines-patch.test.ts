// Checks that patches built from selected diff lines apply with real git as intended.
// Run with `npm test` (Node runs the TypeScript directly).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { lineKey, linesPatch, parseDiff } from '../src/renderer/src/lib/diff.ts'

const repo = mkdtempSync(join(tmpdir(), 'oak-lines-'))
after(() => rmSync(repo, { recursive: true, force: true }))

const git = (args: string[], input?: string) =>
  execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: repo, input, encoding: 'utf8' })

git(['init', '-q'])
writeFileSync(join(repo, 'f.txt'), 'a\nb\nc\nd\ne\nf\n')
git(['add', 'f.txt'])
git(['commit', '-qm', 'init'])

/** Working tree: b -> B and e -> E, nothing staged. */
function reset() {
  git(['reset', '-q', '--hard'])
  writeFileSync(join(repo, 'f.txt'), 'a\nB\nc\nd\nE\nf\n')
}

/** Selects lines by their diff text, e.g. '+B' or '-b'. */
function pick(diffText: string, wanted: string[]) {
  const diff = parseDiff(diffText)
  const selected = new Set<string>()
  diff.hunks.forEach((h, hi) =>
    h.lines.forEach((l, li) => {
      const tag = (l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ') + l.text
      if (wanted.includes(tag)) selected.add(lineKey(hi, li))
    })
  )
  return { diff, selected }
}

/** The +/- lines of a diff, comma-separated. */
const changes = (args: string[]) =>
  git(['diff', ...args, '-U0', '--', 'f.txt'])
    .split('\n')
    .filter((l) => /^[-+][^-+]/.test(l))
    .join(',')

test('stage one changed line (its - and + pair)', () => {
  reset()
  const { diff, selected } = pick(git(['diff', '--', 'f.txt']), ['-b', '+B'])
  git(['apply', '--recount', '--cached', '-'], linesPatch(diff, selected, false)!)
  assert.equal(changes(['--cached']), '-b,+B')
  assert.equal(changes([]), '-e,+E')
})

test('stage only an addition, leaving its deletion unstaged', () => {
  reset()
  const { diff, selected } = pick(git(['diff', '--', 'f.txt']), ['+E'])
  git(['apply', '--recount', '--cached', '-'], linesPatch(diff, selected, false)!)
  assert.equal(changes(['--cached']), '+E')
  assert.equal(changes([]), '-b,+B,-e')
})

test('unstage selected lines', () => {
  reset()
  git(['add', 'f.txt'])
  const { diff, selected } = pick(git(['diff', '--cached', '--', 'f.txt']), ['-e', '+E'])
  git(['apply', '--recount', '--cached', '--reverse', '-'], linesPatch(diff, selected, true)!)
  assert.equal(changes(['--cached']), '-b,+B')
  assert.equal(changes([]), '-e,+E')
})

test('discard a single added line from the working tree', () => {
  reset()
  const { diff, selected } = pick(git(['diff', '--', 'f.txt']), ['+B'])
  git(['apply', '--recount', '--reverse', '-'], linesPatch(diff, selected, true)!)
  assert.equal(changes([]), '-b,-e,+E')
})

test('no selection builds no patch', () => {
  reset()
  const { diff } = pick(git(['diff', '--', 'f.txt']), [])
  assert.equal(linesPatch(diff, new Set(), false), null)
})

// Explicitly selected adjacent replacements must retain their place in the file.
// Assert exact contents: a patch can apply successfully while still reordering lines.
for (const operation of ['stage', 'unstage', 'discard'] as const) {
  for (const picked of [[0], [1], [2], [0, 2], [0, 1, 2]]) {
    test(`${operation} adjacent replacement rows ${picked.join(',')} preserves file order`, () => {
      git(['reset', '-q', '--hard'])
      const oldLines = ['price = 75', 'shipping = 10', 'tax = 5']
      const newLines = ['price = 100', 'shipping = 15', 'tax = 8']
      const content = (lines: string[]) => ['start', ...lines, 'end', ''].join('\n')
      writeFileSync(join(repo, 'adjacent.txt'), content(oldLines))
      git(['add', 'adjacent.txt'])
      writeFileSync(join(repo, 'adjacent.txt'), content(newLines))
      const { diff, selected } = pick(git(['diff', '--', 'adjacent.txt']), picked.flatMap((i) => ['-' + oldLines[i], '+' + newLines[i]]))
      if (operation === 'unstage') git(['add', 'adjacent.txt'])
      git(['apply', '--recount', ...(operation === 'discard' ? [] : ['--cached']), ...(operation === 'stage' ? [] : ['--reverse']), '-'], linesPatch(diff, selected, operation !== 'stage')!)
      const expected = oldLines.map((old, i) => (picked.includes(i) === (operation === 'stage') ? newLines[i] : old))
      assert.equal(operation === 'discard' ? readFileSync(join(repo, 'adjacent.txt'), 'utf8') : git(['show', ':adjacent.txt']), content(expected))
      // Staging and unstaging must not edit the working file.
      if (operation !== 'discard') assert.equal(readFileSync(join(repo, 'adjacent.txt'), 'utf8'), content(newLines))
    })
  }
}

for (const reverse of [false, true]) for (const picked of ['first', 'last']) {
  test(`${reverse ? 'unstage' : 'stage'} ${picked} adjacent replacement preserves missing final newline`, () => {
    git(['reset', '-q', '--hard'])
    const before = 'start\nold first\nold last'
    const after = 'start\nnew first\nnew last'
    writeFileSync(join(repo, 'eof.txt'), before)
    git(['add', 'eof.txt'])
    writeFileSync(join(repo, 'eof.txt'), after)
    const { diff, selected } = pick(git(['diff', '--', 'eof.txt']), ['-old ' + picked, '+new ' + picked])
    if (reverse) git(['add', 'eof.txt'])
    git(['apply', '--recount', '--cached', ...(reverse ? ['--reverse'] : []), '-'], linesPatch(diff, selected, reverse)!)
    const firstChanged = (picked === 'first') !== reverse
    assert.equal(git(['show', ':eof.txt']), firstChanged ? 'start\nnew first\nold last' : 'start\nold first\nnew last')
  })
}

test('an unequal replacement block still stages exactly the explicitly selected patch lines', () => {
  git(['reset', '-q', '--hard'])
  writeFileSync(join(repo, 'unequal.txt'), 'start\nold one\nold two\nend\n')
  git(['add', 'unequal.txt'])
  writeFileSync(join(repo, 'unequal.txt'), 'start\nnew one\nnew two\nextra\nend\n')
  const { diff, selected } = pick(git(['diff', '--', 'unequal.txt']), ['-old two', '+new two'])
  git(['apply', '--recount', '--cached', '-'], linesPatch(diff, selected, false)!)
  assert.equal(git(['show', ':unequal.txt']), 'start\nold one\nnew two\nend\n')
})

for (const operation of ['stage', 'unstage', 'discard'] as const) for (const half of ['del', 'add']) {
  test(`${operation} only the ${half} half of a replacement leaves the other half alone`, () => {
    git(['reset', '-q', '--hard'])
    const before = 'start\nprice = 75\nshipping = 10\ntax = 5\nend\n'
    const after = 'start\nprice = 100\nshipping = 15\ntax = 8\nend\n'
    writeFileSync(join(repo, 'halves.txt'), before)
    git(['add', 'halves.txt'])
    writeFileSync(join(repo, 'halves.txt'), after)
    const diff = parseDiff(git(['diff', '--', 'halves.txt']))
    const li = diff.hunks[0].lines.findIndex((line) => line.type === half && line.text.startsWith('price ='))
    const clicked = lineKey(0, li)
    const selected = new Set([clicked])
    if (operation === 'unstage') git(['add', 'halves.txt'])
    git(['apply', '--recount', ...(operation === 'discard' ? [] : ['--cached']), ...(operation === 'stage' ? [] : ['--reverse']), '-'], linesPatch(diff, selected, operation !== 'stage')!)
    const expected = operation === 'stage'
      ? half === 'del' ? 'start\nshipping = 10\ntax = 5\nend\n' : 'start\nprice = 75\nprice = 100\nshipping = 10\ntax = 5\nend\n'
      : half === 'del' ? 'start\nprice = 75\nprice = 100\nshipping = 15\ntax = 8\nend\n' : 'start\nshipping = 15\ntax = 8\nend\n'
    assert.equal(operation === 'discard' ? readFileSync(join(repo, 'halves.txt'), 'utf8') : git(['show', ':halves.txt']), expected)
    if (operation !== 'discard') assert.equal(readFileSync(join(repo, 'halves.txt'), 'utf8'), after)
  })
}

const unpairedCases = [
  { name: 'standalone addition', before: 'start\nkeep\nend\n', after: 'start\nkeep\nadded one\nadded two\nend\n', picked: '+added one', staged: 'start\nkeep\nadded one\nend\n', reversed: 'start\nkeep\nadded two\nend\n' },
  { name: 'standalone deletion', before: 'start\nkeep\nold one\nold two\nend\n', after: 'start\nkeep\nend\n', picked: '-old one', staged: 'start\nkeep\nold two\nend\n', reversed: 'start\nkeep\nold one\nend\n' },
  { name: 'extra addition in unequal replacement', before: 'start\nold value\nend\n', after: 'start\nnew value\nextra\nend\n', picked: '+extra', staged: 'start\nold value\nextra\nend\n', reversed: 'start\nnew value\nend\n' },
  { name: 'extra deletion in unequal replacement', before: 'start\nold value\nextra\nend\n', after: 'start\nnew value\nend\n', picked: '-extra', staged: 'start\nold value\nend\n', reversed: 'start\nnew value\nextra\nend\n' }
]

for (const scenario of unpairedCases) for (const operation of ['stage', 'unstage', 'discard'] as const) {
  test(`${operation} ${scenario.name} acts on exactly one line in place`, () => {
    git(['reset', '-q', '--hard'])
    writeFileSync(join(repo, 'unpaired.txt'), scenario.before)
    git(['add', 'unpaired.txt'])
    writeFileSync(join(repo, 'unpaired.txt'), scenario.after)
    const { diff, selected } = pick(git(['diff', '--', 'unpaired.txt']), [scenario.picked])
    assert.equal(selected.size, 1)
    if (operation === 'unstage') git(['add', 'unpaired.txt'])
    git(['apply', '--recount', ...(operation === 'discard' ? [] : ['--cached']), ...(operation === 'stage' ? [] : ['--reverse']), '-'], linesPatch(diff, selected, operation !== 'stage')!)
    const actual = operation === 'discard' ? readFileSync(join(repo, 'unpaired.txt'), 'utf8') : git(['show', ':unpaired.txt'])
    assert.equal(actual, operation === 'stage' ? scenario.staged : scenario.reversed)
    if (operation !== 'discard') assert.equal(readFileSync(join(repo, 'unpaired.txt'), 'utf8'), scenario.after)
    else assert.equal(git(['show', ':unpaired.txt']), scenario.before)
  })
}

for (const operation of ['stage', 'unstage', 'discard'] as const) {
  test(`${operation} an explicitly selected move preserves its source and destination`, () => {
    git(['reset', '-q', '--hard'])
    const before = 'start\nalpha\nbeta\ngamma\nend\n'
    const after = 'start\nbeta\ngamma\nalpha\nend\n'
    writeFileSync(join(repo, 'move.txt'), before)
    git(['add', 'move.txt'])
    writeFileSync(join(repo, 'move.txt'), after)
    const { diff, selected } = pick(git(['diff', '--', 'move.txt']), ['-alpha', '+alpha'])
    assert.equal(selected.size, 2)
    if (operation === 'unstage') git(['add', 'move.txt'])
    git(['apply', '--recount', ...(operation === 'discard' ? [] : ['--cached']), ...(operation === 'stage' ? [] : ['--reverse']), '-'], linesPatch(diff, selected, operation !== 'stage')!)
    assert.equal(operation === 'discard' ? readFileSync(join(repo, 'move.txt'), 'utf8') : git(['show', ':move.txt']), operation === 'stage' ? after : before)
  })
}
