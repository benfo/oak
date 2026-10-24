import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseCompareTarget } from '../src/shared/compareTarget.ts'

test('prefers the remote default branch, then conventional local names', () => {
  assert.equal(chooseCompareTarget('origin/main', ['main', 'feature'], 'feature'), 'origin/main')
  assert.equal(chooseCompareTarget(null, ['feature', 'master', 'develop'], 'feature'), 'master')
  assert.equal(chooseCompareTarget(null, ['feature'], 'feature'), null)
})

test('never targets the source itself', () => {
  assert.equal(chooseCompareTarget('origin/main', ['main'], 'origin/main'), 'main')
  assert.equal(chooseCompareTarget(null, ['main'], 'main'), null)
})
