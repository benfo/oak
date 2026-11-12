import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff } from '../src/renderer/src/diff/diff.ts'
import { EXPAND_ALL, expandDiff, expandGap, type Expansion } from '../src/shared/diffExpand.ts'

/** A whole-file diff of `total` lines in which each line in `changed` was edited. */
function wholeDiff(total: number, changed: number[]) {
  const body: string[] = []
  for (let n = 1; n <= total; n++) {
    if (changed.includes(n)) body.push(`-old ${n}`, `+new ${n}`)
    else body.push(` line ${n}`)
  }
  return parseDiff(`diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,${total} +1,${total} @@\n${body.join('\n')}\n`)
}

const none: Expansion = new Map()

test('a whole-file diff is cut to the context and reports the hidden lines', () => {
  const { diff, gaps } = expandDiff(wholeDiff(100, [10, 50]), 3, none, true)
  assert.deepEqual(
    diff.hunks.map((h) => h.header),
    ['@@ -7,7 +7,7 @@', '@@ -47,7 +47,7 @@']
  )
  assert.deepEqual(
    gaps.map((g) => [g.before, g.hidden]),
    [
      [0, 6],
      [1, 33],
      [2, 47]
    ]
  )
})

test('expanding a gap adds ordinary context lines at the clicked edge and shrinks it', () => {
  const base = expandDiff(wholeDiff(100, [10, 50]), 3, none, true)
  const between = base.gaps[1]
  const down = expandDiff(wholeDiff(100, [10, 50]), 3, expandGap(none, between.key, 'down', 20), true)
  assert.equal(down.diff.hunks[0].lines.at(-1)?.newNo, 10 + 3 + 20)
  assert.equal(down.diff.hunks[1].lines[0].newNo, base.diff.hunks[1].lines[0].newNo)
  assert.equal(down.gaps[1].hidden, 13)
  assert.equal(down.gaps[1].key, between.key)
  const up = expandDiff(wholeDiff(100, [10, 50]), 3, expandGap(none, between.key, 'up', 20), true)
  assert.equal(up.diff.hunks[1].lines[0].newNo, base.diff.hunks[1].lines[0].newNo! - 20)
  assert.equal(up.gaps[1].hidden, 13)
})

test('revealing a whole gap joins the two hunks', () => {
  const base = expandDiff(wholeDiff(100, [10, 50]), 3, none, true)
  const all = expandDiff(wholeDiff(100, [10, 50]), 3, expandGap(none, base.gaps[1].key, 'all'), true)
  assert.equal(all.diff.hunks.length, 1)
  assert.deepEqual(
    all.gaps.map((g) => g.before),
    [0, 1]
  )
  const full = all.diff.hunks[0]
  assert.equal(full.raw.length, full.lines.length + 1)
  assert.match(full.header, /^@@ -7,\d+ \+7,\d+ @@$/)
})

test('expansions past the file edges stop there and the edge gaps close', () => {
  const diff = wholeDiff(100, [10, 50])
  const base = expandDiff(diff, 3, none, true)
  const lead = expandDiff(diff, 3, expandGap(none, base.gaps[0].key, 'up', EXPAND_ALL), true)
  assert.equal(lead.diff.hunks[0].lines[0].newNo, 1)
  assert.equal(lead.gaps.length, 2)
  const tail = expandDiff(diff, 3, expandGap(none, base.gaps[2].key, 'down', 500), true)
  assert.equal(tail.diff.hunks.at(-1)?.lines.at(-1)?.newNo, 100)
})

test('patches built from an expanded hunk stay valid', () => {
  const base = expandDiff(wholeDiff(100, [10]), 3, none, true)
  const grown = expandDiff(
    wholeDiff(100, [10]),
    3,
    expandGap(expandGap(none, base.gaps[0].key, 'up', 2), base.gaps[1].key, 'down', 2),
    true
  )
  assert.match(grown.diff.hunks[0].header, /^@@ -5,11 \+5,11 @@$/)
  assert.equal(grown.diff.hunks[0].raw[0], grown.diff.hunks[0].header)
})

test('a diff git cut itself keeps its hunks and reports the gaps from their headers', () => {
  const cut = parseDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -8,3 +8,3 @@\n a\n-b\n+c\n d\n@@ -40,2 +40,2 @@\n-x\n+y\n z\n')
  const { diff, gaps } = expandDiff(cut, 3, none, true)
  assert.equal(diff, cut)
  assert.deepEqual(
    gaps.map((g) => [g.key, g.before, g.hidden]),
    [
      [1, 0, 7],
      [11, 1, 29]
    ]
  )
})

test('no gap is offered after a hunk that ends short of the context, since the file ended there', () => {
  const end = parseDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,3 +1,3 @@\n-a\n+b\n c\n d\n')
  assert.deepEqual(expandDiff(end, 3, none, false).gaps, [])
})

test('a change at the top of a file that is not fully loaded still offers what follows it', () => {
  const top = parseDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,4 +1,4 @@\n-a\n+b\n c\n d\n e\n')
  assert.deepEqual(expandDiff(top, 3, none, false).gaps, [{ key: 5, before: 1, hidden: null }])
})

test('new and deleted files have nothing to expand', () => {
  const added = parseDiff('diff --git a/f b/f\nnew file mode 100644\n--- /dev/null\n+++ b/f\n@@ -0,0 +1,2 @@\n+a\n+b\n')
  assert.deepEqual(expandDiff(added, 3, none, true).gaps, [])
})
