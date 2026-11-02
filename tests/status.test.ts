import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoFetchText, fetchedText, repoStateText, tipCommitText } from '../src/shared/status.ts'

const now = Date.UTC(2026, 10, 2, 12, 0, 0)
const ago = (ms: number) => fetchedText(now - ms, now, 'en')

test('a fetch under a minute old reads as just now', () => {
  assert.equal(ago(0), 'Fetched just now')
  assert.equal(ago(59_000), 'Fetched just now')
})

test('older fetches use the largest whole unit', () => {
  assert.equal(ago(60_000), 'Fetched 1 minute ago')
  assert.equal(ago(3 * 60_000 + 20_000), 'Fetched 3 minutes ago')
  assert.equal(ago(2 * 3600_000 + 59 * 60_000), 'Fetched 2 hours ago')
  assert.equal(ago(3 * 24 * 3600_000), 'Fetched 3 days ago')
})

test('a clock slightly behind the file time does not read as the future', () => {
  assert.equal(fetchedText(now + 5000, now, 'en'), 'Fetched just now')
})

test('a repository that never fetched says so', () => {
  assert.equal(fetchedText(null, now, 'en'), 'Not fetched yet')
})

test('an operation in progress names itself and its conflicts', () => {
  assert.equal(repoStateText('clean', 0), null)
  assert.equal(repoStateText('merging', 3), 'Merging: 3 conflicts')
  assert.equal(repoStateText('rebasing', 1), 'Rebasing: 1 conflict')
  assert.equal(repoStateText('cherry-picking', 0), 'Cherry-picking: ready to continue')
  assert.equal(repoStateText('reverting', 2), 'Reverting: 2 conflicts')
})

test('the automatic fetch preference reads plainly', () => {
  assert.equal(autoFetchText(0), 'Automatic fetch is off')
  assert.equal(autoFetchText(1), 'Automatic fetch every minute')
  assert.equal(autoFetchText(5), 'Automatic fetch every 5 minutes')
})

test('a rebase names its step; other operations ignore one', () => {
  assert.equal(repoStateText('rebasing', 3, { current: 2, total: 5 }), 'Rebasing 2/5: 3 conflicts')
  assert.equal(repoStateText('rebasing', 0, { current: 5, total: 5 }), 'Rebasing 5/5: ready to continue')
  assert.equal(repoStateText('rebasing', 1), 'Rebasing: 1 conflict')
  assert.equal(repoStateText('merging', 1, { current: 2, total: 5 }), 'Merging: 1 conflict')
})

test('the latest commit reads "You" for your own email and the author name otherwise', () => {
  const commit = { hash: 'abc1234', author: 'Ben Fourie', email: 'Ben@Example.com', time: (now - 2 * 3600_000) / 1000, subject: 'Fix typo' }
  assert.equal(tipCommitText(commit, 'ben@example.com', now, 'en'), 'You, 2 hours ago')
  assert.equal(tipCommitText(commit, 'someone@else.com', now, 'en'), 'Ben Fourie, 2 hours ago')
  assert.equal(tipCommitText(commit, null, now, 'en'), 'Ben Fourie, 2 hours ago')
  assert.equal(tipCommitText({ ...commit, time: now / 1000 }, 'ben@example.com', now, 'en'), 'You, just now')
})
