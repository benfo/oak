import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeNotice } from '../src/shared/notice.ts'

test('errors are toasts, with or without buttons', () => {
  assert.equal(routeNotice({ kind: 'error' }), 'toast')
  assert.equal(routeNotice({ kind: 'error', actions: [{}] }), 'toast')
})

test('plain results and hints go to the bar', () => {
  assert.equal(routeNotice({ kind: 'success' }), 'bar')
  assert.equal(routeNotice({ kind: 'info' }), 'bar')
})

test('anything with buttons is a toast so the buttons stay reachable', () => {
  assert.equal(routeNotice({ kind: 'success', actions: [{}] }), 'toast')
  assert.equal(routeNotice({ kind: 'info', actions: [{}] }), 'toast')
})

test('an empty button list does not count as buttons', () => {
  assert.equal(routeNotice({ kind: 'success', actions: [] }), 'bar')
})

test('warnings are toasts: something changed that the user may need to act on', () => {
  assert.equal(routeNotice({ kind: 'warning' }), 'toast')
})
