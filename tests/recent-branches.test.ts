import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkoutBranchNames } from '../src/shared/recentBranches.ts'

const repo = mkdtempSync(join(tmpdir(), 'oak-recent-branches-'))
after(() => rmSync(repo, { recursive: true, force: true }))
const git = (...args: string[]) => execFileSync('git', [
  '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args
], { cwd: repo, encoding: 'utf8' }).trim()

test('real checkout history preserves recency without commits or duplicate visits changing it', () => {
  git('init', '-q', '-b', 'trunk')
  git('commit', '--allow-empty', '-qm', 'Initial')
  git('branch', 'feature/a')
  git('branch', 'feature/b')
  git('switch', '-q', 'feature/a')
  git('switch', '-q', 'feature/b')
  git('switch', '-q', 'trunk')
  git('switch', '-q', 'feature/a')
  git('commit', '--allow-empty', '-qm', 'checkout: moving from decoy to other')
  const history = () => checkoutBranchNames(git('reflog', 'show', '-n', '100', '--grep-reflog=^checkout: moving from ', '--format=%gs', 'HEAD'))
  assert.deepEqual(history(), ['feature/a', 'trunk', 'feature/b'])
  git('branch', '-D', 'feature/b')
  const existing = new Set(git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n'))
  assert.deepEqual(history().filter((name) => existing.has(name)), ['feature/a', 'trunk'])
})

test('empty history and non-checkout reflog subjects produce no recent branches', () => {
  assert.deepEqual(checkoutBranchNames(''), [])
  assert.deepEqual(checkoutBranchNames('commit: checkout: moving from fake to branch\nreset: moving to HEAD\n'), [])
})
