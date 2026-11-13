import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, git, removeDir, tempDir } from './repos'

async function runCheckUp(page: Page) {
  await page.keyboard.press('Control+Shift+P')
  const palette = page.locator('.command-palette')
  const input = palette.getByRole('textbox', { name: 'Type a command…' })
  await expect(input).toBeFocused()
  await input.fill('Repository check-up')
  await expect(palette.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
}

const localBranches = (repo: string) => git(repo, 'branch', '--format=%(refname:short)').trim().split('\n')
const looseObjects = (repo: string) => Number(/^count: (\d+)/m.exec(git(repo, 'count-objects', '-v'))?.[1])

test('the check-up lists merged and gone branches and deletes only the ticked ones', async ({ open, small }) => {
  const remote = tempDir('remote')
  git(remote, 'init', '-q', '--bare')
  git(small, 'remote', 'add', 'origin', join(remote))
  git(small, 'branch', 'done')
  git(small, 'switch', '-q', '-c', 'squashed')
  commitAll(small, 'Work that was squash merged')
  git(small, 'push', '-q', '-u', 'origin', 'squashed')
  git(small, 'switch', '-q', 'main')
  git(small, 'push', '-q', 'origin', '--delete', 'squashed')
  git(small, 'fetch', '-q', '--prune')

  const page = await open(small)
  await runCheckUp(page)
  const dialog = page.getByRole('dialog', { name: 'Repository check-up' })
  const rows = dialog.locator('.checklist-row')
  await expect(dialog.locator('.summary-tile').first()).toContainText('2 to clean up')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('merged into main')
  await expect(rows.nth(1)).toContainText('upstream gone, 1 commit not in main')
  await expect(rows.nth(2)).toContainText('already compact')
  await expect(rows.nth(2)).toHaveAttribute('aria-selected', 'false')
  await expect(rows.nth(0)).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Clean up 2 items' })).toBeEnabled()

  // A group unticks in one go; Ctrl+A ticks every row, then none.
  const confirm = dialog.getByRole('button', { name: /^Clean up/ })
  await dialog.getByRole('button', { name: 'Untick all' }).click()
  await expect(confirm).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tick all' })).toBeVisible()
  await page.keyboard.press('Control+A')
  await expect(confirm).toHaveText('Clean up 3 items')
  await page.keyboard.press('Control+A')
  await expect(confirm).toBeDisabled()

  // Escape leaves every branch alone.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(localBranches(small)).toEqual(['done', 'main', 'squashed'])

  await runCheckUp(page)
  await expect(rows.nth(0)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(dialog.getByRole('button', { name: 'Clean up 1 item' })).toBeEnabled()
  await page.keyboard.press('Control+Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.status-message')).toContainText('Deleted squashed')
  expect(localBranches(small)).toEqual(['done', 'main'])
  removeDir(remote)
})

test('the check-up opens from the toolbar menu and compacts a tidy repository only when asked', async ({ open, small }) => {
  const page = await open(small)
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Repository check-up…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Repository check-up' })
  await expect(dialog.locator('.summary-tile.attention')).toHaveCount(0)
  const confirm = dialog.getByRole('button', { name: /^Clean up/ })
  await expect(confirm).toBeDisabled()

  const compact = dialog.locator('.checklist-row')
  await expect(compact).toHaveCount(1)
  // Opened with the mouse, the list has focus and the first arrow lands on its first row.
  await expect(dialog.getByRole('grid')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(compact).toBeFocused()
  await page.keyboard.press('Space')
  await expect(confirm).toHaveText('Clean up 1 item')
  expect(looseObjects(small)).toBeGreaterThan(0)
  await page.keyboard.press('Control+Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.status-message')).toContainText('Compacted')
  expect(looseObjects(small)).toBe(0)
})
