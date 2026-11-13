import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { test, expect } from './fixtures'
import { commitAll, git, removeDir, tempDir, write } from './repos'

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

test('a branch checked out in another worktree is marked, and Enter opens that worktree', async ({ open, small }) => {
  const worktree = tempDir('worktree')
  git(small, 'worktree', 'add', '-q', '-b', 'parked', join(worktree, 'parked'))
  const page = await open(small)
  const row = (name: string) => page.locator(`[data-pane="sidebar"] [role="row"][data-key="refs/heads/${name}"]`)
  await expect(row('parked')).toContainText('worktree')
  await row('parked').focus()
  // Git would refuse the checkout and the delete, so the menu offers the worktree instead.
  await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menuitem', { name: 'Open worktree' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(row('parked')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveTitle('parked - Oak')
  // Seen from the worktree, it is the first folder's branch that is held elsewhere.
  await expect(row('main')).toContainText('worktree')
  expect(git(small, 'branch', '--show-current').trim()).toBe('main')
  git(small, 'worktree', 'remove', '--force', join(worktree, 'parked'))
  removeDir(worktree)
})

test('opening a worktree whose folder is gone, or a recent folder that is no longer a repository, says so', async ({ open, small }) => {
  const worktree = tempDir('worktree')
  git(small, 'worktree', 'add', '-q', '-b', 'parked', join(worktree, 'parked'))
  const page = await open(small)
  const pick = async (trigger: string, text: string) => {
    await page.locator(trigger).click()
    const input = page.locator('.palette.dropdown').getByRole('textbox')
    await expect(input).toBeFocused()
    await input.fill(text)
    // The list filters a moment after typing; Enter before that would pick the old first row.
    await expect(page.locator('.palette.dropdown').getByRole('option').first()).toContainText(text)
    await page.keyboard.press('Enter')
  }
  // Visit the worktree and come back, so it is among the recent repositories.
  await pick('.tb-branch', 'parked')
  await expect(page).toHaveTitle('parked - Oak')
  await pick('.tb-repo', basename(small))
  await expect(page).not.toHaveTitle('parked - Oak')
  // Deleted by hand, git still lists the worktree: opening it from its branch says the folder is gone.
  removeDir(join(worktree, 'parked'))
  await pick('.tb-branch', 'parked')
  await expect(page.locator('.toast').filter({ hasText: 'Folder not found' })).toBeVisible()

  // A leftover folder that is no longer a repository is still among the recent ones: choosing it must not do nothing.
  mkdirSync(join(worktree, 'parked'))
  await pick('.tb-repo', 'parked')
  const dialog = page.getByRole('dialog', { name: 'Not a Git repository' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).not.toHaveTitle('parked - Oak')
  removeDir(worktree)
})

test('a worktree added or removed outside Oak marks and unmarks its branch without a reload', async ({ open, small }) => {
  const worktree = tempDir('worktree')
  git(small, 'branch', 'parked')
  const page = await open(small)
  const row = page.locator('[data-pane="sidebar"] [role="row"][data-key="refs/heads/parked"]')
  await expect(row).toBeVisible()
  await expect(row).not.toContainText('worktree')
  git(small, 'worktree', 'add', '-q', join(worktree, 'parked'), 'parked')
  await expect(row).toContainText('worktree')
  git(small, 'worktree', 'remove', join(worktree, 'parked'))
  await expect(row).not.toContainText('worktree')
  removeDir(worktree)
})
