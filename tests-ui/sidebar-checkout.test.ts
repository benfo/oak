import { mkdirSync, renameSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { commitAll, git, removeDir, tempDir, write } from './repos'

const PICKER = '.palette.dropdown'

/** Opens a toolbar picker and types into its search field. */
async function search(page: Page, trigger: string, text: string) {
  await page.locator(trigger).click()
  const input = page.locator(PICKER).getByRole('textbox')
  await expect(input).toBeFocused()
  await input.fill(text)
}

/** Chooses the first match of a toolbar picker. The list filters a moment after typing, so it waits for the match. */
async function pick(page: Page, trigger: string, text: string) {
  await search(page, trigger, text)
  await expect(page.locator(PICKER).getByRole('option').first()).toContainText(text)
  await page.keyboard.press('Enter')
}

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
  await page.getByRole('menuitem', { name: 'Manage' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: 'Delete: checked out in a worktree' })).toBeDisabled()
  await page.keyboard.press('Escape')
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
  // Visit the worktree and come back, so it is among the recent repositories.
  await pick(page, '.tb-branch', 'parked')
  await expect(page).toHaveTitle('parked - Oak')
  await pick(page, '.tb-repo', basename(small))
  await expect(page).not.toHaveTitle('parked - Oak')
  // Deleted by hand, git still lists the worktree: opening it from its branch says the folder is gone.
  removeDir(join(worktree, 'parked'))
  await pick(page, '.tb-branch', 'parked')
  await expect(page.locator('.toast').filter({ hasText: 'Folder not found' })).toBeVisible()

  // A leftover folder that is no longer a repository is still among the recent ones: choosing it must not do nothing.
  mkdirSync(join(worktree, 'parked'))
  await pick(page, '.tb-repo', 'parked')
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

test("the History commit menu says when a branch's checkout opens its worktree", async ({ open, small }) => {
  const worktree = tempDir('worktree')
  git(small, 'worktree', 'add', '-q', '-b', 'parked', join(worktree, 'parked'))
  const page = await open(small, 'history')
  await page.locator('.commit-row').filter({ hasText: 'parked' }).first().click()
  await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menuitem', { name: 'Open worktree of parked' })).toBeVisible()
  await page.keyboard.press('Escape')
  git(small, 'worktree', 'remove', '--force', join(worktree, 'parked'))
  removeDir(worktree)
})

test('inside a linked worktree, a branch or worktree made elsewhere shows without a reload', async ({ open, small }) => {
  const worktree = tempDir('worktree')
  git(small, 'worktree', 'add', '-q', '-b', 'parked', join(worktree, 'parked'))
  const page = await open(join(worktree, 'parked'))
  const row = page.locator('[data-pane="sidebar"] [role="row"][data-key="refs/heads/second"]')
  await expect(page.locator('[data-pane="sidebar"] [role="row"][data-key="refs/heads/main"]')).toContainText('worktree')
  git(small, 'branch', 'second')
  await expect(row).toBeVisible()
  await expect(row).not.toContainText('worktree')
  git(small, 'worktree', 'add', '-q', join(worktree, 'second'), 'second')
  await expect(row).toContainText('worktree')
  git(small, 'worktree', 'remove', '--force', join(worktree, 'second'))
  // The app runs git inside the open worktree while it refreshes, which holds the folder: let that finish first.
  await expect(row).not.toContainText('worktree')
  removeDir(worktree)
  git(small, 'worktree', 'prune')
})

test('a recent worktree that left a plain folder inside its repository is explained and forgotten', async ({ open, small }) => {
  const nested = join(small, '.worktrees', 'parked')
  git(small, 'worktree', 'add', '-q', '-b', 'parked', nested)
  const page = await open(small)
  await pick(page, '.tb-branch', 'parked')
  await expect(page).toHaveTitle('parked - Oak')
  await pick(page, '.tb-repo', basename(small))
  await expect(page).toHaveTitle(`${basename(small)} - Oak`)

  // Removed, but files stayed behind: git now sees the folder as part of the repository around it.
  // Git commands of the view just left may still be running in the folder, which blocks deleting it on Windows:
  // wait until it can be renamed.
  await expect(() => {
    renameSync(nested, `${nested}-free`)
    renameSync(`${nested}-free`, nested)
  }).toPass()
  git(small, 'worktree', 'remove', '--force', nested)
  mkdirSync(nested, { recursive: true })
  await pick(page, '.tb-repo', 'parked')
  await expect(page.locator('.toast')).toContainText('is no longer a repository of its own')
  await expect(page).toHaveTitle(`${basename(small)} - Oak`)
  await search(page, '.tb-repo', 'parked')
  await expect(page.locator(PICKER).getByText('No matches', { exact: true })).toBeVisible()
})
