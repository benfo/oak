import { test } from 'node:test'
import assert from 'node:assert/strict'
import { identityBarText, identityLabel, repoIdentity } from '../src/shared/identity.ts'

const global = { 'user.name': 'Global Person', 'user.email': 'global@example.com' }

test('the global identity alone is the ordinary case and says nothing', () => {
  const id = repoIdentity(global, {})
  assert.equal(id.missing, false)
  assert.equal(id.repoSpecific, false)
  assert.equal(identityBarText(id), null)
})

test('a repository that sets its own identity says who commits will be by', () => {
  const id = repoIdentity(global, { 'user.name': 'Work Person', 'user.email': 'work@example.com' })
  assert.equal(id.repoSpecific, true)
  assert.equal(identityBarText(id), 'Committing as Work Person')
  assert.deepEqual(id.global, { name: 'Global Person', email: 'global@example.com' })
})

test('values combine key by key, with the repository winning', () => {
  const id = repoIdentity(global, { 'user.email': 'work@example.com' })
  assert.equal(id.name, 'Global Person')
  assert.equal(id.email, 'work@example.com')
  assert.equal(identityBarText(id), 'Committing as Global Person')
})

test('a missing name or email is flagged, whatever is set', () => {
  assert.equal(identityBarText(repoIdentity({}, {})), 'No git identity')
  assert.equal(identityBarText(repoIdentity({ 'user.name': 'Only Name' }, {})), 'No git identity')
  assert.equal(identityBarText(repoIdentity({}, { 'user.name': 'A', 'user.email': '' })), 'No git identity')
})

test('blank values count as unset', () => {
  const id = repoIdentity(global, { 'user.name': '  ', 'user.email': null })
  assert.equal(id.repoSpecific, false)
  assert.equal(id.name, 'Global Person')
})

test('the label tolerates a half-set identity', () => {
  assert.equal(identityLabel('A', 'a@x'), 'A <a@x>')
  assert.equal(identityLabel('A', null), 'A')
  assert.equal(identityLabel(null, 'a@x'), '<a@x>')
})
