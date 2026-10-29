import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRemoteUrl, pullRequestUrl, pullRequestUrlFromOutput, remotePageUrl } from '../src/shared/remote/index.ts'

test('parses https, ssh and scp-like remote URLs', () => {
  const expected = { host: 'github.com', path: 'benfo/oak' }
  assert.deepEqual(parseRemoteUrl('https://github.com/benfo/oak.git'), expected)
  assert.deepEqual(parseRemoteUrl('https://user:token@github.com/benfo/oak/'), expected)
  assert.deepEqual(parseRemoteUrl('git@github.com:benfo/oak.git'), expected)
  assert.deepEqual(parseRemoteUrl('ssh://git@github.com:22/benfo/oak.git'), expected)
  assert.equal(parseRemoteUrl('C:\\repos\\oak'), null)
})

test('builds new pull request pages for known hosts', () => {
  assert.equal(pullRequestUrl('git@github.com:benfo/oak.git', 'feature/x y'), 'https://github.com/benfo/oak/pull/new/feature/x%20y')
  assert.equal(
    pullRequestUrl('https://gitlab.com/group/sub/app.git', 'fix'),
    'https://gitlab.com/group/sub/app/-/merge_requests/new?merge_request[source_branch]=fix'
  )
  assert.equal(pullRequestUrl('git@bitbucket.org:team/app.git', 'a/b'), 'https://bitbucket.org/team/app/pull-requests/new?source=a%2Fb')
  assert.equal(
    pullRequestUrl('https://org@dev.azure.com/org/proj/_git/repo', 'x'),
    'https://dev.azure.com/org/proj/_git/repo/pullrequestcreate?sourceRef=x'
  )
  assert.equal(
    pullRequestUrl('git@ssh.dev.azure.com:v3/org/proj/repo', 'x'),
    'https://dev.azure.com/org/proj/_git/repo/pullrequestcreate?sourceRef=x'
  )
  assert.equal(pullRequestUrl('https://git.example.com/a/b.git', 'x'), null)
})

test('finds the link a remote prints after a push', () => {
  const github =
    "remote: \nremote: Create a pull request for 'x' on GitHub by visiting:\nremote:      https://github.com/benfo/oak/pull/new/x\nremote: \n"
  assert.equal(pullRequestUrlFromOutput(github), 'https://github.com/benfo/oak/pull/new/x')
  const bitbucket = 'remote: Create pull request for x:\nremote:   https://bitbucket.org/t/a/pull-requests/new?source=x&t=1\n'
  assert.equal(pullRequestUrlFromOutput(bitbucket), 'https://bitbucket.org/t/a/pull-requests/new?source=x&t=1')
  assert.equal(pullRequestUrlFromOutput('To https://github.com/benfo/oak.git\n   a..b  main -> main\n'), null)
})

test('builds remote pages for the repository, a branch, a commit and a file line', () => {
  const gh = 'git@github.com:benfo/oak.git'
  assert.equal(remotePageUrl(gh, { kind: 'repo' }), 'https://github.com/benfo/oak')
  assert.equal(remotePageUrl(gh, { kind: 'branch', name: 'feature/x y' }), 'https://github.com/benfo/oak/tree/feature/x%20y')
  assert.equal(remotePageUrl(gh, { kind: 'commit', hash: 'abc' }), 'https://github.com/benfo/oak/commit/abc')
  assert.equal(
    remotePageUrl(gh, { kind: 'file', hash: 'abc', path: 'src/a b.ts', line: 12 }),
    'https://github.com/benfo/oak/blob/abc/src/a%20b.ts#L12'
  )
  assert.equal(
    remotePageUrl('https://gitlab.com/group/sub/app.git', { kind: 'file', hash: 'abc', path: 'a.ts' }),
    'https://gitlab.com/group/sub/app/-/blob/abc/a.ts'
  )
  assert.equal(
    remotePageUrl('git@bitbucket.org:team/app.git', { kind: 'file', hash: 'abc', path: 'a.ts', line: 3 }),
    'https://bitbucket.org/team/app/src/abc/a.ts#lines-3'
  )
  assert.equal(
    remotePageUrl('https://org@dev.azure.com/org/proj/_git/app', { kind: 'commit', hash: 'abc' }),
    'https://dev.azure.com/org/proj/_git/app/commit/abc'
  )
  assert.equal(
    remotePageUrl('https://dev.azure.com/org/proj/_git/app', { kind: 'file', hash: 'abc', path: 'a.ts', line: 2 }),
    'https://dev.azure.com/org/proj/_git/app?path=%2Fa.ts&version=GCabc&line=2&lineEnd=3&lineStartColumn=1&lineEndColumn=1'
  )
})

test('unknown hosts fall back to the repository address', () => {
  assert.equal(remotePageUrl('git@git.example.com:team/app.git', { kind: 'commit', hash: 'abc' }), 'https://git.example.com/team/app')
  assert.equal(remotePageUrl('not a url', { kind: 'repo' }), null)
})
