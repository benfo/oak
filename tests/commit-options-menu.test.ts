import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeOptionLabels,
  chooseCommitOption,
  commitOptionsMenu,
  freshCommitOptions
} from '../src/renderer/src/changes/commitOptionsMenu.ts'

test('a fresh commit follows the sign-off preference and shows no active options', () => {
  assert.equal(freshCommitOptions(true).signoff, true)
  assert.deepEqual(activeOptionLabels(freshCommitOptions(false), false), [])
  assert.deepEqual(activeOptionLabels(freshCommitOptions(true), true), [])
})

test('choosing items toggles checks and picks one signing mode', () => {
  let o = freshCommitOptions(false)
  o = chooseCommitOption(o, 'no-verify')
  o = chooseCommitOption(o, 'sign:skip')
  assert.equal(o.noVerify, true)
  assert.equal(o.sign, 'skip')
  assert.equal(chooseCommitOption(o, 'no-verify').noVerify, false)
  assert.equal(chooseCommitOption(o, 'nonsense'), o)
})

test('the menu checks what is on', () => {
  const items = commitOptionsMenu(chooseCommitOption(freshCommitOptions(false), 'allow-empty'))
  assert.equal(items.find((i) => i.id === 'allow-empty')?.checked, true)
  assert.equal(items.find((i) => i.id === 'no-verify')?.checked, false)
  assert.deepEqual(
    items
      .find((i) => i.submenu)
      ?.submenu?.filter((i) => i.checked)
      .map((i) => i.id),
    ['sign:default']
  )
})

test('only options that differ from a fresh commit are named', () => {
  const o = chooseCommitOption(chooseCommitOption(freshCommitOptions(true), 'no-verify'), 'signoff')
  assert.deepEqual(activeOptionLabels(o, true), ['Hooks skipped', 'No sign-off'])
})
