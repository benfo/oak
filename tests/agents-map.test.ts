import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// AGENTS.md "Where to look" names real files; fail when a move leaves it stale.
const section = readFileSync('AGENTS.md', 'utf8').split('\n## Where to look')[1]?.split('\n## ')[0] ?? ''
const roots: Record<string, string> = { 'R/': 'src/renderer/src/' }

test('every path in the AGENTS.md map exists', () => {
  const paths = [...section.matchAll(/`([^`\s]+\/[^`\s]*|[^`\s]+\.(?:md|ts|tsx|css))`/g)].map((m) => m[1])
  assert.ok(paths.length > 20, 'map section not found')
  const missing = paths.map((p) => p.replace(/^R\//, roots['R/'])).filter((p) => !p.includes('*') && !p.includes('<') && !existsSync(p))
  assert.deepEqual(missing, [])
})
