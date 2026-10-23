import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerSplit, resizeChord, resizeFocusedPane } from '../src/renderer/src/lib/paneResize.ts'

type Fake = { classList: { contains: (c: string) => boolean }; parentElement: Fake | null; closest: (s: string) => Fake | null }
const split = (axis: string, parent: Fake | null = null): Fake => {
  const el: Fake = {
    classList: { contains: (c) => c === 'split' || c === axis },
    parentElement: parent,
    closest: () => el
  }
  return el
}

test('Shift+Alt+arrow is the only resize chord', () => {
  const base = { key: 'ArrowLeft', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }
  assert.equal(resizeChord(base), 'ArrowLeft')
  assert.equal(resizeChord({ ...base, shiftKey: false }), undefined)
  assert.equal(resizeChord({ ...base, altKey: false }), undefined)
  assert.equal(resizeChord({ ...base, ctrlKey: true }), undefined)
  assert.equal(resizeChord({ ...base, key: 'Home' }), undefined)
})

test('the divider moves in the arrow direction on the nearest split of that axis', () => {
  const outer = split('split-row')
  const stacked = split('split-column', outer)
  const calls: string[] = []
  const controller = (name: string) => ({ enabled: () => true, resizeBy: (px: number) => calls.push(`${name}${px > 0 ? '+' : '-'}`) })
  const stops = [registerSplit(outer as unknown as Element, controller('row')), registerSplit(stacked as unknown as Element, controller('column'))]
  const from = { closest: () => stacked } as unknown as Element
  assert.equal(resizeFocusedPane('ArrowRight', from), true)
  assert.equal(resizeFocusedPane('ArrowLeft', from), true)
  assert.equal(resizeFocusedPane('ArrowDown', from), true)
  assert.equal(resizeFocusedPane('ArrowUp', from), true)
  assert.deepEqual(calls, ['row+', 'row-', 'column+', 'column-'])
  stops.forEach((stop) => stop())
  assert.equal(resizeFocusedPane('ArrowRight', from), false)
})

test('collapsed splits are skipped in favour of an enclosing one', () => {
  const outer = split('split-row')
  const inner = split('split-row', outer)
  const calls: string[] = []
  registerSplit(outer as unknown as Element, { enabled: () => true, resizeBy: () => calls.push('outer') })
  registerSplit(inner as unknown as Element, { enabled: () => false, resizeBy: () => calls.push('inner') })
  assert.equal(resizeFocusedPane('ArrowRight', { closest: () => inner } as unknown as Element), true)
  assert.deepEqual(calls, ['outer'])
})
