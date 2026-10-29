import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROVIDERS,
  knownProviderLabels,
  providerFor,
  remotePageUrl,
  pullRequestUrl,
  type RemoteProvider
} from '../src/shared/remote/index.ts'

const repoOn = (host: string, path = 'team/app') => ({ host, path })

test('each host picks its provider, and anything else the generic one', () => {
  assert.equal(providerFor(repoOn('github.com')).id, 'github')
  assert.equal(providerFor(repoOn('gitlab.com')).id, 'gitlab')
  assert.equal(providerFor(repoOn('bitbucket.org')).id, 'bitbucket')
  assert.equal(providerFor(repoOn('dev.azure.com')).id, 'azure')
  assert.equal(providerFor(repoOn('ssh.dev.azure.com')).id, 'azure')
  assert.equal(providerFor(repoOn('git.example.com')).id, 'generic')
})

test('the generic provider matches last, so it never hides a known one', () => {
  assert.equal(PROVIDERS.at(-1)?.id, 'generic')
  assert.equal(PROVIDERS.filter((p) => p.hosts('git.example.com')).length, 1)
})

/** Every provider answers the same questions; these are the shapes each one must produce for `team/app`. */
const EXPECTED: Record<string, { repo: string; branch: string; commit: string; file: string; line: string; pullRequest: string | null }> = {
  github: {
    repo: 'https://github.com/team/app',
    branch: 'https://github.com/team/app/tree/feat/x',
    commit: 'https://github.com/team/app/commit/abc',
    file: 'https://github.com/team/app/blob/abc/src/a%20b.ts',
    line: 'https://github.com/team/app/blob/abc/src/a%20b.ts#L9',
    pullRequest: 'https://github.com/team/app/pull/new/feat/x'
  },
  gitlab: {
    repo: 'https://gitlab.com/team/app',
    branch: 'https://gitlab.com/team/app/-/tree/feat/x',
    commit: 'https://gitlab.com/team/app/-/commit/abc',
    file: 'https://gitlab.com/team/app/-/blob/abc/src/a%20b.ts',
    line: 'https://gitlab.com/team/app/-/blob/abc/src/a%20b.ts#L9',
    pullRequest: 'https://gitlab.com/team/app/-/merge_requests/new?merge_request[source_branch]=feat%2Fx'
  },
  bitbucket: {
    repo: 'https://bitbucket.org/team/app',
    branch: 'https://bitbucket.org/team/app/branch/feat/x',
    commit: 'https://bitbucket.org/team/app/commits/abc',
    file: 'https://bitbucket.org/team/app/src/abc/src/a%20b.ts',
    line: 'https://bitbucket.org/team/app/src/abc/src/a%20b.ts#lines-9',
    pullRequest: 'https://bitbucket.org/team/app/pull-requests/new?source=feat%2Fx'
  }
}
const REMOTES: Record<string, string> = {
  github: 'git@github.com:team/app.git',
  gitlab: 'https://gitlab.com/team/app.git',
  bitbucket: 'git@bitbucket.org:team/app.git'
}

for (const [id, expected] of Object.entries(EXPECTED)) {
  test(`${id} builds every page`, () => {
    const remote = REMOTES[id]
    const file = { kind: 'file' as const, hash: 'abc', path: 'src/a b.ts' }
    assert.equal(remotePageUrl(remote, { kind: 'repo' }), expected.repo)
    assert.equal(remotePageUrl(remote, { kind: 'branch', name: 'feat/x' }), expected.branch)
    assert.equal(remotePageUrl(remote, { kind: 'commit', hash: 'abc' }), expected.commit)
    assert.equal(remotePageUrl(remote, file), expected.file)
    assert.equal(remotePageUrl(remote, { ...file, line: 9 }), expected.line)
    assert.equal(pullRequestUrl(remote, 'feat/x'), expected.pullRequest)
  })
}

test('azure builds every page, from both remote forms, and rejects a path with too few parts', () => {
  const https = 'https://org@dev.azure.com/org/proj/_git/app'
  const ssh = 'git@ssh.dev.azure.com:v3/org/proj/app'
  const home = 'https://dev.azure.com/org/proj/_git/app'
  for (const remote of [https, ssh]) {
    assert.equal(remotePageUrl(remote, { kind: 'repo' }), home)
    assert.equal(remotePageUrl(remote, { kind: 'branch', name: 'feat/x' }), `${home}?version=GBfeat%2Fx`)
    assert.equal(remotePageUrl(remote, { kind: 'commit', hash: 'abc' }), `${home}/commit/abc`)
    assert.equal(pullRequestUrl(remote, 'feat/x'), `${home}/pullrequestcreate?sourceRef=feat%2Fx`)
  }
  assert.equal(
    remotePageUrl(https, { kind: 'file', hash: 'abc', path: 'a.ts', line: 2 }),
    `${home}?path=%2Fa.ts&version=GCabc&line=2&lineEnd=3&lineStartColumn=1&lineEndColumn=1`
  )
  assert.equal(remotePageUrl('https://dev.azure.com/org/proj', { kind: 'repo' }), null)
  assert.equal(pullRequestUrl('https://dev.azure.com/org/proj', 'x'), null)
})

test('an unknown host gets its repository address for every page, and no pull request', () => {
  const remote = 'git@git.example.com:team/app.git'
  assert.equal(remotePageUrl(remote, { kind: 'repo' }), 'https://git.example.com/team/app')
  assert.equal(remotePageUrl(remote, { kind: 'commit', hash: 'abc' }), 'https://git.example.com/team/app')
  assert.equal(pullRequestUrl(remote, 'x'), null)
  assert.equal(remotePageUrl('not a url', { kind: 'repo' }), null)
})

test('a new provider is one object in the list', () => {
  const selfHosted: RemoteProvider = {
    id: 'self-hosted',
    label: 'Self-hosted',
    hosts: (host) => host === 'code.internal',
    repoUrl: ({ path }) => `https://code.internal/r/${path}`,
    pageUrl: ({ path }, target) => `https://code.internal/r/${path}/${target.kind}`,
    pullRequestUrl: () => null
  }
  PROVIDERS.splice(PROVIDERS.length - 1, 0, selfHosted)
  try {
    assert.equal(
      remotePageUrl('git@code.internal:team/app.git', { kind: 'commit', hash: 'abc' }),
      'https://code.internal/r/team/app/commit'
    )
  } finally {
    PROVIDERS.splice(PROVIDERS.indexOf(selfHosted), 1)
  }
})

test('messages name the known providers in list order, without the generic one', () => {
  assert.deepEqual(knownProviderLabels(), ['GitHub', 'GitLab', 'Bitbucket', 'Azure DevOps'])
})
