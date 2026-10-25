import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { git } from '../src/main/git.ts'
import {
  adjacentBlockStart,
  blameArgs,
  blameBlockStarts,
  blockStartOf,
  findLines,
  gotoLine,
  mapLineToOlder,
  parseBlame
} from '../src/shared/blame.ts'

async function repoWithHistory() {
  const dir = mkdtempSync(path.join(tmpdir(), 'oak-blame-'))
  const write = (text: string) => writeFileSync(path.join(dir, 'a.txt'), text)
  const commit = async (message: string, name: string) => {
    await git(dir, ['add', '-A'])
    await git(dir, ['-c', `user.name=${name}`, '-c', `user.email=${name.toLowerCase()}@example.com`, 'commit', '-m', message])
    return (await git(dir, ['rev-parse', 'HEAD'])).trim()
  }
  await git(dir, ['init', '-q'])
  write('one\ntwo\nthree\n')
  const first = await commit('first', 'Ann')
  write('one\nTWO\nthree\nfour\n')
  const second = await commit('second', 'Bob')
  return { dir, write, first, second }
}

test('blame names the commit, author and subject of every line, and marks uncommitted lines', async () => {
  const { dir, write, first, second } = await repoWithHistory()
  write('one\nTWO\nthree\nfour\nfive\n')
  const blame = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false })))
  assert.deepEqual(
    blame.lines.map((l) => l.text),
    ['one', 'TWO', 'three', 'four', 'five']
  )
  assert.deepEqual(
    blame.lines.slice(0, 4).map((l) => blame.commits[l.hash].summary),
    ['first', 'second', 'first', 'second']
  )
  assert.equal(blame.commits[first].author, 'Ann')
  assert.equal(blame.commits[second].email, 'bob@example.com')
  assert.equal(blame.commits[blame.lines[4].hash].uncommitted, true)
  assert.equal(blame.commits[first].uncommitted, false)
  assert.equal(blame.binary, false)
})

test('blame at a commit ignores later working-tree edits', async () => {
  const { dir, write, first } = await repoWithHistory()
  write('changed\n')
  const blame = parseBlame(await git(dir, blameArgs('a.txt', first, { ignoreWhitespace: false })))
  assert.deepEqual(
    blame.lines.map((l) => l.text),
    ['one', 'two', 'three']
  )
  assert.ok(blame.lines.every((l) => l.hash === first))
})

test('ignoring whitespace keeps authorship for re-indented lines', async () => {
  const { dir, write, first } = await repoWithHistory()
  write('one\n  TWO\nthree\nfour\n')
  await git(dir, ['add', '-A'])
  await git(dir, ['-c', 'user.name=Cy', '-c', 'user.email=cy@example.com', 'commit', '-m', 'indent'])
  const plain = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false })))
  const ignored = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: true })))
  assert.equal(plain.commits[plain.lines[1].hash].summary, 'indent')
  assert.notEqual(ignored.lines[1].hash, plain.lines[1].hash)
  assert.equal(ignored.lines[0].hash, first)
})

test('an ignore-revs file skips a bulk commit', async () => {
  const { dir, write, second } = await repoWithHistory()
  write('one\nTWO\nthree\nfour\n\n')
  await git(dir, ['add', '-A'])
  await git(dir, ['-c', 'user.name=Cy', '-c', 'user.email=cy@example.com', 'commit', '-m', 'format'])
  const bulk = (await git(dir, ['rev-parse', 'HEAD'])).trim()
  writeFileSync(path.join(dir, '.ignore-revs'), `${bulk}\n`)
  const blame = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false, ignoreRevsFile: '.ignore-revs' })))
  assert.equal(blame.lines[3].hash, second)
})

test('lines named by skipping an ignored commit are flagged, and the list can be turned off', async () => {
  const { dir, write, second } = await repoWithHistory()
  write('one\n  TWO\nthree\nfour\n')
  await git(dir, ['add', '-A'])
  await git(dir, ['-c', 'user.name=Cy', '-c', 'user.email=cy@example.com', 'commit', '-m', 'indent'])
  const bulk = (await git(dir, ['rev-parse', 'HEAD'])).trim()
  writeFileSync(path.join(dir, '.ignore-revs'), `${bulk}\n`)
  const skipped = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false, ignoreRevsFile: '.ignore-revs' })))
  assert.deepEqual(
    skipped.lines.map((l) => l.ignored),
    [false, true, false, false]
  )
  assert.equal(skipped.lines[1].hash, second)

  // Turning it off also overrides a list that Git is configured to use.
  await git(dir, ['config', 'blame.ignoreRevsFile', '.ignore-revs'])
  const off = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false, skipIgnoreRevs: true })))
  assert.equal(off.commits[off.lines[1].hash].summary, 'indent')
  assert.ok(off.lines.every((l) => !l.ignored))
  const on = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false })))
  assert.equal(on.lines[1].hash, second)
})

test('binary content is reported instead of parsed as lines of text', () => {
  const hash = 'a'.repeat(40)
  const blame = parseBlame(`${hash} 1 1 1\nauthor Ann\nauthor-mail <ann@example.com>\nauthor-time 1\nsummary s\nfilename b.bin\n\tab\0cd\n`)
  assert.equal(blame.binary, true)
})

test('runs of one commit form blocks that next and previous step through', () => {
  const lines = ['a', 'a', 'b', 'a', 'a', 'a'].map((hash) => ({ hash }))
  const starts = blameBlockStarts(lines)
  assert.deepEqual(starts, [0, 2, 3])
  assert.equal(blockStartOf(starts, 1), 0)
  assert.equal(blockStartOf(starts, 5), 3)
  assert.equal(adjacentBlockStart(starts, 1, 1), 2)
  assert.equal(adjacentBlockStart(starts, 5, 1), null)
  assert.equal(adjacentBlockStart(starts, 4, -1), 3)
  assert.equal(adjacentBlockStart(starts, 3, -1), 2)
  assert.equal(adjacentBlockStart(starts, 0, -1), null)
})

test('a line maps to the older version through the zero-context diff, or to the line above when it was inserted', async () => {
  const { dir, first, second } = await repoWithHistory()
  const diff = await git(dir, ['diff', '-U0', first, second, '--', 'a.txt'])
  assert.deepEqual(mapLineToOlder(diff, 2), { line: 2, added: false })
  assert.deepEqual(mapLineToOlder(diff, 3), { line: 3, added: false })
  assert.deepEqual(mapLineToOlder(diff, 4), { line: 3, added: true })

  // Two lines replace one, then three lines go; later lines shift by the net change.
  const hunks = '@@ -2 +2,2 @@\n-b\n+B\n+B2\n@@ -5,3 +6,0 @@\n-e\n-f\n-g\n'
  assert.deepEqual(mapLineToOlder(hunks, 1), { line: 1, added: false })
  assert.deepEqual(mapLineToOlder(hunks, 3), { line: 2, added: false })
  assert.deepEqual(mapLineToOlder(hunks, 5), { line: 4, added: false })
  assert.deepEqual(mapLineToOlder(hunks, 6), { line: 5, added: false })
  assert.deepEqual(mapLineToOlder(hunks, 7), { line: 9, added: false })
  assert.deepEqual(mapLineToOlder('@@ -0,0 +1 @@\n+new\n', 1), { line: 1, added: true })
  assert.deepEqual(mapLineToOlder('', 7), { line: 7, added: false })
})

test('lines of the root commit are marked as having no earlier version', async () => {
  const { dir, first, second } = await repoWithHistory()
  const blame = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false })))
  assert.equal(blame.commits[first].boundary, true)
  assert.equal(blame.commits[second].boundary, false)
})

test('find lists the lines containing the text in any case, and a ":N" query names a line kept within the file', () => {
  const lines = ['const Foo = 1', 'bar()', 'foo(bar)', ''].map((text) => ({ text }))
  assert.deepEqual(findLines(lines, 'FOO'), [0, 2])
  assert.deepEqual(findLines(lines, 'bar'), [1, 2])
  assert.deepEqual(findLines(lines, 'nothing'), [])
  assert.deepEqual(findLines(lines, ''), [])
  assert.equal(gotoLine(':3', 4), 2)
  assert.equal(gotoLine(': 3 ', 4), 2)
  assert.equal(gotoLine(':0', 4), 0)
  assert.equal(gotoLine(':99', 4), 3)
  assert.equal(gotoLine(':', 4), null)
  assert.equal(gotoLine(':x', 4), null)
  assert.equal(gotoLine('3', 4), null)
  assert.equal(gotoLine(':3', 0), null)
})

test("each line keeps its number in the commit that introduced it, and that commit's path after a rename", async () => {
  const { dir, write } = await repoWithHistory()
  write('zero\none\nTWO\nthree\nfour\n')
  const who = ['-c', 'user.name=Cy', '-c', 'user.email=cy@example.com']
  await git(dir, ['add', '-A'])
  await git(dir, [...who, 'commit', '-m', 'third'])
  const moved = parseBlame(await git(dir, blameArgs('a.txt', null, { ignoreWhitespace: false })))
  assert.deepEqual(
    moved.lines.map((l) => l.origLine),
    [1, 1, 2, 3, 4]
  )
  assert.ok(moved.lines.every((l) => l.file === 'a.txt'))

  await git(dir, ['mv', 'a.txt', 'b.txt'])
  await git(dir, [...who, 'commit', '-m', 'rename'])
  const renamed = parseBlame(await git(dir, blameArgs('b.txt', null, { ignoreWhitespace: false })))
  assert.deepEqual(
    renamed.lines.map((l) => l.text),
    ['zero', 'one', 'TWO', 'three', 'four']
  )
  assert.ok(renamed.lines.every((l) => l.file === 'a.txt'))
})
