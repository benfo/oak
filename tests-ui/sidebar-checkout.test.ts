import { test, expect } from './fixtures'
import { commitAll, git, write } from './repos'

test('Enter checks out a sidebar branch and preserves working changes', async ({ open, small }) => {
  git(small, 'branch', 'feature/checkout')
  const before = git(small, 'diff')
  const page = await open(small)
  const branch = page.locator('[data-pane="sidebar"] [role="row"][data-key="refs/heads/feature/checkout"]')
  await branch.click()
  expect(git(small, 'branch', '--show-current').trim()).toBe('main')
  await branch.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => git(small, 'branch', '--show-current').trim()).toBe('feature/checkout')
  expect(git(small, 'diff')).toBe(before)
  expect(git(small, 'status', '--short')).toContain('?? notes.txt')
})

test('Enter checkout refuses to overwrite working changes', async ({ open, small }) => {
  git(small, 'stash', 'push', '-u')
  git(small, 'switch', '-c', 'feature/conflicting')
  write(small, 'src/app.ts', 'branch version\n')
  commitAll(small, 'Change app on branch')
  git(small, 'switch', 'main')
  git(small, 'stash', 'pop')
  const before = git(small, 'diff')
  const page = await open(small)
  const branch = page.locator('[data-pane="sidebar"] [role="row"][data-key="refs/heads/feature/conflicting"]')
  await branch.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/would be overwritten by checkout/)).toBeVisible()
  expect(git(small, 'branch', '--show-current').trim()).toBe('main')
  expect(git(small, 'diff')).toBe(before)
})
